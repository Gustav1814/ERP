import { type Company } from '@/src/data/companies';

export function accountManagerFromOrderPayload(
  payload: Record<string, unknown> | null | undefined,
): string {
  const detail = (payload?.inventory_detail ?? {}) as Record<string, unknown>;
  return String(detail.account_manager ?? '').trim();
}

export function withAccountManagerOnOrderPayload(
  payload: Record<string, unknown> | null | undefined,
  accountManager: string,
): Record<string, unknown> {
  const next = { ...(payload ?? {}) } as Record<string, unknown>;
  const detail = { ...((next.inventory_detail as Record<string, unknown>) ?? {}) };
  detail.account_manager = accountManager;
  next.inventory_detail = detail;
  return next;
}

export function applyAccountManagerToCompany(company: Company, accountManager: string): Company {
  const normalized = accountManager.trim();
  return {
    ...company,
    project_manager: normalized,
    orders: company.orders.map((order) => ({
      ...order,
      crm_payload_json: withAccountManagerOnOrderPayload(
        (order.crm_payload_json as Record<string, unknown> | null | undefined) ?? null,
        normalized,
      ),
    })),
  };
}
