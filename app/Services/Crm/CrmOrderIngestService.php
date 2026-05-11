<?php

namespace App\Services\Crm;

use App\Models\Crm\Company;
use App\Models\Crm\CompanyAddress;
use App\Models\Crm\CompanyUser;
use App\Models\Crm\ErpOrder;
use App\Models\Crm\ErpOrderIdempotency;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CrmOrderIngestService
{
    public function ingest(array $payload, ?string $idempotencyKey = null): array
    {
        if ($idempotencyKey) {
            $existing = ErpOrderIdempotency::query()->where('key', $idempotencyKey)->first();
            if ($existing) {
                return $existing->response_json + ['duplicated' => true];
            }
        }

        $payload = $this->enrichPayloadWithCrmAddress($payload);

        $response = DB::transaction(function () use ($payload) {
            $mode = data_get($payload, 'company_binding.mode', 'new');

            [$company, $companyMode] = $this->resolveCompany($payload, $mode);
            $companyUser = $this->resolveCompanyUser($company, $payload);
            $billing = $this->resolveBillingAddress($company, $payload, $companyMode === 'created');
            $pickup = $this->resolvePickupAddress($company, $payload);
            if ($companyMode === 'created' && $billing === null && $pickup !== null) {
                $billing = $this->duplicateAddressAsBilling($pickup);
            }
            if ($companyUser && $pickup) {
                $companyUser->pickupAddresses()->syncWithoutDetaching([$pickup->id]);
            }

            $order = ErpOrder::query()->updateOrCreate(
                [
                    'source_system' => (string) data_get($payload, 'source.system', 'hb-leads-crm'),
                    'source_lead_id' => (int) data_get($payload, 'source.lead_id'),
                ],
                [
                    'company_id' => $company->id,
                    'company_user_id' => $companyUser?->id,
                    'billing_address_id' => $billing?->id,
                    'pickup_address_id' => $pickup?->id,
                    'source_order_id' => data_get($payload, 'source.order_id'),
                    'title' => data_get($payload, 'order.title'),
                    'type_of_equipment' => data_get($payload, 'order.type_of_equipment'),
                    'quantity' => data_get($payload, 'order.quantity'),
                    'estimate_value' => data_get($payload, 'order.estimate_value'),
                    'pickup_cost' => data_get($payload, 'order.pickup_cost'),
                    'pickup_cost_status' => data_get($payload, 'order.pickup_cost_status'),
                    'status' => data_get($payload, 'order.status', 'new'),
                    'qualify_status' => data_get($payload, 'order.qualify_status'),
                    'data_destruction_type' => data_get($payload, 'order.data_destruction_type'),
                    'message' => data_get($payload, 'order.message'),
                    'attachments_json' => data_get($payload, 'order.attachments', []),
                    'crm_payload_json' => $payload,
                    'start_date' => data_get($payload, 'schedule.start_date'),
                    'pickup_date' => data_get($payload, 'schedule.pickup_date'),
                ]
            );

            app(CompanyAccountManagerSyncService::class)->seedOrderFromCompany($order->fresh(), $company);

            return [
                'status' => 'ok',
                'company_mode' => $companyMode,
                'company_label' => $companyMode === 'created' ? 'new' : null,
                'erp_company_id' => $company->id,
                'erp_order_id' => $order->id,
                'duplicated' => false,
            ];
        });

        if ($idempotencyKey) {
            ErpOrderIdempotency::query()->create([
                'key' => $idempotencyKey,
                'erp_order_id' => $response['erp_order_id'],
                'response_json' => $response,
            ]);
        }

        return $response;
    }

    private function enrichPayloadWithCrmAddress(array $payload): array
    {
        $billingLine1 = trim((string) data_get($payload, 'addresses.billing.line1', ''));
        $pickupLine1 = trim((string) data_get($payload, 'addresses.pickup.line1', ''));

        if ($billingLine1 !== '' || $pickupLine1 !== '') {
            return $payload;
        }

        $leadId = (int) data_get($payload, 'source.lead_id');
        if ($leadId <= 0) {
            return $payload;
        }

        $baseUrl = rtrim((string) config('services.crm_source.base_url', ''), '/');
        $secret = (string) config('services.crm_source.secret', '');

        if ($baseUrl === '' || $secret === '') {
            return $payload;
        }

        try {
            $response = Http::timeout((int) config('services.crm_source.timeout_seconds', 8))
                ->acceptJson()
                ->withHeaders(['X-Handoff-Secret' => $secret])
                ->get("{$baseUrl}/api/v1/erp/leads/{$leadId}");

            if (! $response->successful()) {
                Log::warning('CRM lead snapshot request failed.', [
                    'lead_id' => $leadId,
                    'status' => $response->status(),
                ]);

                return $payload;
            }

            $lead = (array) $response->json('data', []);
            $line1 = trim((string) ($lead['address1'] ?? ''));
            if ($line1 === '') {
                return $payload;
            }

            $address = [
                'line1' => $line1,
                'line2' => (string) ($lead['address2'] ?? ''),
                'city' => (string) ($lead['city'] ?? ''),
                'state' => (string) ($lead['state'] ?? ''),
                'zip' => (string) ($lead['zip_code'] ?? ''),
                'country' => 'US',
            ];

            data_set($payload, 'addresses.billing', (array) data_get($payload, 'addresses.billing', $address));
            data_set($payload, 'addresses.pickup', (array) data_get($payload, 'addresses.pickup', $address));

            data_set($payload, 'company.name', (string) data_get($payload, 'company.name', $lead['company_name'] ?? ''));
            data_set($payload, 'company.primary_contact_name', (string) data_get($payload, 'company.primary_contact_name', $lead['name'] ?? ''));
            data_set($payload, 'company.primary_email', (string) data_get($payload, 'company.primary_email', $lead['email_address'] ?? ''));
            data_set($payload, 'company.primary_phone', (string) data_get($payload, 'company.primary_phone', $lead['phone_number'] ?? ''));
            data_set($payload, 'schedule.pickup_date', data_get($payload, 'schedule.pickup_date', $lead['pickup_date'] ?? null));
            data_set($payload, 'schedule.start_date', data_get($payload, 'schedule.start_date', $lead['start_date'] ?? null));
        } catch (\Throwable $e) {
            Log::warning('CRM lead snapshot enrichment failed.', [
                'lead_id' => $leadId,
                'message' => $e->getMessage(),
            ]);
        }

        return $payload;
    }

    private function resolveCompany(array $payload, string $mode): array
    {
        $requestedCompanyId = (int) data_get($payload, 'company_binding.existing_company_id');
        if ($mode === 'existing' && $requestedCompanyId > 0) {
            $companyId = (int) data_get($payload, 'company_binding.existing_company_id');
            $company = Company::query()->findOrFail($companyId);
            return [$company, 'bound'];
        }

        $companyName = trim((string) data_get($payload, 'company.name'));
        if ($companyName === '') {
            $companyName = trim((string) data_get($payload, 'company.primary_contact_name', 'Unknown CRM Company'));
        }
        $primaryEmail = strtolower(trim((string) data_get($payload, 'company.primary_email')));
        $emailDomain = $this->extractDomain($primaryEmail);
        $isPublicEmailDomain = $this->isPublicEmailDomain($emailDomain);

        $matchedByName = $this->findExistingCompanyByName($companyName);
        if ($matchedByName) {
            return [$matchedByName, 'bound'];
        }

        // Public mailbox domains should not bind by email/domain alone.
        $matchedCompany = $isPublicEmailDomain
            ? null
            : $this->findExistingCompanyByEmailDomain($primaryEmail);
        if ($matchedCompany) {
            return [$matchedCompany, 'bound'];
        }

        $company = Company::query()->create([
            'name' => $companyName,
            'primary_contact_name' => data_get($payload, 'company.primary_contact_name'),
            'project_manager' => data_get($payload, 'company.project_manager'),
            'primary_email' => data_get($payload, 'company.primary_email'),
            'primary_phone' => data_get($payload, 'company.primary_phone'),
            // Industry type is managed in ERP (not imported from CRM).
            'customer_type' => null,
            'lead_channel' => data_get($payload, 'company.lead_channel'),
            'hear_about_us' => data_get($payload, 'company.hear_about_us'),
            'is_new' => true,
        ]);

        return [$company, 'created'];
    }

    private function findExistingCompanyByName(string $companyName): ?Company
    {
        $normalized = strtolower(trim($companyName));
        if ($normalized === '' || $normalized === 'unknown crm company') {
            return null;
        }

        $exact = Company::query()
            ->whereRaw('LOWER(name) = ?', [$normalized])
            ->orderBy('id')
            ->first();
        if ($exact) {
            return $exact;
        }

        return Company::query()
            ->where('name', 'like', '%'.$companyName.'%')
            ->orderBy('id')
            ->first();
    }

    private function findExistingCompanyByEmailDomain(string $email): ?Company
    {
        if ($email !== '') {
            $exactEmail = Company::query()
                ->whereRaw('LOWER(primary_email) = ?', [$email])
                ->orderBy('id')
                ->first();
            if ($exactEmail) {
                return $exactEmail;
            }
        }

        $domain = $this->extractDomain($email);
        if ($domain === '') {
            return null;
        }

        return Company::query()
            ->whereNotNull('primary_email')
            ->whereRaw('LOWER(primary_email) LIKE ?', ['%@'.$domain])
            ->orderBy('id')
            ->first();
    }

    private function extractDomain(string $email): string
    {
        if (! str_contains($email, '@')) {
            return '';
        }

        [, $domain] = explode('@', strtolower(trim($email)), 2);

        return trim($domain);
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

    private function resolveBillingAddress(Company $company, array $payload, bool $shouldCreateFromPayload): ?CompanyAddress
    {
        $billingId = data_get($payload, 'company_binding.billing_address_id');
        if ($billingId) {
            $selected = CompanyAddress::query()
                ->where('company_id', $company->id)
                ->where('id', $billingId)
                ->first();
            if ($selected) {
                return $selected;
            }
        }

        if (! $shouldCreateFromPayload) {
            $firstExistingBilling = CompanyAddress::query()
                ->where('company_id', $company->id)
                ->where('kind', 'billing')
                ->orderBy('id')
                ->first();
            if ($firstExistingBilling) {
                return $firstExistingBilling;
            }

            // Existing company should not get a new billing address from order payload.
            return null;
        }

        $billingPayload = data_get($payload, 'addresses.billing');
        if (! is_array($billingPayload) || empty($billingPayload['line1'])) {
            return null;
        }

        return CompanyAddress::query()->create([
            'company_id' => $company->id,
            'kind' => 'billing',
            'line1' => (string) ($billingPayload['line1'] ?? ''),
            'line2' => $billingPayload['line2'] ?? null,
            'city' => (string) ($billingPayload['city'] ?? ''),
            'state' => (string) ($billingPayload['state'] ?? ''),
            'zip' => (string) ($billingPayload['zip'] ?? ''),
            'country' => (string) ($billingPayload['country'] ?? 'US'),
        ]);
    }

    private function resolvePickupAddress(Company $company, array $payload): ?CompanyAddress
    {
        $pickupPayload = data_get($payload, 'addresses.pickup');
        if (! is_array($pickupPayload) || empty($pickupPayload['line1'])) {
            // Default CRM address to pickup when explicit pickup block is absent.
            $pickupPayload = data_get($payload, 'addresses.billing');
        }
        if (! is_array($pickupPayload) || empty($pickupPayload['line1'])) {
            return null;
        }

        return CompanyAddress::query()->firstOrCreate(
            [
                'company_id' => $company->id,
                'kind' => 'pickup',
                'line1' => (string) ($pickupPayload['line1'] ?? ''),
                'city' => (string) ($pickupPayload['city'] ?? ''),
                'state' => (string) ($pickupPayload['state'] ?? ''),
                'zip' => (string) ($pickupPayload['zip'] ?? ''),
            ],
            [
                'line2' => $pickupPayload['line2'] ?? null,
                'country' => (string) ($pickupPayload['country'] ?? 'US'),
            ]
        );
    }

    private function duplicateAddressAsBilling(CompanyAddress $pickup): CompanyAddress
    {
        return CompanyAddress::query()->create([
            'company_id' => $pickup->company_id,
            'kind' => 'billing',
            'line1' => $pickup->line1,
            'line2' => $pickup->line2,
            'city' => $pickup->city,
            'state' => $pickup->state,
            'zip' => $pickup->zip,
            'country' => $pickup->country ?: 'US',
        ]);
    }

    private function resolveCompanyUser(Company $company, array $payload): ?CompanyUser
    {
        $name = trim((string) data_get($payload, 'company.primary_contact_name', ''));
        $email = strtolower(trim((string) data_get($payload, 'company.primary_email', '')));
        $phone = trim((string) data_get($payload, 'company.primary_phone', ''));

        $query = CompanyUser::query()->where('company_id', $company->id);

        if ($email !== '') {
            $byEmail = (clone $query)->whereRaw('LOWER(email) = ?', [$email])->first();
            if ($byEmail) {
                return $this->touchCompanyUser($byEmail, $name, $email, $phone);
            }
        }

        if ($phone !== '') {
            $byPhone = (clone $query)->where('phone', $phone)->first();
            if ($byPhone) {
                return $this->touchCompanyUser($byPhone, $name, $email, $phone);
            }
        }

        if ($name !== '') {
            $byName = (clone $query)->whereRaw('LOWER(name) = ?', [strtolower($name)])->first();
            if ($byName) {
                return $this->touchCompanyUser($byName, $name, $email, $phone);
            }
        }

        if ($name === '' && $email === '' && $phone === '') {
            return null;
        }

        return CompanyUser::query()->create([
            'company_id' => $company->id,
            'name' => $name !== '' ? $name : 'Primary Contact',
            'email' => $email !== '' ? $email : null,
            'phone' => $phone !== '' ? $phone : null,
            'role' => 'Primary Contact',
            'is_primary' => true,
        ]);
    }

    private function touchCompanyUser(CompanyUser $user, string $name, string $email, string $phone): CompanyUser
    {
        $user->update([
            'name' => $name !== '' ? $name : $user->name,
            'email' => $email !== '' ? $email : $user->email,
            'phone' => $phone !== '' ? $phone : $user->phone,
            'role' => $user->role ?: 'Primary Contact',
            'is_primary' => true,
        ]);

        return $user->fresh();
    }
}
