export const navItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'companies', label: 'Companies' },
  { id: 'orders', label: 'Orders' },
  { id: 'users', label: 'User Management', requireAnyPermission: ['users.manage', 'roles.manage'] },
  { id: 'activity', label: 'Activity Logs', requireAnyPermission: ['auditlogs.view'] },
  { id: 'settings', label: 'Settings' },
];

export const kpiCards = [
  {
    label: 'Active Companies',
    value: 156,
    delta: 12.4,
    suffix: '',
    points: [
      { y: 128 }, { y: 134 }, { y: 141 }, { y: 145 }, { y: 149 }, { y: 156 },
    ],
  },
  {
    label: 'Orders This Week',
    value: 847,
    delta: 8.2,
    suffix: '',
    points: [
      { y: 720 }, { y: 756 }, { y: 789 }, { y: 812 }, { y: 834 }, { y: 847 },
    ],
  },
  {
    label: 'Token Success Rate',
    value: 98.7,
    delta: 1.3,
    suffix: '%',
    points: [
      { y: 96.2 }, { y: 97.1 }, { y: 97.8 }, { y: 98.1 }, { y: 98.4 }, { y: 98.7 },
    ],
  },
  {
    label: 'Avg Processing Time',
    value: 1.2,
    delta: -15.4,
    suffix: 's',
    points: [
      { y: 1.8 }, { y: 1.6 }, { y: 1.5 }, { y: 1.4 }, { y: 1.3 }, { y: 1.2 },
    ],
  },
];

export const importFlowData = [
  { day: 'Mon', crm: 42, validated: 40, committed: 38 },
  { day: 'Tue', crm: 56, validated: 54, committed: 52 },
  { day: 'Wed', crm: 61, validated: 59, committed: 57 },
  { day: 'Thu', crm: 48, validated: 47, committed: 45 },
  { day: 'Fri', crm: 72, validated: 70, committed: 68 },
  { day: 'Sat', crm: 38, validated: 37, committed: 36 },
  { day: 'Sun', crm: 29, validated: 28, committed: 27 },
];

export const orderStatusData = [
  { name: 'Pending', value: 127, color: '#F59E0B' },
  { name: 'Processing', value: 89, color: '#8B5CF6' },
  { name: 'Completed', value: 631, color: '#10B981' },
];

export const tokenValidationData = [
  { hour: '00', valid: 12, expired: 1, invalid: 0 },
  { hour: '04', valid: 8, expired: 0, invalid: 0 },
  { hour: '08', valid: 45, expired: 2, invalid: 1 },
  { hour: '12', valid: 62, expired: 3, invalid: 1 },
  { hour: '16', valid: 58, expired: 2, invalid: 0 },
  { hour: '20', valid: 34, expired: 1, invalid: 0 },
];

export const recentImports = [
  { id: 'IMP-2847', company: 'Acme Corp', orders: 12, status: 'committed', time: '2m ago' },
  { id: 'IMP-2846', company: 'TechFlow Inc', orders: 8, status: 'validating', time: '5m ago' },
  { id: 'IMP-2845', company: 'Global Logistics', orders: 23, status: 'committed', time: '12m ago' },
  { id: 'IMP-2844', company: 'Metro Supply', orders: 5, status: 'pending', time: '18m ago' },
  { id: 'IMP-2843', company: 'Prime Retail', orders: 15, status: 'committed', time: '24m ago' },
];

export const idempotencyStats = {
  firstWrite: 342,
  replayHit: 18,
  inFlight: 3,
};

export const systemHealth = [
  { service: 'CRM Connection', status: 'healthy', latency: '45ms' },
  { service: 'Sortly SSO Bridge', status: 'healthy', latency: '62ms' },
  { service: 'Token Validator', status: 'healthy', latency: '12ms' },
  { service: 'Order Ingest API', status: 'healthy', latency: '89ms' },
];
