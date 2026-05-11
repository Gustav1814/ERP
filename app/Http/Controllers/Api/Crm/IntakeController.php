<?php

namespace App\Http\Controllers\Api\Crm;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Crm\IntakeRequest;
use App\Models\Crm\CrmIntakeQueue;
use App\Models\Crm\Company;
use App\Services\Crm\CrmOrderIngestService;
use App\Services\Crm\HandoffTokenService;
use Illuminate\Http\Request;
use Throwable;

class IntakeController extends Controller
{
    public function __construct(
        private readonly HandoffTokenService $handoffTokenService,
        private readonly CrmOrderIngestService $ingestService
    ) {
    }

    public function store(IntakeRequest $request)
    {
        try {
            $token = (string) $request->input('handoff', '');
            $leadId = 0;
            $sourceOrderId = '';
            $jti = '';
            $payload = $this->handoffTokenService->validateAndConsume($token);
            $leadId = (int) data_get($payload, 'lead_ref.lead_id');
            $sourceOrderId = (string) data_get($payload, 'lead_ref.order_id');
            $jti = sprintf('token-lead-%d-order-%s', $leadId, $sourceOrderId !== '' ? $sourceOrderId : 'na');
            $intake = (array) data_get($payload, 'payload', []);

            if ($intake === []) {
                throw new \RuntimeException('Invalid handoff payload: missing payload object.');
            }

            $queue = CrmIntakeQueue::query()->updateOrCreate(
                ['handoff_jti' => $jti],
                [
                    'lead_id' => $leadId,
                    'source_order_id' => $sourceOrderId !== '' ? $sourceOrderId : (string) data_get($intake, 'source.order_id', ''),
                    'payload_json' => $intake,
                    'status' => 'pending',
                ]
            );

            // Auto-commit intake to ERP orders so CRM push immediately appears in ERP.
            $ingestResult = $this->ingestService->ingest($intake);
            $queue->update([
                'status' => 'resolved',
                'erp_company_id' => $ingestResult['erp_company_id'] ?? null,
                'erp_order_id' => $ingestResult['erp_order_id'] ?? null,
                'resolved_at' => now(),
            ]);

            $matches = $this->findCompanyMatches($intake);

            $defaultMatch = $matches->first();
            $defaultBillingId = $defaultMatch?->addresses?->first()?->id;

            return response()->json([
                'status' => 'ok',
                'handoff' => [
                    'lead_id' => $leadId,
                    'source_order_id' => $sourceOrderId !== '' ? $sourceOrderId : data_get($intake, 'source.order_id'),
                ],
                'payload' => $intake,
                'matches' => $matches->map(function (Company $company) {
                    return [
                        'id' => $company->id,
                        'name' => $company->name,
                        'primary_email' => $company->primary_email,
                        'primary_phone' => $company->primary_phone,
                        'billing_addresses' => $company->addresses->map(fn ($address) => [
                            'id' => $address->id,
                            'line1' => $address->line1,
                            'city' => $address->city,
                            'state' => $address->state,
                            'zip' => $address->zip,
                        ])->values(),
                    ];
                })->values(),
                'suggested_binding' => [
                    'mode' => $defaultMatch ? 'existing' : 'new',
                    'existing_company_id' => $defaultMatch?->id,
                    'billing_address_id' => $defaultBillingId,
                ],
                'queue' => ['jti' => $jti],
                'ingest' => $ingestResult,
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    public function pending(Request $request)
    {
        $rows = CrmIntakeQueue::query()
            ->where('status', 'pending')
            ->latest('id')
            ->limit((int) min(max($request->input('limit', 100), 1), 500))
            ->get()
            ->map(fn (CrmIntakeQueue $row) => [
                'id' => $row->id,
                'lead_id' => $row->lead_id,
                'source_order_id' => $row->source_order_id,
                'created_at' => $row->created_at?->toISOString(),
            ]);

        return response()->json(['status' => 'ok', 'items' => $rows]);
    }

    public function show(int $id)
    {
        $row = CrmIntakeQueue::query()->findOrFail($id);

        $intake = $row->payload_json;
        $matches = $this->findCompanyMatches($intake);

        $defaultMatch = $matches->first();
        $defaultBillingId = $defaultMatch?->addresses?->first()?->id;

        return response()->json([
            'status' => 'ok',
            'queue' => [
                'id' => $row->id,
                'lead_id' => $row->lead_id,
                'source_order_id' => $row->source_order_id,
            ],
            'handoff' => [
                'lead_id' => $row->lead_id,
                'source_order_id' => $row->source_order_id,
            ],
            'payload' => $intake,
            'matches' => $matches->map(function (Company $company) {
                return [
                    'id' => $company->id,
                    'name' => $company->name,
                    'primary_email' => $company->primary_email,
                    'primary_phone' => $company->primary_phone,
                    'billing_addresses' => $company->addresses->map(fn ($address) => [
                        'id' => $address->id,
                        'line1' => $address->line1,
                        'city' => $address->city,
                        'state' => $address->state,
                        'zip' => $address->zip,
                    ])->values(),
                ];
            })->values(),
            'suggested_binding' => [
                'mode' => $defaultMatch ? 'existing' : 'new',
                'existing_company_id' => $defaultMatch?->id,
                'billing_address_id' => $defaultBillingId,
            ],
        ]);
    }

    public function discard(int $id)
    {
        $row = CrmIntakeQueue::query()->findOrFail($id);

        if ($row->status === 'resolved') {
            return response()->json([
                'status' => 'error',
                'message' => 'Resolved intake cannot be discarded.',
            ], 422);
        }

        $row->update([
            'status' => 'discarded',
            'resolved_at' => now(),
        ]);

        return response()->json([
            'status' => 'ok',
            'queue_id' => $row->id,
            'queue_status' => $row->status,
        ]);
    }

    private function findCompanyMatches(array $intake)
    {
        $primaryEmail = strtolower((string) data_get($intake, 'company.primary_email', ''));
        $companyName = trim((string) data_get($intake, 'company.name', ''));
        $domain = $this->extractDomain($primaryEmail);
        $isPublicEmailDomain = $this->isPublicEmailDomain($domain);

        return Company::query()
            ->with(['addresses' => fn ($q) => $q->where('kind', 'billing')])
            ->where(function ($query) use ($primaryEmail, $companyName, $domain, $isPublicEmailDomain) {
                if ($primaryEmail !== '' && ! $isPublicEmailDomain) {
                    $query->orWhereRaw('LOWER(primary_email) = ?', [$primaryEmail]);
                }
                if ($companyName !== '') {
                    $query->orWhere('name', 'like', '%'.$companyName.'%');
                }
                if ($domain !== '' && ! $isPublicEmailDomain) {
                    $query->orWhereRaw('LOWER(primary_email) LIKE ?', ['%@'.$domain]);
                    $query->orWhereRaw('LOWER(name) LIKE ?', ['%'.$domain.'%']);
                }
            })
            ->limit(10)
            ->get(['id', 'name', 'primary_email', 'primary_phone']);
    }

    private function extractDomain(string $email): string
    {
        if (! str_contains($email, '@')) {
            return '';
        }
        [$localPart, $domain] = explode('@', $email, 2);
        $domain = strtolower(trim($domain));
        if ($domain === '') {
            return '';
        }
        $parts = explode('.', $domain);
        if (count($parts) < 2) {
            return $domain;
        }

        return implode('.', array_slice($parts, -2));
    }

    private function isPublicEmailDomain(string $domain): bool
    {
        if ($domain === '') {
            return false;
        }

        return in_array($domain, [
            'gmail.com',
            'yahoo.com',
            'comcast.net',
            'hotmail.com',
            'outlook.com',
            'aol.com',
            'icloud.com',
            'live.com',
            'msn.com',
            'me.com',
            'ymail.com',
            'att.net',
        ], true);
    }
}
