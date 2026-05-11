export type IdempotencyOutcome = 'first_write' | 'replay_hit' | 'in_flight';

export type IdempotencyEntry = {
  id: number;
  key: string;
  crm_lead_id: number;
  source_order_id: string;
  erp_order_id: number | null;
  outcome: IdempotencyOutcome;
  http_status: number;
  response_summary: string;
  replay_count: number;
  created_at: string;
  last_seen_at: string;
};

export const idempotencyEntries: IdempotencyEntry[] = [
  {
    id: 7012,
    key: 'crm-lead:1987:order:HB-2026-0412',
    crm_lead_id: 1987,
    source_order_id: 'HB-2026-0412',
    erp_order_id: 900012,
    outcome: 'first_write',
    http_status: 201,
    response_summary: 'Order created, bound to company 101',
    replay_count: 0,
    created_at: '2026-04-20T10:00:18Z',
    last_seen_at: '2026-04-20T10:00:18Z',
  },
  {
    id: 7018,
    key: 'crm-lead:1990:order:HB-2026-0415',
    crm_lead_id: 1990,
    source_order_id: 'HB-2026-0415',
    erp_order_id: 900013,
    outcome: 'first_write',
    http_status: 201,
    response_summary: 'Order created, bound to company 132',
    replay_count: 0,
    created_at: '2026-04-21T09:45:40Z',
    last_seen_at: '2026-04-21T09:45:40Z',
  },
  {
    id: 7019,
    key: 'crm-lead:1990:order:HB-2026-0415',
    crm_lead_id: 1990,
    source_order_id: 'HB-2026-0415',
    erp_order_id: 900013,
    outcome: 'replay_hit',
    http_status: 409,
    response_summary: 'Idempotency replay — returning cached body',
    replay_count: 2,
    created_at: '2026-04-21T09:46:04Z',
    last_seen_at: '2026-04-21T11:12:29Z',
  },
  {
    id: 7024,
    key: 'crm-lead:1998:order:HB-2026-0420',
    crm_lead_id: 1998,
    source_order_id: 'HB-2026-0420',
    erp_order_id: 900014,
    outcome: 'first_write',
    http_status: 201,
    response_summary: 'Order created, bound to company 188',
    replay_count: 0,
    created_at: '2026-04-22T11:10:44Z',
    last_seen_at: '2026-04-22T11:10:44Z',
  },
  {
    id: 7031,
    key: 'crm-lead:2011:order:HB-2026-0489',
    crm_lead_id: 2011,
    source_order_id: 'HB-2026-0489',
    erp_order_id: 900021,
    outcome: 'first_write',
    http_status: 201,
    response_summary: 'Order created, bound to company 101',
    replay_count: 0,
    created_at: '2026-04-22T08:30:02Z',
    last_seen_at: '2026-04-22T08:30:02Z',
  },
  {
    id: 7044,
    key: 'crm-lead:2023:order:HB-2026-0501',
    crm_lead_id: 2023,
    source_order_id: 'HB-2026-0501',
    erp_order_id: 900029,
    outcome: 'first_write',
    http_status: 201,
    response_summary: 'Order created, bound to company 132',
    replay_count: 0,
    created_at: '2026-04-23T06:50:11Z',
    last_seen_at: '2026-04-23T06:50:11Z',
  },
  {
    id: 7048,
    key: 'crm-lead:2023:order:HB-2026-0501',
    crm_lead_id: 2023,
    source_order_id: 'HB-2026-0501',
    erp_order_id: 900029,
    outcome: 'replay_hit',
    http_status: 409,
    response_summary: 'Idempotency replay — network retry',
    replay_count: 1,
    created_at: '2026-04-23T06:50:31Z',
    last_seen_at: '2026-04-23T06:50:31Z',
  },
  {
    id: 7055,
    key: 'crm-lead:2044:order:HB-2026-0512',
    crm_lead_id: 2044,
    source_order_id: 'HB-2026-0512',
    erp_order_id: null,
    outcome: 'in_flight',
    http_status: 202,
    response_summary: 'Queued — push in progress',
    replay_count: 0,
    created_at: '2026-04-23T07:12:44Z',
    last_seen_at: '2026-04-23T07:12:44Z',
  },
  {
    id: 7061,
    key: 'crm-lead:2055:order:HB-2026-0530',
    crm_lead_id: 2055,
    source_order_id: 'HB-2026-0530',
    erp_order_id: 900051,
    outcome: 'first_write',
    http_status: 201,
    response_summary: 'Order created, bound to company 204',
    replay_count: 0,
    created_at: '2026-04-21T13:20:48Z',
    last_seen_at: '2026-04-21T13:20:48Z',
  },
];
