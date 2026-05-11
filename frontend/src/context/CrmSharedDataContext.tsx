import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchJson } from '@/src/lib/api';
import {
  inventoryTypeProfilesFromApiResponse,
  inventoryTypeWeightsFromApiResponse,
  type InventoryTypeProfile,
} from '@/src/lib/orderInventoryVolume';

const CRM_OPTIONAL_MODE = String(import.meta.env.VITE_ERP_CRM_OPTIONAL ?? 'true').toLowerCase() === 'true';

function parseNameList(json: unknown): string[] {
  if (!json || typeof json !== 'object') return [];
  const data = (json as { data?: unknown }).data;
  const rows = Array.isArray(data) ? data : [];
  return rows.map((item: { name?: string }) => String(item?.name ?? '').trim()).filter(Boolean);
}

export type CrmSharedDataContextValue = {
  /** True after the first catalog prefetch attempt (success or failure). */
  loaded: boolean;
  /** Raw inventory-types response for order detail device defaults. */
  inventoryTypesJson: unknown | null;
  inventoryWeightByType: Map<string, number>;
  inventoryProfiles: Map<string, InventoryTypeProfile>;
  serviceNames: string[];
  industryTypeNames: string[];
  pickupByNames: string[];
  accountManagerNames: string[];
  refresh: () => Promise<void>;
};

const CrmSharedDataContext = createContext<CrmSharedDataContextValue | null>(null);

export function CrmSharedDataProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [inventoryTypesJson, setInventoryTypesJson] = useState<unknown | null>(null);
  const [servicesJson, setServicesJson] = useState<unknown | null>(null);
  const [industryJson, setIndustryJson] = useState<unknown | null>(null);
  const [pickupJson, setPickupJson] = useState<unknown | null>(null);
  const [accountManagersJson, setAccountManagersJson] = useState<unknown | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const safeFetch = async (path: string) => {
      try {
        return await fetchJson(path);
      } catch {
        return null;
      }
    };

    try {
      const [inv, svc, ind, pickup, accountManagers] = await Promise.all([
        CRM_OPTIONAL_MODE
          ? safeFetch('/api/v1/crm/settings/inventory-types')
          : fetchJson('/api/v1/crm/settings/inventory-types'),
        CRM_OPTIONAL_MODE ? safeFetch('/api/v1/crm/settings/services') : fetchJson('/api/v1/crm/settings/services'),
        CRM_OPTIONAL_MODE
          ? safeFetch('/api/v1/crm/settings/industry-types')
          : fetchJson('/api/v1/crm/settings/industry-types'),
        CRM_OPTIONAL_MODE ? safeFetch('/api/v1/crm/settings/pickup-by') : fetchJson('/api/v1/crm/settings/pickup-by'),
        CRM_OPTIONAL_MODE
          ? safeFetch('/api/v1/crm/settings/account-managers')
          : fetchJson('/api/v1/crm/settings/account-managers'),
      ]);
      setInventoryTypesJson(inv ?? null);
      setServicesJson(svc ?? null);
      setIndustryJson(ind ?? null);
      setPickupJson(pickup ?? null);
      setAccountManagersJson(accountManagers ?? null);
    } catch {
      setInventoryTypesJson(null);
      setServicesJson(null);
      setIndustryJson(null);
      setPickupJson(null);
      setAccountManagersJson(null);
    } finally {
      setLoaded(true);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const inventoryWeightByType = useMemo(
    () => inventoryTypeWeightsFromApiResponse(inventoryTypesJson),
    [inventoryTypesJson],
  );

  const inventoryProfiles = useMemo(
    () => inventoryTypeProfilesFromApiResponse(inventoryTypesJson),
    [inventoryTypesJson],
  );

  const serviceNames = useMemo(() => parseNameList(servicesJson), [servicesJson]);
  const industryTypeNames = useMemo(() => parseNameList(industryJson), [industryJson]);
  const pickupByNames = useMemo(() => parseNameList(pickupJson), [pickupJson]);
  const accountManagerNames = useMemo(() => parseNameList(accountManagersJson), [accountManagersJson]);

  const value = useMemo(
    () =>
      ({
        loaded,
        inventoryTypesJson,
        inventoryWeightByType,
        inventoryProfiles,
        serviceNames,
        industryTypeNames,
        pickupByNames,
        accountManagerNames,
        refresh,
      }) satisfies CrmSharedDataContextValue,
    [
      loaded,
      inventoryTypesJson,
      inventoryWeightByType,
      inventoryProfiles,
      serviceNames,
      industryTypeNames,
      pickupByNames,
      accountManagerNames,
      refresh,
    ],
  );

  return <CrmSharedDataContext.Provider value={value}>{children}</CrmSharedDataContext.Provider>;
}

export function useCrmSharedData(): CrmSharedDataContextValue {
  const ctx = useContext(CrmSharedDataContext);
  if (!ctx) {
    throw new Error('useCrmSharedData must be used within CrmSharedDataProvider');
  }
  return ctx;
}
