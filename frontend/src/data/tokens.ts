export type TokenStatus = 'consumed' | 'active' | 'rejected';

export type TokenRuleKey =
  | 'signature'
  | 'issuer'
  | 'audience'
  | 'subject'
  | 'ttl'
  | 'jti_replay'
  | 'nbf'
  | 'expected_lead_match'
  | 'payload_schema';

export type TokenRuleResult = {
  rule: TokenRuleKey;
  label: string;
  passed: boolean;
  note?: string;
};

export type HandoffToken = {
  jti: string;
  iss: string;
  aud: string;
  sub: string;
  lead_id: number;
  source_order_id: string;
  issued_at: string;
  expires_at: string;
  consumed_at?: string | null;
  ttl_seconds: number;
  status: TokenStatus;
  rejection_reason?: string | null;
  rules: TokenRuleResult[];
};

const rulePass = (rule: TokenRuleKey, label: string, note?: string): TokenRuleResult => ({
  rule,
  label,
  passed: true,
  note,
});

const ruleFail = (rule: TokenRuleKey, label: string, note: string): TokenRuleResult => ({
  rule,
  label,
  passed: false,
  note,
});

const fullPassingRules: TokenRuleResult[] = [
  rulePass('signature', 'Signature valid (RS256)'),
  rulePass('issuer', 'Issuer matches sortly-sso'),
  rulePass('audience', 'Audience matches new-erp'),
  rulePass('subject', 'Subject resolves to CRM operator'),
  rulePass('ttl', 'TTL within 15 minutes'),
  rulePass('nbf', 'not-before satisfied'),
  rulePass('jti_replay', 'jti not previously consumed'),
  rulePass('expected_lead_match', 'expected_lead_id matches CRM lead'),
  rulePass('payload_schema', 'Payload schema valid'),
];

export const tokens: HandoffToken[] = [
  {
    jti: '01JFX3WBRS4NK4M9JK0XC0A8TQ',
    iss: 'sortly-sso',
    aud: 'new-erp',
    sub: 'crm-user:201',
    lead_id: 1987,
    source_order_id: 'HB-2026-0412',
    issued_at: '2026-04-23T08:52:14Z',
    expires_at: '2026-04-23T09:07:14Z',
    consumed_at: '2026-04-23T08:54:02Z',
    ttl_seconds: 900,
    status: 'consumed',
    rules: fullPassingRules,
  },
  {
    jti: '01JFX41B3HPAMZ2CJ3KWRY2R0T',
    iss: 'sortly-sso',
    aud: 'new-erp',
    sub: 'crm-user:214',
    lead_id: 2011,
    source_order_id: 'HB-2026-0489',
    issued_at: '2026-04-23T09:11:02Z',
    expires_at: '2026-04-23T09:26:02Z',
    consumed_at: null,
    ttl_seconds: 900,
    status: 'active',
    rules: fullPassingRules,
  },
  {
    jti: '01JFX48K3ZBN5Y2NG6ZT8RDCWE',
    iss: 'sortly-sso',
    aud: 'new-erp',
    sub: 'crm-user:201',
    lead_id: 2044,
    source_order_id: 'HB-2026-0512',
    issued_at: '2026-04-23T06:41:51Z',
    expires_at: '2026-04-23T06:56:51Z',
    consumed_at: null,
    ttl_seconds: 900,
    status: 'rejected',
    rejection_reason: 'TTL exceeded — token older than 15 minutes',
    rules: [
      rulePass('signature', 'Signature valid (RS256)'),
      rulePass('issuer', 'Issuer matches sortly-sso'),
      rulePass('audience', 'Audience matches new-erp'),
      rulePass('subject', 'Subject resolves to CRM operator'),
      ruleFail('ttl', 'TTL within 15 minutes', 'Token age 18m 40s — exceeds 900s cap'),
      rulePass('nbf', 'not-before satisfied'),
      rulePass('jti_replay', 'jti not previously consumed'),
      rulePass('expected_lead_match', 'expected_lead_id matches CRM lead'),
      rulePass('payload_schema', 'Payload schema valid'),
    ],
  },
  {
    jti: '01JFX4B9G5TDR6C3V7XEZ0QV8P',
    iss: 'sortly-sso',
    aud: 'new-erp',
    sub: 'crm-user:214',
    lead_id: 2055,
    source_order_id: 'HB-2026-0530',
    issued_at: '2026-04-23T09:28:33Z',
    expires_at: '2026-04-23T09:43:33Z',
    consumed_at: '2026-04-23T09:29:11Z',
    ttl_seconds: 900,
    status: 'consumed',
    rules: fullPassingRules,
  },
  {
    jti: '01JFX4CNQ1XT2Y9W4VPB2ZHAKM',
    iss: 'sortly-sso',
    aud: 'new-erp',
    sub: 'crm-user:201',
    lead_id: 1990,
    source_order_id: 'HB-2026-0415',
    issued_at: '2026-04-23T07:03:12Z',
    expires_at: '2026-04-23T07:18:12Z',
    consumed_at: '2026-04-23T07:04:50Z',
    ttl_seconds: 900,
    status: 'consumed',
    rules: fullPassingRules,
  },
  {
    jti: '01JFX4EZ6R2ZMCN7WYJS4PQ3DG',
    iss: 'sortly-sso',
    aud: 'new-erp',
    sub: 'crm-user:221',
    lead_id: 1998,
    source_order_id: 'HB-2026-0420',
    issued_at: '2026-04-23T09:40:58Z',
    expires_at: '2026-04-23T09:55:58Z',
    consumed_at: null,
    ttl_seconds: 900,
    status: 'rejected',
    rejection_reason: 'jti already consumed at 09:41:22Z — replay detected',
    rules: [
      rulePass('signature', 'Signature valid (RS256)'),
      rulePass('issuer', 'Issuer matches sortly-sso'),
      rulePass('audience', 'Audience matches new-erp'),
      rulePass('subject', 'Subject resolves to CRM operator'),
      rulePass('ttl', 'TTL within 15 minutes'),
      rulePass('nbf', 'not-before satisfied'),
      ruleFail('jti_replay', 'jti not previously consumed', 'jti seen 42s ago'),
      rulePass('expected_lead_match', 'expected_lead_id matches CRM lead'),
      rulePass('payload_schema', 'Payload schema valid'),
    ],
  },
  {
    jti: '01JFX4GPD8MKRF3V2NYTQS1JU7',
    iss: 'sortly-sso',
    aud: 'new-erp',
    sub: 'crm-user:214',
    lead_id: 2023,
    source_order_id: 'HB-2026-0501',
    issued_at: '2026-04-23T06:12:10Z',
    expires_at: '2026-04-23T06:27:10Z',
    consumed_at: '2026-04-23T06:13:02Z',
    ttl_seconds: 900,
    status: 'consumed',
    rules: fullPassingRules,
  },
];
