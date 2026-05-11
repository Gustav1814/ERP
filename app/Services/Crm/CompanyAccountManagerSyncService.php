<?php

namespace App\Services\Crm;

use App\Models\Crm\Company;
use App\Models\Crm\ErpOrder;

class CompanyAccountManagerSyncService
{
    public function propagateFromCompany(Company $company, string $accountManager): void
    {
        $accountManager = trim($accountManager);
        $normalized = $accountManager === '' ? null : $accountManager;

        if ((string) ($company->project_manager ?? '') !== (string) ($normalized ?? '')) {
            $company->forceFill(['project_manager' => $normalized])->save();
        }

        $this->writeAccountManagerToCompanyOrders((int) $company->id, $accountManager);
    }

    public function propagateFromOrder(ErpOrder $order, string $accountManager): void
    {
        $company = $order->company()->first();
        if (! $company) {
            return;
        }

        $this->propagateFromCompany($company, $accountManager);
    }

    public function seedOrderFromCompany(ErpOrder $order, Company $company): void
    {
        $accountManager = trim((string) ($company->project_manager ?? ''));
        if ($accountManager === '') {
            return;
        }

        $this->writeAccountManagerToOrder($order, $accountManager);
    }

    private function writeAccountManagerToCompanyOrders(int $companyId, string $accountManager): void
    {
        ErpOrder::query()
            ->where('company_id', $companyId)
            ->orderBy('id')
            ->chunkById(100, function ($orders) use ($accountManager) {
                foreach ($orders as $order) {
                    $this->writeAccountManagerToOrder($order, $accountManager);
                }
            });
    }

    private function writeAccountManagerToOrder(ErpOrder $order, string $accountManager): void
    {
        $payload = (array) ($order->crm_payload_json ?? []);
        $inventoryDetail = (array) ($payload['inventory_detail'] ?? []);
        if (trim((string) ($inventoryDetail['account_manager'] ?? '')) === $accountManager) {
            return;
        }

        $inventoryDetail['account_manager'] = $accountManager;
        $payload['inventory_detail'] = $inventoryDetail;
        $order->forceFill(['crm_payload_json' => $payload])->save();
    }
}
