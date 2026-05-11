<?php

namespace App\Services\Crm;

use App\Models\Crm\ErpOrder;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Certificate PDFs live only on S3 via disk {@see OrderCertificateService::certificateDisk()}
 * (prefix {@see AWS_CERTIFICATES_PREFIX}, default hb-erp/certificates).
 * Preview and download use presigned URLs from {@see accessibleUrl()}; nothing is served from Laravel local/public disks.
 */
class OrderCertificateService
{
    /**
     * S3 object keys must use forward slashes. Windows Flysystem may return backslashes from storeAs().
     * Disk root is already `hb-erp/certificates`, so strip a leading `certificates/` from legacy paths.
     */
    public function normalizeCertificateObjectPath(string $path): string
    {
        $path = str_replace('\\', '/', trim($path));
        $path = ltrim($path, '/');

        while (str_starts_with($path, 'certificates/')) {
            $path = substr($path, strlen('certificates/'));
        }

        return $path;
    }

    public function certificateDisk(): string
    {
        return 'erp_certificates';
    }

    /**
     * Direct browser → S3 uploads use presigned PUT URLs (see {@see presignCertificateUploads}).
     */
    public function supportsDirectUpload(): bool
    {
        return config('filesystems.disks.'.$this->certificateDisk().'.driver') === 's3';
    }

    /**
     * @param  array<int, array{name: string, size: int}>  $filesMeta
     * @return array<int, array{path: string, url: string, headers: array<string, string>}>
     */
    public function presignCertificateUploads(ErpOrder $order, array $filesMeta): array
    {
        if (! $this->supportsDirectUpload()) {
            throw new RuntimeException('Direct certificate upload requires the erp_certificates S3 disk.');
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
        $disk = Storage::disk($this->certificateDisk());
        $expiration = now()->addMinutes(max(5, (int) env('AWS_CERTIFICATES_PRESIGN_UPLOAD_MINUTES', 15)));

        $uploads = [];
        foreach ($filesMeta as $meta) {
            $originalName = trim((string) ($meta['name'] ?? ''));
            if ($originalName === '') {
                continue;
            }

            $safeName = Str::random(8).'-'.preg_replace('/[^A-Za-z0-9._-]/', '_', basename($originalName));
            $relativePath = 'orders/'.$order->id.'/'.$safeName;

            $signed = $disk->temporaryUploadUrl($relativePath, $expiration, [
                'ContentType' => 'application/pdf',
            ]);

            $headers = $this->flattenPresignedPutHeaders(is_array($signed['headers'] ?? null) ? $signed['headers'] : []);

            $uploads[] = [
                'path' => $this->normalizeCertificateObjectPath($relativePath),
                'url' => (string) ($signed['url'] ?? ''),
                'headers' => $headers,
            ];
        }

        return $uploads;
    }

    /**
     * @param  array<string|int, mixed>  $raw
     * @return array<string, string>
     */
    private function flattenPresignedPutHeaders(array $raw): array
    {
        $out = [];
        foreach ($raw as $name => $values) {
            $lower = strtolower((string) $name);
            if (in_array($lower, ['host', 'content-length'], true)) {
                continue;
            }
            $val = is_array($values) ? ($values[0] ?? '') : (string) $values;
            $val = trim((string) $val);
            if ($val === '') {
                continue;
            }
            $out[(string) $name] = $val;
        }

        return $out;
    }

    /**
     * Merge new certificate rows into the order CRM payload (single DB transaction).
     *
     * @param  array<int, array{name: string, path: string, url: ?string}>  $newRows
     * @return array{merged: array<int, array{name: string, path: ?string, url: ?string}>, order: ErpOrder}
     */
    public function persistNewCertificateRows(ErpOrder $order, array $newRows): array
    {
        return DB::transaction(function () use ($order, $newRows) {
            $order->refresh();
            $payload = (array) ($order->crm_payload_json ?? []);
            $inventoryDetail = (array) ($payload['inventory_detail'] ?? []);
            $existingRaw = (array) ($inventoryDetail['certificates'] ?? []);
            $merged = $this->mergeAppendedRows($existingRaw, $newRows);
            data_set($payload, 'inventory_detail.certificates', $merged);
            $order->update(['crm_payload_json' => $payload]);
            $order->refresh();

            return ['merged' => $merged, 'order' => $order];
        });
    }

    public function certificateExists(string $path): bool
    {
        $path = $this->normalizeCertificateObjectPath($path);
        if ($path === '') {
            return false;
        }

        return Storage::disk($this->certificateDisk())->exists($path);
    }

    /**
     * Time-limited S3 URL for preview (inline) or download (attachment).
     *
     * @throws RuntimeException
     */
    public function accessibleUrl(string $path, string $filename, bool $asAttachment): string
    {
        $path = $this->normalizeCertificateObjectPath($path);
        if ($path === '') {
            throw new RuntimeException('Certificate path is empty.');
        }
        $disk = Storage::disk($this->certificateDisk());

        $safeFilename = str_replace(["\r", "\n", '"'], '', $filename);
        if ($safeFilename === '') {
            $safeFilename = 'certificate.pdf';
        }

        $disposition = ($asAttachment ? 'attachment' : 'inline').'; filename="'.$safeFilename.'"';

        if (! $disk->providesTemporaryUrls()) {
            throw new RuntimeException(
                'Certificate storage must be S3 with temporary URLs (configure AWS_* and erp_certificates disk).',
            );
        }

        $minutes = max(1, (int) env('AWS_CERTIFICATES_SIGNED_URL_MINUTES', 60));

        return $disk->temporaryUrl(
            $path,
            now()->addMinutes($minutes),
            [
                'ResponseContentDisposition' => $disposition,
                'ResponseContentType' => 'application/pdf',
            ]
        );
    }

    /**
     * Collect uploaded PDFs from multipart keys: certificates, certificates[], certificates[0], …
     *
     * @return array<int, UploadedFile>
     */
    public function collectUploadedFiles(Request $request): array
    {
        $direct = $request->file('certificates');
        if ($direct !== null) {
            return is_array($direct) ? array_values(array_filter($direct)) : [$direct];
        }

        $out = [];
        foreach ($request->allFiles() as $key => $file) {
            if (! is_string($key) || ! str_starts_with($key, 'certificates')) {
                continue;
            }
            if ($file instanceof UploadedFile) {
                $out[] = $file;
            } elseif (is_array($file)) {
                foreach ($file as $nested) {
                    if ($nested instanceof UploadedFile) {
                        $out[] = $nested;
                    }
                }
            }
        }

        return array_values(array_filter($out));
    }

    /**
     * Store each file under orders/{id}/ on S3 (prefix hb-erp/certificates/ via disk config) and return metadata rows.
     *
     * @param  array<int, UploadedFile>  $files
     * @return array<int, array{name: string, path: string, url: ?string}>
     */
    public function storeUploadedFiles(ErpOrder $order, array $files): array
    {
        $disk = $this->certificateDisk();
        $uploaded = [];
        /** @var array<string, true> Skip duplicate picks in the same request without reading file bytes (SHA256 was a full extra disk pass per PDF). */
        $seenBatchKeys = [];
        foreach ($files as $file) {
            $originalName = (string) $file->getClientOriginalName();
            $batchKey = strtolower($originalName).'|'.$file->getSize();
            if (isset($seenBatchKeys[$batchKey])) {
                continue;
            }
            $seenBatchKeys[$batchKey] = true;

            $safeName = Str::random(8).'-'.preg_replace('/[^A-Za-z0-9._-]/', '_', $originalName);
            $path = $file->storeAs('orders/'.$order->id, $safeName, $disk);
            $path = $this->normalizeCertificateObjectPath($path);

            $uploaded[] = [
                'name' => $originalName !== '' ? $originalName : basename($path),
                'path' => $path,
                'url' => null,
            ];
        }

        return $uploaded;
    }

    /**
     * Append new rows to existing CRM certificate list. Preserves prior entries.
     * Skips a new row only when its storage path already exists in the list (idempotent re-upload).
     *
     * @param  array<int, mixed>  $existingCertificates
     * @param  array<int, array{name: string, path: string, url: ?string}>  $newRows
     * @return array<int, array{name: string, path: ?string, url: ?string}>
     */
    public function mergeAppendedRows(array $existingCertificates, array $newRows): array
    {
        $existing = $this->normalizeCertificates($existingCertificates);
        $seenPaths = [];
        foreach ($existing as $row) {
            $p = trim((string) ($row['path'] ?? ''));
            if ($p !== '') {
                $seenPaths[$this->normalizeCertificateObjectPath($p)] = true;
            }
        }

        $merged = $existing;
        foreach ($newRows as $row) {
            $p = trim((string) ($row['path'] ?? ''));
            if ($p !== '') {
                $p = $this->normalizeCertificateObjectPath($p);
            }
            if ($p !== '' && isset($seenPaths[$p])) {
                continue;
            }
            if ($p !== '') {
                $seenPaths[$p] = true;
            }
            $merged[] = [
                'name' => $row['name'],
                'path' => $p !== '' ? $p : $row['path'],
                'url' => $row['url'],
            ];
        }

        return array_values($merged);
    }

    /**
     * Normalize certificate entries from CRM JSON.
     * Dedupes by storage path when present; otherwise keeps row position so duplicate filenames are preserved.
     *
     * @param  array<int, mixed>  $items
     * @return array<int, array{name: string, path: ?string, url: ?string}>
     */
    public function normalizeCertificates(array $items): array
    {
        $deduped = [];

        foreach ($items as $idx => $item) {
            $entry = null;
            if (is_array($item)) {
                $name = trim((string) ($item['name'] ?? ''));
                $path = trim((string) ($item['path'] ?? ''));
                $url = trim((string) ($item['url'] ?? ''));
                if ($name === '' && $path === '' && $url === '') {
                    continue;
                }
                if ($path !== '') {
                    $path = $this->normalizeCertificateObjectPath($path);
                }
                if ($name === '' && $path !== '') {
                    $name = basename($path);
                }
                // S3-backed rows use API presigned links only; strip stale /storage URLs from older payloads.
                $pathNorm = ltrim($path, '/');
                if ($pathNorm !== '' && str_starts_with($pathNorm, 'orders/')) {
                    $url = '';
                }
                if ($url !== '' && str_contains($url, '/storage/')) {
                    $url = '';
                }
                $entry = [
                    'name' => $name !== '' ? $name : 'certificate.pdf',
                    'path' => $path !== '' ? $path : null,
                    'url' => $url !== '' ? $url : null,
                ];
            } else {
                $name = trim((string) $item);
                if ($name === '') {
                    continue;
                }
                $entry = [
                    'name' => $name,
                    'path' => null,
                    'url' => null,
                ];
            }

            $pathKey = trim((string) ($entry['path'] ?? ''));
            $dedupeKey = $pathKey !== ''
                ? 'path:'.$pathKey
                : 'legacy:'.$idx.':'.strtolower(trim((string) ($entry['name'] ?? '')));

            $existing = $deduped[$dedupeKey] ?? null;
            if (! $existing) {
                $deduped[$dedupeKey] = $entry;

                continue;
            }

            $existingHasUrl = ! empty($existing['url']);
            $entryHasUrl = ! empty($entry['url']);
            if (! $existingHasUrl && $entryHasUrl) {
                $deduped[$dedupeKey] = $entry;

                continue;
            }

            $existingHasPath = ! empty($existing['path']);
            $entryHasPath = ! empty($entry['path']);
            if (! $existingHasPath && $entryHasPath) {
                $deduped[$dedupeKey] = $entry;
            }
        }

        return array_values($deduped);
    }
}
