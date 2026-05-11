<?php

namespace App\Http\Controllers\Api\Crm;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Crm\IngestOrderRequest;
use App\Models\Crm\ErpOrder;
use App\Models\Crm\ErpOrderDetail;
use App\Services\Crm\CompanyAccountManagerSyncService;
use App\Services\Crm\CrmOrderIngestService;
use App\Services\Crm\OrderCertificateService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class OrderIngestController extends Controller
{
    public function __construct(
        private readonly CrmOrderIngestService $ingestService,
        private readonly OrderCertificateService $certificateService,
        private readonly CompanyAccountManagerSyncService $accountManagerSync,
    ) {}

    public function store(IngestOrderRequest $request)
    {
        $idempotencyKey = (string) $request->header('X-Idempotency-Key', '');
        $result = $this->ingestService->ingest($request->validated(), $idempotencyKey ?: null);

        if (($result['duplicated'] ?? false) === true) {
            return response()->json($result, 409);
        }

        return response()->json($result, 201);
    }

    public function show(ErpOrder $order)
    {
        return response()->json([
            'status' => 'ok',
            'data' => $order->load(['company', 'detailRows']),
        ]);
    }

    public function update(Request $request, ErpOrder $order)
    {
        $validator = Validator::make(
            $request->all(),
            [
                'title' => ['nullable', 'string'],
                'type_of_equipment' => ['nullable', 'string'],
                'quantity' => ['nullable', 'string'],
                'estimate_value' => ['nullable', 'numeric'],
                'pickup_cost' => ['nullable', 'numeric'],
                'pickup_cost_status' => ['nullable', 'string'],
                'status' => ['nullable', 'string'],
                'qualify_status' => ['nullable', 'string'],
                'pickup_date' => ['nullable', 'date'],
                'start_date' => ['nullable', 'date'],
                'pickup_address_id' => ['nullable', 'integer'],
                'summary' => ['nullable', 'string'],
                'notes' => ['nullable', 'string'],
                'services' => ['nullable', 'array'],
                'services.*' => ['string'],
                'devices' => ['nullable', 'array'],
                'devices.*.order_seq' => ['nullable', 'string'],
                'devices.*.category' => ['nullable', 'string'],
                'devices.*.device_name' => ['nullable', 'string'],
                'devices.*.serial_number' => ['nullable', 'string'],
                'devices.*.count' => ['nullable', 'integer'],
                'devices.*.notes' => ['nullable', 'string'],
                'inventory_detail' => ['nullable', 'array'],
                'inventory_detail.pickup_by' => ['nullable', 'string'],
                'inventory_detail.account_manager' => ['nullable', 'string', 'max:120'],
                'inventory_detail.delivered_date' => ['nullable', 'date'],
                'inventory_detail.bol' => ['nullable', 'string'],
                'inventory_detail.summary' => ['nullable', 'array'],
                'inventory_detail.summary.order_id' => ['nullable', 'string'],
                'inventory_detail.summary.location' => ['nullable', 'string'],
                'inventory_detail.summary.device_type' => ['nullable', 'string'],
                'inventory_detail.summary.serial_number' => ['nullable', 'string'],
                'inventory_detail.summary.model_type' => ['nullable', 'string'],
                'inventory_detail.summary.processor' => ['nullable', 'string'],
                'inventory_detail.summary.gpu' => ['nullable', 'string'],
                'inventory_detail.summary.ram' => ['nullable', 'string'],
                'inventory_detail.summary.storage' => ['nullable', 'string'],
                'inventory_detail.summary.os' => ['nullable', 'string'],
                'inventory_detail.summary.battery_health' => ['nullable', 'string'],
                'inventory_detail.summary.display' => ['nullable', 'string'],
                'inventory_detail.summary.touch' => ['nullable', 'string'],
                'inventory_detail.summary.cosmetic_condition_grade' => ['nullable', 'string'],
                'inventory_detail.summary.notes' => ['nullable', 'string'],
                'inventory_detail.summary.data_wipe_enabled' => ['nullable', 'boolean'],
                'inventory_detail.summary.data_wipe_calendar' => ['nullable', 'date'],
                'inventory_detail.summary.hdd_model' => ['nullable', 'string'],
                'inventory_detail.summary.hdd_serial_number' => ['nullable', 'string'],
                'inventory_detail.summary.next_step' => ['nullable', 'string'],
                'inventory_detail.devices' => ['nullable', 'array'],
                'inventory_detail.devices.*.inventory_type' => ['nullable', 'string'],
                'inventory_detail.devices.*.inventory_number' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary' => ['nullable', 'array'],
                'inventory_detail.devices.*.summary.order_id' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary.location' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary.device_type' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary.serial_number' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary.model_type' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary.processor' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary.gpu' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary.ram' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary.storage' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary.os' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary.battery_health' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary.display' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary.touch' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary.cosmetic_condition_grade' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary.notes' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary.data_wipe_enabled' => ['nullable', 'boolean'],
                'inventory_detail.devices.*.summary.data_wipe_calendar' => ['nullable', 'date'],
                'inventory_detail.devices.*.summary.hdd_model' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary.hdd_serial_number' => ['nullable', 'string'],
                'inventory_detail.devices.*.summary.next_step' => ['nullable', 'string'],
                'inventory_detail.certificates' => ['nullable', 'array'],
                'inventory_detail.certificates.*' => ['nullable'],
                'inventory_detail.summary_layout' => ['nullable', 'string'],
                'inventory_detail.simple_summary' => ['nullable', 'array'],
                'inventory_detail.simple_summary.*' => ['nullable', 'array'],
                'inventory_detail.simple_summary.*.order_number' => ['nullable', 'string'],
                'inventory_detail.simple_summary.*.device_type' => ['nullable', 'string'],
                'inventory_detail.simple_summary.*.count' => ['nullable', 'string'],
                'inventory_detail.simple_summary.*.weight_lbs' => ['nullable', 'string'],
                'inventory_detail.rough_summary' => ['nullable', 'array'],
                'inventory_detail.rough_summary.weight_mode' => ['nullable', 'string'],
                'inventory_detail.rough_summary.lines' => ['nullable', 'array'],
                'inventory_detail.rough_summary.lines.*' => ['nullable', 'array'],
                'inventory_detail.rough_summary.lines.*.device_type' => ['nullable', 'string'],
                'inventory_detail.rough_summary.lines.*.count' => ['nullable', 'string', 'max:40', 'regex:/^\d{1,5}(?:\s*[A-Za-z][A-Za-z\s-]*)?$/i'],
                'inventory_detail.rough_summary.lines.*.weight_lbs' => ['nullable', 'string'],
                'inventory_detail.rough_summary.lines.*.weight_mode' => ['nullable', 'string'],
            ],
        );

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();

        if (array_key_exists('pickup_address_id', $data) && (int) ($data['pickup_address_id'] ?? 0) > 0) {
            $belongs = DB::table('company_addresses')
                ->where('id', (int) $data['pickup_address_id'])
                ->where('company_id', $order->company_id)
                ->exists();
            if (! $belongs) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Pickup address does not belong to this company.',
                ], 422);
            }
        }

        $incomingInventoryDetail = (array) ($data['inventory_detail'] ?? []);
        $shouldSyncAccountManager = array_key_exists('account_manager', $incomingInventoryDetail);

        DB::transaction(function () use ($order, $data, $incomingInventoryDetail, $shouldSyncAccountManager) {
            $services = collect((array) ($data['services'] ?? []))
                ->map(fn ($s) => trim((string) $s))
                ->filter()
                ->values()
                ->all();

            $summary = (string) ($data['summary'] ?? '');
            $notes = (string) ($data['notes'] ?? '');
            $combinedMessage = trim($summary.($summary !== '' && $notes !== '' ? "\n\n" : '').$notes);
            $currentPayload = (array) ($order->crm_payload_json ?? []);
            $existingManual = (array) ($currentPayload['manual'] ?? []);
            $existingInventoryDetail = (array) ($currentPayload['inventory_detail'] ?? []);
            $existingSummary = (array) ($existingInventoryDetail['summary'] ?? []);
            $incomingSummary = (array) ($incomingInventoryDetail['summary'] ?? []);
            $summaryFields = [
                'order_id',
                'location',
                'device_type',
                'serial_number',
                'model_type',
                'processor',
                'gpu',
                'ram',
                'storage',
                'os',
                'battery_health',
                'display',
                'touch',
                'cosmetic_condition_grade',
                'notes',
                'hdd_model',
                'hdd_serial_number',
                'next_step',
            ];
            $normalizedSummary = $this->normalizeInventorySummary($existingSummary, $incomingSummary, $summaryFields);

            $existingDevices = (array) ($existingInventoryDetail['devices'] ?? []);
            $incomingDevices = (array) ($incomingInventoryDetail['devices'] ?? []);
            $normalizedDevices = [];
            if (array_key_exists('devices', $incomingInventoryDetail)) {
                foreach ($incomingDevices as $index => $device) {
                    if (! is_array($device)) {
                        continue;
                    }
                    $incomingDeviceSummary = (array) ($device['summary'] ?? []);
                    $normalizedDeviceSummary = $this->normalizeInventorySummary([], $incomingDeviceSummary, $summaryFields);
                    $inventoryType = trim((string) ($device['inventory_type'] ?? $normalizedDeviceSummary['device_type'] ?? ''));
                    $inventoryNumber = trim((string) ($device['inventory_number'] ?? ''));
                    if ($inventoryType === '' && $inventoryNumber === '' && $normalizedDeviceSummary['order_id'] === '' && $normalizedDeviceSummary['serial_number'] === '') {
                        continue;
                    }
                    $normalizedDeviceSummary['device_type'] = $normalizedDeviceSummary['device_type'] !== ''
                        ? $normalizedDeviceSummary['device_type']
                        : $inventoryType;
                    $normalizedDevices[] = [
                        'inventory_type' => $inventoryType,
                        'inventory_number' => $inventoryNumber !== '' ? $inventoryNumber : (string) ($index + 1),
                        'summary' => $normalizedDeviceSummary,
                    ];
                }
            } else {
                foreach ($existingDevices as $index => $device) {
                    if (! is_array($device)) {
                        continue;
                    }
                    $existingDeviceSummary = (array) ($device['summary'] ?? []);
                    $normalizedDeviceSummary = $this->normalizeInventorySummary($existingDeviceSummary, [], $summaryFields);
                    $inventoryType = trim((string) ($device['inventory_type'] ?? $normalizedDeviceSummary['device_type'] ?? ''));
                    $inventoryNumber = trim((string) ($device['inventory_number'] ?? ''));
                    if ($inventoryType === '' && $inventoryNumber === '' && $normalizedDeviceSummary['order_id'] === '' && $normalizedDeviceSummary['serial_number'] === '') {
                        continue;
                    }
                    $normalizedDeviceSummary['device_type'] = $normalizedDeviceSummary['device_type'] !== ''
                        ? $normalizedDeviceSummary['device_type']
                        : $inventoryType;
                    $normalizedDevices[] = [
                        'inventory_type' => $inventoryType,
                        'inventory_number' => $inventoryNumber !== '' ? $inventoryNumber : (string) ($index + 1),
                        'summary' => $normalizedDeviceSummary,
                    ];
                }
            }
            // Legacy single-summary fallback only when client did not send an explicit devices list.
            // If `devices` is present (even empty), respect it — e.g. Clear Table + Save must not recreate rows.
            if ($normalizedDevices === [] && ! array_key_exists('devices', $incomingInventoryDetail)
                && ($normalizedSummary['order_id'] !== '' || $normalizedSummary['serial_number'] !== '' || $normalizedSummary['device_type'] !== '')) {
                $normalizedDevices[] = [
                    'inventory_type' => $normalizedSummary['device_type'],
                    'inventory_number' => '1',
                    'summary' => $normalizedSummary,
                ];
            }

            $normalizedSimpleSummary = array_key_exists('simple_summary', $incomingInventoryDetail)
                ? $this->normalizeSimpleSummaryRows((array) ($incomingInventoryDetail['simple_summary'] ?? []))
                : (array) ($existingInventoryDetail['simple_summary'] ?? []);
            $summaryLayout = array_key_exists('summary_layout', $incomingInventoryDetail)
                ? trim((string) ($incomingInventoryDetail['summary_layout'] ?? ''))
                : trim((string) ($existingInventoryDetail['summary_layout'] ?? ''));
            $normalizedRoughSummary = array_key_exists('rough_summary', $incomingInventoryDetail)
                ? $this->normalizeRoughSummary((array) ($incomingInventoryDetail['rough_summary'] ?? []))
                : $this->normalizeRoughSummary((array) ($existingInventoryDetail['rough_summary'] ?? []));

            $normalizedInventoryDetail = array_merge($existingInventoryDetail, [
                'pickup_by' => array_key_exists('pickup_by', $incomingInventoryDetail)
                    ? trim((string) ($incomingInventoryDetail['pickup_by'] ?? ''))
                    : ($existingInventoryDetail['pickup_by'] ?? ''),
                'account_manager' => array_key_exists('account_manager', $incomingInventoryDetail)
                    ? trim((string) ($incomingInventoryDetail['account_manager'] ?? ''))
                    : ($existingInventoryDetail['account_manager'] ?? ''),
                'delivered_date' => array_key_exists('delivered_date', $incomingInventoryDetail)
                    ? ($incomingInventoryDetail['delivered_date'] ?: null)
                    : ($existingInventoryDetail['delivered_date'] ?? null),
                'bol' => array_key_exists('bol', $incomingInventoryDetail)
                    ? trim((string) ($incomingInventoryDetail['bol'] ?? ''))
                    : ($existingInventoryDetail['bol'] ?? ''),
                'certificates' => $this->certificateService->normalizeCertificates(
                    (array) ($incomingInventoryDetail['certificates'] ?? ($existingInventoryDetail['certificates'] ?? []))
                ),
                'devices' => $normalizedDevices,
                'summary' => $normalizedSummary,
                'simple_summary' => $normalizedSimpleSummary,
                'summary_layout' => $summaryLayout,
                'rough_summary' => $normalizedRoughSummary,
            ]);
            if (($normalizedInventoryDetail['simple_summary'] ?? []) !== []) {
                $normalizedInventoryDetail['devices'] = [];
            }
            $devicesAfter = (array) ($normalizedInventoryDetail['devices'] ?? []);
            if ($devicesAfter !== []) {
                $normalizedInventoryDetail['summary'] = (array) ($devicesAfter[0]['summary'] ?? $normalizedSummary);
            }

            $order->update([
                'title' => $data['title'] ?? $order->title,
                'type_of_equipment' => $data['type_of_equipment'] ?? $order->type_of_equipment,
                'quantity' => $data['quantity'] ?? $order->quantity,
                'estimate_value' => $data['estimate_value'] ?? $order->estimate_value,
                'pickup_cost' => $data['pickup_cost'] ?? $order->pickup_cost,
                'pickup_cost_status' => $data['pickup_cost_status'] ?? $order->pickup_cost_status,
                'status' => $data['status'] ?? $order->status,
                'qualify_status' => $data['qualify_status'] ?? $order->qualify_status,
                'pickup_date' => $data['pickup_date'] ?? $order->pickup_date,
                'start_date' => $data['start_date'] ?? $order->start_date,
                'pickup_address_id' => array_key_exists('pickup_address_id', $data)
                    ? ((int) ($data['pickup_address_id'] ?? 0) ?: null)
                    : $order->pickup_address_id,
                'message' => $combinedMessage !== '' ? $combinedMessage : $order->message,
                'crm_payload_json' => array_merge($currentPayload, [
                    'manual' => [
                        'summary' => $summary !== '' ? $summary : (string) ($existingManual['summary'] ?? ''),
                        'notes' => $notes !== '' ? $notes : (string) ($existingManual['notes'] ?? ''),
                        'services' => $services !== [] ? $services : (array) ($existingManual['services'] ?? []),
                    ],
                    'inventory_detail' => $normalizedInventoryDetail,
                ]),
            ]);

            if ($shouldSyncAccountManager) {
                $this->accountManagerSync->propagateFromOrder(
                    $order->fresh(),
                    (string) ($normalizedInventoryDetail['account_manager'] ?? ''),
                );
            }

            if (array_key_exists('devices', $data)) {
                ErpOrderDetail::query()->where('erp_order_id', $order->id)->delete();
                foreach ((array) $data['devices'] as $idx => $device) {
                    $name = trim((string) ($device['device_name'] ?? ''));
                    $category = trim((string) ($device['category'] ?? ''));
                    $serial = trim((string) ($device['serial_number'] ?? ''));
                    $count = (int) ($device['count'] ?? 1);
                    if ($name === '' && $category === '' && $serial === '') {
                        continue;
                    }
                    ErpOrderDetail::query()->create([
                        'erp_order_id' => $order->id,
                        'order_seq' => (string) (($device['order_seq'] ?? '') ?: ('ITEM-'.($idx + 1))),
                        'pk_status' => $order->status,
                        'make_model' => $name,
                        'model_type' => $category,
                        'serial_number' => $serial,
                        'condition' => $count > 1 ? "x{$count}" : '1',
                        'next_steps' => '',
                        'market' => '',
                        'notes' => $device['notes'] ?? null,
                    ]);
                }
            }
        });

        return response()->json([
            'status' => 'ok',
            'data' => $order->fresh(['company', 'detailRows']),
        ]);
    }

    public function uploadCertificates(Request $request, ErpOrder $order)
    {
        $files = $this->certificateService->collectUploadedFiles($request);

        $validator = Validator::make(
            ['certificates' => $files],
            [
                'certificates' => ['required', 'array', 'min:1'],
                'certificates.*' => ['required', 'file', 'mimes:pdf', 'max:10240'],
            ],
            [
                'certificates.required' => 'No PDF files were received. Use PDF format under 10 MB.',
                'certificates.min' => 'Upload at least one PDF.',
                'certificates.*.mimes' => 'Certificates must be PDF files (.pdf).',
                'certificates.*.max' => 'Each PDF must be 10 MB or smaller.',
            ],
        );

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $validatedFiles = $validator->validated()['certificates'];

        $newRows = $this->certificateService->storeUploadedFiles($order, $validatedFiles);

        $result = $this->certificateService->persistNewCertificateRows($order, $newRows);

        return response()->json([
            'status' => 'ok',
            'data' => $result['merged'],
            'order' => $result['order'],
        ], 201);
    }

    public function presignCertificateUploads(Request $request, ErpOrder $order)
    {
        if (! $this->certificateService->supportsDirectUpload()) {
            return response()->json([
                'status' => 'error',
                'code' => 'direct_upload_unavailable',
                'message' => 'Certificate storage is not configured for direct S3 upload.',
            ], 409);
        }

        $validator = Validator::make(
            $request->all(),
            [
                'files' => ['required', 'array', 'min:1', 'max:25'],
                'files.*.name' => ['required', 'string', 'max:255'],
                'files.*.size' => ['required', 'integer', 'min:1', 'max:10485760'],
            ],
            [
                'files.max' => 'Upload at most 25 PDFs per request.',
                'files.*.size.max' => 'Each PDF must be 10 MB or smaller.',
            ],
        );

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $filesMeta = $validator->validated()['files'];
        foreach ($filesMeta as $row) {
            $name = (string) ($row['name'] ?? '');
            if ($name === '' || ! preg_match('/\.pdf$/i', $name)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Certificate filenames must end with .pdf.',
                ], 422);
            }
        }

        try {
            $uploads = $this->certificateService->presignCertificateUploads($order, $filesMeta);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'status' => 'error',
                'message' => 'Unable to create upload URLs.',
            ], 500);
        }

        if ($uploads === []) {
            return response()->json([
                'status' => 'error',
                'message' => 'No upload URLs were generated.',
            ], 422);
        }

        return response()->json([
            'status' => 'ok',
            'data' => ['uploads' => $uploads],
        ]);
    }

    public function registerCertificates(Request $request, ErpOrder $order)
    {
        $validator = Validator::make(
            $request->all(),
            [
                'rows' => ['required', 'array', 'min:1', 'max:25'],
                'rows.*.path' => ['required', 'string', 'max:512'],
                'rows.*.name' => ['required', 'string', 'max:255'],
            ],
        );

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $rowsIn = $validator->validated()['rows'];
        $prefix = 'orders/'.$order->id.'/';

        $newRows = [];
        foreach ($rowsIn as $row) {
            $path = $this->certificateService->normalizeCertificateObjectPath((string) $row['path']);
            if ($path === '' || ! str_starts_with($path, $prefix)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Invalid certificate path for this order.',
                ], 422);
            }

            if (! $this->certificateService->certificateExists($path)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Upload did not arrive in storage yet (check S3 CORS or retry).',
                ], 422);
            }

            $newRows[] = [
                'name' => (string) $row['name'],
                'path' => $path,
                'url' => null,
            ];
        }

        $result = $this->certificateService->persistNewCertificateRows($order, $newRows);

        return response()->json([
            'status' => 'ok',
            'data' => $result['merged'],
            'order' => $result['order'],
        ], 201);
    }

    public function certificateLink(Request $request, ErpOrder $order, int $certificateIndex)
    {
        $resolved = $this->resolveCertificateRow($order, $certificateIndex);
        if ($resolved === null) {
            return response()->json([
                'status' => 'error',
                'message' => $this->certificateMissingMessage($order, $certificateIndex),
            ], 404);
        }

        ['certificate' => $certificate, 'path' => $path] = $resolved;
        $displayName = trim((string) ($certificate['name'] ?? 'certificate.pdf'));
        $download = (string) $request->query('download', '') === '1';

        try {
            $url = $this->certificateService->accessibleUrl($path, $displayName, $download);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'status' => 'error',
                'message' => 'Unable to generate file link.',
            ], 500);
        }

        return response()->json([
            'status' => 'ok',
            'data' => [
                'url' => $url,
            ],
        ]);
    }

    /**
     * Redirect to a presigned S3 URL (auth required on this endpoint to obtain the link).
     */
    public function certificate(Request $request, ErpOrder $order, int $certificateIndex)
    {
        $resolved = $this->resolveCertificateRow($order, $certificateIndex);
        if ($resolved === null) {
            return response()->json([
                'status' => 'error',
                'message' => $this->certificateMissingMessage($order, $certificateIndex),
            ], 404);
        }

        ['certificate' => $certificate, 'path' => $path] = $resolved;
        $displayName = trim((string) ($certificate['name'] ?? 'certificate.pdf'));
        $download = (string) $request->query('download', '') === '1';

        try {
            $url = $this->certificateService->accessibleUrl($path, $displayName, $download);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'status' => 'error',
                'message' => 'Unable to generate file link.',
            ], 500);
        }

        return redirect()->away($url);
    }

    /**
     * @return array{certificate: array<string, mixed>, path: string}|null
     */
    private function resolveCertificateRow(ErpOrder $order, int $certificateIndex): ?array
    {
        $payload = (array) ($order->crm_payload_json ?? []);
        $inventoryDetail = (array) ($payload['inventory_detail'] ?? []);
        $certificates = $this->certificateService->normalizeCertificates((array) ($inventoryDetail['certificates'] ?? []));

        if (! array_key_exists($certificateIndex, $certificates)) {
            return null;
        }

        $certificate = (array) $certificates[$certificateIndex];
        $path = trim((string) ($certificate['path'] ?? ''));
        if ($path === '' || ! $this->certificateService->certificateExists($path)) {
            return null;
        }

        return ['certificate' => $certificate, 'path' => $path];
    }

    private function certificateMissingMessage(ErpOrder $order, int $certificateIndex): string
    {
        $payload = (array) ($order->crm_payload_json ?? []);
        $inventoryDetail = (array) ($payload['inventory_detail'] ?? []);
        $certificates = $this->certificateService->normalizeCertificates((array) ($inventoryDetail['certificates'] ?? []));

        if (! array_key_exists($certificateIndex, $certificates)) {
            return 'Certificate not found.';
        }

        return 'Certificate file is missing.';
    }

    /**
     * @param  array<int, mixed>  $rows
     * @return array<int, array{order_number: string, device_type: string, count: string, weight_lbs: string}>
     */
    private function normalizeSimpleSummaryRows(array $rows): array
    {
        $out = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $out[] = [
                'order_number' => trim((string) ($row['order_number'] ?? '')),
                'device_type' => trim((string) ($row['device_type'] ?? '')),
                'count' => trim((string) ($row['count'] ?? '')),
                'weight_lbs' => trim((string) ($row['weight_lbs'] ?? '')),
            ];
        }

        return $out;
    }

    /**
     * Optional quick estimate: device types + counts; each line chooses settings-based lbs or manual lbs.
     *
     * @param  array<string, mixed>  $raw
     * @return array{lines: array<int, array{device_type: string, count: string, weight_lbs: string, weight_mode: string}>}
     */
    private function normalizeRoughSummary(array $raw): array
    {
        $legacyGlobal = strtolower(trim((string) ($raw['weight_mode'] ?? 'settings')));
        if (! in_array($legacyGlobal, ['settings', 'manual'], true)) {
            $legacyGlobal = 'settings';
        }
        $linesIn = array_values(array_filter((array) ($raw['lines'] ?? []), 'is_array'));
        $lines = [];
        foreach ($linesIn as $row) {
            $deviceType = trim((string) ($row['device_type'] ?? ''));
            $count = trim((string) ($row['count'] ?? ''));
            $weightLbs = trim((string) ($row['weight_lbs'] ?? ''));
            if ($deviceType === '' && $count === '' && $weightLbs === '') {
                continue;
            }
            $lineMode = strtolower(trim((string) ($row['weight_mode'] ?? '')));
            if (! in_array($lineMode, ['settings', 'manual'], true)) {
                $lineMode = $legacyGlobal;
            }
            $lines[] = [
                'device_type' => $deviceType,
                'count' => $count,
                'weight_lbs' => $weightLbs,
                'weight_mode' => $lineMode,
            ];
        }

        return [
            'lines' => $lines,
        ];
    }

    private function normalizeInventorySummary(array $existingSummary, array $incomingSummary, array $summaryFields): array
    {
        $normalizedSummary = [];
        foreach ($summaryFields as $field) {
            $normalizedSummary[$field] = array_key_exists($field, $incomingSummary)
                ? trim((string) ($incomingSummary[$field] ?? ''))
                : trim((string) ($existingSummary[$field] ?? ''));
        }
        $normalizedSummary['data_wipe_enabled'] = array_key_exists('data_wipe_enabled', $incomingSummary)
            ? (bool) $incomingSummary['data_wipe_enabled']
            : (bool) ($existingSummary['data_wipe_enabled'] ?? false);
        $normalizedSummary['data_wipe_calendar'] = array_key_exists('data_wipe_calendar', $incomingSummary)
            ? ($incomingSummary['data_wipe_calendar'] ?: null)
            : ($existingSummary['data_wipe_calendar'] ?? null);

        return $normalizedSummary;
    }
}
