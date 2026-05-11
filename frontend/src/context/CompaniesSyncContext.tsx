import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { fetchJson } from '@/src/lib/api';
import { hydrateCompany } from '@/src/lib/hydrateCompany';
import { type Company } from '@/src/data/companies';

const CRM_OPTIONAL_MODE = String(import.meta.env.VITE_ERP_CRM_OPTIONAL ?? 'true').toLowerCase() === 'true';

/** Background refresh interval when the CRM tab is visible (ms). Override with VITE_ERP_COMPANIES_POLL_MS. */
const POLL_MS_RAW = Number(import.meta.env.VITE_ERP_COMPANIES_POLL_MS ?? '');
const POLL_MS = Number.isFinite(POLL_MS_RAW) && POLL_MS_RAW >= 15000 ? POLL_MS_RAW : 45000;

type RefreshOpts = {
  /** When true, no loading reset and errors do not clear the list (for polling). */
  silent?: boolean;
};

type CompaniesSyncContextValue = {
  companies: Company[];
  companiesLoaded: boolean;
  setCompanies: Dispatch<SetStateAction<Company[]>>;
  refreshCompanies: (opts?: RefreshOpts) => Promise<void>;
};

const CompaniesSyncContext = createContext<CompaniesSyncContextValue | null>(null);

export function CompaniesSyncProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);

  const refreshCompanies = useCallback(async (opts?: RefreshOpts) => {
    const silent = !!opts?.silent;
    if (!silent) {
      setCompaniesLoaded(false);
    }
    try {
      const json = await fetchJson('/api/v1/crm/companies?per_page=100');
      const rawCompanies = Array.isArray(json?.data) ? json.data : [];
      setCompanies(rawCompanies.map(hydrateCompany));
    } catch {
      if (!silent && !CRM_OPTIONAL_MODE) {
        setCompanies([]);
      }
    } finally {
      setCompaniesLoaded(true);
    }
  }, []);

  const refreshRef = useRef(refreshCompanies);
  refreshRef.current = refreshCompanies;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void refreshCompanies({ silent: false });
  }, [enabled, refreshCompanies]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      void refreshRef.current({ silent: true });
    };
    const id = window.setInterval(tick, POLL_MS);
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void refreshRef.current({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  const value = useMemo(
    () => ({
      companies,
      companiesLoaded,
      setCompanies,
      refreshCompanies,
    }),
    [companies, companiesLoaded, refreshCompanies],
  );

  return <CompaniesSyncContext.Provider value={value}>{children}</CompaniesSyncContext.Provider>;
}

export function useCompaniesSync(): CompaniesSyncContextValue {
  const ctx = useContext(CompaniesSyncContext);
  if (!ctx) {
    throw new Error('useCompaniesSync must be used within CompaniesSyncProvider');
  }
  return ctx;
}
