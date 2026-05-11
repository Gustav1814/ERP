<?php

namespace App\Http\Controllers\Api\Crm;

use App\Http\Controllers\Controller;
use App\Models\Crm\Company;
use App\Models\Crm\CompanyAddress;
use App\Models\Crm\CompanyUser;
use App\Services\ActivityLogger;
use App\Services\Crm\CompanyAccountManagerSyncService;
use Illuminate\Http\Request;

class CompanyLookupController extends Controller
{
    public function search(Request $request)
    {
        $request->validate([
            'email' => ['nullable', 'string', 'max:150'],
            'phone' => ['nullable', 'string', 'max:50'],
            'company_name' => ['nullable', 'string', 'max:255'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        if (! $request->filled('email') && ! $request->filled('phone') && ! $request->filled('company_name')) {
            return response()->json([
                'status' => 'error',
                'message' => 'email, phone, or company_name is required.',
            ], 422);
        }

        $query = Company::query()->with(['addresses' => fn ($q) => $q->where('kind', 'billing')]);

        if ($request->filled('email')) {
            $query->where('primary_email', $request->string('email')->toString());
        }
        if ($request->filled('phone')) {
            $query->where('primary_phone', 'like', '%'.$request->string('phone')->toString().'%');
        }
        if ($request->filled('company_name')) {
            $query->where('name', 'like', '%'.$request->string('company_name')->toString().'%');
        }

        $matches = $query->limit((int) $request->input('limit', 10))->get()->map(function (Company $company) {
            $billing = $company->addresses->first();
            $summary = $billing
                ? trim(sprintf('%s, %s, %s %s', $billing->line1, $billing->city, $billing->state, $billing->zip), ', ')
                : null;
            return [
                'id' => $company->id,
                'name' => $company->name,
                'primary_email' => $company->primary_email,
                'primary_phone' => $company->primary_phone,
                'billing_address_summary' => $summary,
            ];
        });

        return response()->json(['status' => 'ok', 'matches' => $matches]);
    }

    public function index(Request $request)
    {
        $perPage = min(max((int) $request->input('per_page', 25), 1), 100);
        return Company::query()
            ->with(['addresses', 'orders.detailRows', 'users.pickupAddresses'])
            ->latest('id')
            ->paginate($perPage);
    }

    public function update(Request $request, Company $company)
    {
        $before = [
            'name' => (string) ($company->name ?? ''),
            'primary_contact_name' => (string) ($company->primary_contact_name ?? ''),
            'primary_email' => (string) ($company->primary_email ?? ''),
            'primary_phone' => (string) ($company->primary_phone ?? ''),
            'primary_contact_user_id' => (int) ($company->primary_contact_user_id ?? 0),
            'project_manager' => (string) ($company->project_manager ?? ''),
            'customer_type' => (string) ($company->customer_type ?? ''),
            'lead_channel' => (string) ($company->lead_channel ?? ''),
            'hear_about_us' => (string) ($company->hear_about_us ?? ''),
            'is_new' => (bool) ($company->is_new ?? false),
        ];

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'primary_contact_user_id' => ['nullable', 'integer', 'min:1', 'exists:company_users,id'],
            'primary_contact_name' => ['nullable', 'string', 'max:150'],
            'project_manager' => ['nullable', 'string', 'max:150'],
            'primary_email' => ['nullable', 'email', 'max:150'],
            'primary_phone' => ['nullable', 'string', 'max:50'],
            'is_new' => ['nullable', 'boolean'],
            'customer_type' => ['nullable', 'string', 'max:50'],
            'lead_channel' => ['nullable', 'string', 'max:50'],
            'hear_about_us' => ['nullable', 'string', 'max:100'],
            'addresses' => ['nullable', 'array'],
            'addresses.billing' => ['nullable', 'array'],
            'addresses.billing.line1' => ['nullable', 'string', 'max:200'],
            'addresses.billing.line2' => ['nullable', 'string', 'max:200'],
            'addresses.billing.city' => ['nullable', 'string', 'max:100'],
            'addresses.billing.state' => ['nullable', 'string', 'max:100'],
            'addresses.billing.zip' => ['nullable', 'string', 'max:20'],
            'addresses.billing.country' => ['nullable', 'string', 'max:2'],
            'addresses.pickups' => ['nullable', 'array'],
            'addresses.pickups.*.id' => ['nullable', 'integer', 'min:1'],
            'addresses.pickups.*.line1' => ['required_with:addresses.pickups', 'string', 'max:200'],
            'addresses.pickups.*.line2' => ['nullable', 'string', 'max:200'],
            'addresses.pickups.*.city' => ['required_with:addresses.pickups', 'string', 'max:100'],
            'addresses.pickups.*.state' => ['required_with:addresses.pickups', 'string', 'max:100'],
            'addresses.pickups.*.zip' => ['required_with:addresses.pickups', 'string', 'max:20'],
            'addresses.pickups.*.country' => ['nullable', 'string', 'max:2'],
            'users' => ['nullable', 'array'],
            'users.*.id' => ['required_with:users', 'integer', 'min:1'],
            'users.*.pickup_address_ids' => ['nullable', 'array'],
            'users.*.pickup_address_ids.*' => ['integer', 'min:1'],
        ]);

        if (array_key_exists('customer_type', $data) && $data['customer_type'] === null) {
            unset($data['customer_type']);
        }

        $selectedUserId = (int) ($data['primary_contact_user_id'] ?? 0);
        if ($selectedUserId > 0) {
            $selectedUser = CompanyUser::query()
                ->where('company_id', $company->id)
                ->where('id', $selectedUserId)
                ->first();

            if (! $selectedUser) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Selected primary contact user does not belong to this company.',
                ], 422);
            }

            $data['primary_contact_name'] = $selectedUser->name;
            $data['primary_email'] = $selectedUser->email;
            $data['primary_phone'] = $selectedUser->phone;
        } else {
            $data['primary_contact_user_id'] = null;
        }
        $company->update(collect($data)->except('addresses')->all());
        if (array_key_exists('project_manager', $data)) {
            app(CompanyAccountManagerSyncService::class)->propagateFromCompany(
                $company->fresh(),
                (string) ($data['project_manager'] ?? ''),
            );
        }
        // Only touch billing when the client explicitly sends addresses.billing so pickup-only
        // updates never overwrite billing (billing is set at company creation or via billing edit).
        if ($request->has('addresses.billing')) {
            $this->upsertAddress($company, 'billing', data_get($data, 'addresses.billing'));
        }
        $pickupAddressIds = $this->replacePickupAddresses($company, data_get($data, 'addresses.pickups'));
        $this->syncPrimaryUser($company);
        $this->syncUserPickupAssignments($company, data_get($data, 'users', []), $pickupAddressIds);

        $freshCompany = $company->fresh(['addresses', 'orders', 'users']);

        ActivityLogger::record(
            'companies.update',
            Company::class,
            (int) $company->id,
            [
                'name' => (string) $company->name,
                'before' => $before,
                'after' => [
                    'name' => (string) ($freshCompany->name ?? ''),
                    'primary_contact_name' => (string) ($freshCompany->primary_contact_name ?? ''),
                    'primary_email' => (string) ($freshCompany->primary_email ?? ''),
                    'primary_phone' => (string) ($freshCompany->primary_phone ?? ''),
                    'primary_contact_user_id' => (int) ($freshCompany->primary_contact_user_id ?? 0),
                    'project_manager' => (string) ($freshCompany->project_manager ?? ''),
                    'customer_type' => (string) ($freshCompany->customer_type ?? ''),
                    'lead_channel' => (string) ($freshCompany->lead_channel ?? ''),
                    'hear_about_us' => (string) ($freshCompany->hear_about_us ?? ''),
                    'is_new' => (bool) ($freshCompany->is_new ?? false),
                ],
            ],
            $request,
        );

        return response()->json([
            'status' => 'ok',
            'data' => $freshCompany,
        ]);
    }

    private function syncPrimaryUser(Company $company): void
    {
        $name = trim((string) ($company->primary_contact_name ?? ''));
        $email = strtolower(trim((string) ($company->primary_email ?? '')));
        $phone = trim((string) ($company->primary_phone ?? ''));

        if ($name === '' && $email === '' && $phone === '') {
            return;
        }

        $query = CompanyUser::query()->where('company_id', $company->id);
        $user = null;
        $preferredId = (int) ($company->primary_contact_user_id ?? 0);
        if ($preferredId > 0) {
            $user = (clone $query)->where('id', $preferredId)->first();
        }

        if (! $user && $email !== '') {
            $user = (clone $query)->whereRaw('LOWER(email) = ?', [$email])->first();
        }

        if (! $user && $phone !== '') {
            $user = (clone $query)->where('phone', $phone)->first();
        }

        if (! $user && $name !== '') {
            $user = (clone $query)->whereRaw('LOWER(name) = ?', [strtolower($name)])->first();
        }

        if (! $user) {
            CompanyUser::query()->create([
                'company_id' => $company->id,
                'name' => $name !== '' ? $name : 'Primary Contact',
                'email' => $email !== '' ? $email : null,
                'phone' => $phone !== '' ? $phone : null,
                'role' => 'Primary Contact',
                'is_primary' => true,
            ]);
            $createdUser = CompanyUser::query()
                ->where('company_id', $company->id)
                ->whereRaw('LOWER(name) = ?', [strtolower($name !== '' ? $name : 'Primary Contact')])
                ->latest('id')
                ->first();
            if ($createdUser && (int) $company->primary_contact_user_id !== (int) $createdUser->id) {
                $company->forceFill(['primary_contact_user_id' => $createdUser->id])->saveQuietly();
            }

            CompanyUser::query()
                ->where('company_id', $company->id)
                ->where('id', '!=', $createdUser?->id ?? 0)
                ->update(['is_primary' => false]);
            return;
        }

        $user->update([
            'name' => $name !== '' ? $name : $user->name,
            'email' => $email !== '' ? $email : $user->email,
            'phone' => $phone !== '' ? $phone : $user->phone,
            'role' => $user->role ?: 'Primary Contact',
            'is_primary' => true,
        ]);

        CompanyUser::query()
            ->where('company_id', $company->id)
            ->where('id', '!=', $user->id)
            ->update(['is_primary' => false]);

        if ((int) $company->primary_contact_user_id !== (int) $user->id) {
            $company->forceFill(['primary_contact_user_id' => $user->id])->saveQuietly();
        }
    }

    private function upsertAddress(Company $company, string $kind, mixed $payload): void
    {
        if (! is_array($payload) || trim((string) ($payload['line1'] ?? '')) === '') {
            return;
        }

        $address = CompanyAddress::query()
            ->where('company_id', $company->id)
            ->where('kind', $kind)
            ->orderBy('id')
            ->first();

        $data = [
            'company_id' => $company->id,
            'kind' => $kind,
            'line1' => (string) ($payload['line1'] ?? ''),
            'line2' => $payload['line2'] ?? null,
            'city' => (string) ($payload['city'] ?? ''),
            'state' => (string) ($payload['state'] ?? ''),
            'zip' => (string) ($payload['zip'] ?? ''),
            'country' => strtoupper((string) ($payload['country'] ?? 'US')),
        ];

        if ($address) {
            $address->update($data);
            return;
        }

        CompanyAddress::query()->create($data);
    }

    private function replacePickupAddresses(Company $company, mixed $pickups): array
    {
        if (! is_array($pickups)) {
            return CompanyAddress::query()
                ->where('company_id', $company->id)
                ->where('kind', 'pickup')
                ->pluck('id')
                ->all();
        }

        $cleanPickups = collect($pickups)
            ->filter(fn ($pickup) => is_array($pickup) && trim((string) ($pickup['line1'] ?? '')) !== '')
            ->values();

        $keptIds = [];
        foreach ($cleanPickups as $pickup) {
            $addressId = (int) ($pickup['id'] ?? 0);
            $address = null;
            if ($addressId > 0) {
                $address = CompanyAddress::query()
                    ->where('company_id', $company->id)
                    ->where('kind', 'pickup')
                    ->where('id', $addressId)
                    ->first();
            }

            $payload = [
                'company_id' => $company->id,
                'kind' => 'pickup',
                'line1' => (string) ($pickup['line1'] ?? ''),
                'line2' => $pickup['line2'] ?? null,
                'city' => (string) ($pickup['city'] ?? ''),
                'state' => (string) ($pickup['state'] ?? ''),
                'zip' => (string) ($pickup['zip'] ?? ''),
                'country' => strtoupper((string) ($pickup['country'] ?? 'US')),
            ];

            if ($address) {
                $address->update($payload);
                $keptIds[] = $address->id;
                continue;
            }

            $created = CompanyAddress::query()->create($payload);
            $keptIds[] = $created->id;
        }

        if ($keptIds !== []) {
            $lockedAddressIds = $company->orders()
                ->whereNotNull('pickup_address_id')
                ->pluck('pickup_address_id')
                ->map(fn ($id) => (int) $id)
                ->filter(fn ($id) => $id > 0)
                ->all();

            CompanyAddress::query()
                ->where('company_id', $company->id)
                ->where('kind', 'pickup')
                ->whereNotIn('id', $keptIds)
                ->whereNotIn('id', $lockedAddressIds)
                ->delete();
        }

        return $keptIds;
    }

    private function syncUserPickupAssignments(Company $company, mixed $usersPayload, array $allowedPickupIds): void
    {
        if (! is_array($usersPayload)) {
            return;
        }

        $allowedLookup = array_flip($allowedPickupIds);
        foreach ($usersPayload as $row) {
            if (! is_array($row)) {
                continue;
            }
            $userId = (int) ($row['id'] ?? 0);
            if ($userId <= 0) {
                continue;
            }
            $user = CompanyUser::query()
                ->where('company_id', $company->id)
                ->where('id', $userId)
                ->first();
            if (! $user) {
                continue;
            }
            $pickupIds = collect((array) ($row['pickup_address_ids'] ?? []))
                ->map(fn ($id) => (int) $id)
                ->filter(fn ($id) => $id > 0 && isset($allowedLookup[$id]))
                ->unique()
                ->values()
                ->all();
            $user->pickupAddresses()->sync($pickupIds);
        }
    }
}
