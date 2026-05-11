export type PushState = 'null' | 'queued' | 'pushed' | 'failed';

export type LeadPushRecord = {
  lead_id: number;
  company_name: string;
  source_order_id: string;
  erp_company_id: number | null;
  erp_order_id: number | null;
  erp_push_status: PushState;
  erp_last_error?: string | null;
  erp_pushed_at?: string | null;
  queued_at?: string | null;
  attempts: number;
  operator: string;
};

export const leadPushRecords: LeadPushRecord[] = [
  {
    lead_id: 1987,
    company_name: 'Orbit Freight Pvt Ltd',
    source_order_id: 'HB-2026-0412',
    erp_company_id: 101,
    erp_order_id: 900012,
    erp_push_status: 'pushed',
    erp_pushed_at: '2026-04-20T10:00:18Z',
    queued_at: '2026-04-20T09:59:55Z',
    attempts: 1,
    operator: 'ayesha.k@hb-leads',
  },
  {
    lead_id: 1990,
    company_name: 'BluePeak Textiles',
    source_order_id: 'HB-2026-0415',
    erp_company_id: 132,
    erp_order_id: 900013,
    erp_push_status: 'pushed',
    erp_pushed_at: '2026-04-21T09:45:40Z',
    queued_at: '2026-04-21T09:45:12Z',
    attempts: 1,
    operator: 'nadeem@hb-leads',
  },
  {
    lead_id: 1998,
    company_name: 'Zenith Agro Exports',
    source_order_id: 'HB-2026-0420',
    erp_company_id: 188,
    erp_order_id: 900014,
    erp_push_status: 'pushed',
    erp_pushed_at: '2026-04-22T11:10:44Z',
    queued_at: '2026-04-22T11:10:20Z',
    attempts: 2,
    operator: 'muneeb@hb-leads',
  },
  {
    lead_id: 2011,
    company_name: 'Orbit Freight Pvt Ltd',
    source_order_id: 'HB-2026-0489',
    erp_company_id: 101,
    erp_order_id: 900021,
    erp_push_status: 'pushed',
    erp_pushed_at: '2026-04-22T08:30:02Z',
    queued_at: '2026-04-22T08:29:48Z',
    attempts: 1,
    operator: 'ayesha.k@hb-leads',
  },
  {
    lead_id: 2023,
    company_name: 'BluePeak Textiles',
    source_order_id: 'HB-2026-0501',
    erp_company_id: 132,
    erp_order_id: 900029,
    erp_push_status: 'pushed',
    erp_pushed_at: '2026-04-23T06:50:11Z',
    queued_at: '2026-04-23T06:49:52Z',
    attempts: 1,
    operator: 'nadeem@hb-leads',
  },
  {
    lead_id: 2044,
    company_name: 'Orbit Freight Pvt Ltd',
    source_order_id: 'HB-2026-0512',
    erp_company_id: 101,
    erp_order_id: null,
    erp_push_status: 'queued',
    queued_at: '2026-04-23T07:12:44Z',
    attempts: 0,
    operator: 'ayesha.k@hb-leads',
  },
  {
    lead_id: 2055,
    company_name: 'NovaCore Logistics',
    source_order_id: 'HB-2026-0530',
    erp_company_id: 204,
    erp_order_id: 900051,
    erp_push_status: 'pushed',
    erp_pushed_at: '2026-04-21T13:20:48Z',
    queued_at: '2026-04-21T13:20:22Z',
    attempts: 1,
    operator: 'sara@hb-leads',
  },
  {
    lead_id: 2078,
    company_name: 'Harbor Metal Works',
    source_order_id: 'HB-2026-0554',
    erp_company_id: null,
    erp_order_id: null,
    erp_push_status: 'failed',
    erp_last_error: 'ERP responded 422 — billing_address_id invalid for company_id 999 (company not bound)',
    queued_at: '2026-04-23T08:02:18Z',
    attempts: 3,
    operator: 'faisal@hb-leads',
  },
  {
    lead_id: 2081,
    company_name: 'Greenline Pharma',
    source_order_id: 'HB-2026-0561',
    erp_company_id: null,
    erp_order_id: null,
    erp_push_status: 'failed',
    erp_last_error: 'Handoff token rejected — TTL exceeded',
    queued_at: '2026-04-23T06:41:52Z',
    attempts: 2,
    operator: 'ayesha.k@hb-leads',
  },
  {
    lead_id: 2096,
    company_name: 'Trident Packaging',
    source_order_id: 'HB-2026-0577',
    erp_company_id: null,
    erp_order_id: null,
    erp_push_status: 'null',
    attempts: 0,
    operator: 'nadeem@hb-leads',
  },
];
