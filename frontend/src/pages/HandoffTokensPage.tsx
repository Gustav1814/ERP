import { useMemo, useState } from 'react';
import { Check, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import { tokens, type HandoffToken } from '../data/tokens';
import { Card, Dot, KpiTile, PageHeader, Pill, TableShell, Td, Th } from '../components/ui';

const statusTone = (s: HandoffToken['status']) => {
  if (s === 'consumed') return 'emerald' as const;
  if (s === 'active') return 'cyan' as const;
  return 'rose' as const;
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

export default function HandoffTokensPage() {
  const [active, setActive] = useState<HandoffToken | null>(tokens[0]);
  const [filter, setFilter] = useState<'all' | HandoffToken['status']>('all');

  const list = useMemo(
    () => (filter === 'all' ? tokens : tokens.filter((t) => t.status === filter)),
    [filter],
  );

  const counts = useMemo(
    () => ({
      total: tokens.length,
      consumed: tokens.filter((t) => t.status === 'consumed').length,
      active: tokens.filter((t) => t.status === 'active').length,
      rejected: tokens.filter((t) => t.status === 'rejected').length,
    }),
    [],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Security · Authentication"
        title="Handoff Tokens"
        description="Secure authentication tokens used for system handoffs. Each token is validated against nine security rules before being consumed."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Total last 24h"
          value={String(counts.total)}
          tone="accent"
          icon={<KeyRound size={14} />}
        />
        <KpiTile
          label="Consumed"
          value={String(counts.consumed)}
          tone="emerald"
          icon={<ShieldCheck size={14} />}
        />
        <KpiTile label="Active (unused)" value={String(counts.active)} tone="cyan" />
        <KpiTile
          label="Rejected"
          value={String(counts.rejected)}
          tone="rose"
          icon={<ShieldAlert size={14} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-divider p-4">
            <div>
              <div className="label-mono">Tokens</div>
              <div className="mt-1 text-sm text-muted">
                Click any row to inspect the rule pipeline.
              </div>
            </div>
            <div className="flex flex-wrap gap-1 rounded-xl border border-divider bg-subtle p-1">
              {(['all', 'consumed', 'active', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    filter === f
                      ? 'bg-accent text-white shadow-lg shadow-accent/30'
                      : 'text-muted hover:text-fg'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <TableShell>
            <thead>
              <tr>
                <Th>jti</Th>
                <Th>Lead</Th>
                <Th>Subject</Th>
                <Th>Issued</Th>
                <Th>Expires</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr
                  key={t.jti}
                  onClick={() => setActive(t)}
                  className={`cursor-pointer border-t border-divider transition-colors ${
                    active?.jti === t.jti ? 'bg-accent/10' : 'hover:bg-subtle'
                  }`}
                >
                  <Td>
                    <span className="font-mono text-[11px] text-fg">{t.jti.slice(0, 14)}…</span>
                  </Td>
                  <Td>
                    <div className="font-mono text-xs text-fg">#{t.lead_id}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted">
                      {t.source_order_id}
                    </div>
                  </Td>
                  <Td>
                    <span className="font-mono text-[11px] text-muted">{t.sub}</span>
                  </Td>
                  <Td>
                    <span className="text-xs text-muted">{fmtTime(t.issued_at)}</span>
                  </Td>
                  <Td>
                    <span className="text-xs text-muted">{fmtTime(t.expires_at)}</span>
                  </Td>
                  <Td>
                    <Pill tone={statusTone(t.status)}>
                      <Dot tone={statusTone(t.status)} />
                      {t.status}
                    </Pill>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Card>

        {active ? <TokenInspector token={active} /> : null}
      </div>
    </div>
  );
}

function TokenInspector({ token }: { token: HandoffToken }) {
  return (
    <Card>
      <div className="label-mono">Validation pipeline</div>
      <h3 className="mt-1 font-display text-xl font-semibold">
        {token.jti.slice(0, 18)}…
      </h3>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <InfoRow label="issuer" value={token.iss} mono />
        <InfoRow label="audience" value={token.aud} mono />
        <InfoRow label="subject" value={token.sub} mono />
        <InfoRow label="ttl" value={`${token.ttl_seconds}s`} mono />
        <InfoRow label="iat" value={fmtTime(token.issued_at)} />
        <InfoRow label="exp" value={fmtTime(token.expires_at)} />
        <InfoRow
          label="consumed"
          value={token.consumed_at ? fmtTime(token.consumed_at) : '—'}
        />
        <InfoRow label="lead" value={`#${token.lead_id}`} mono />
      </div>

      {token.status === 'rejected' && token.rejection_reason ? (
        <div className="mt-5 rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-xs text-rose">
          {token.rejection_reason}
        </div>
      ) : null}

      <div className="mt-6 space-y-2">
        {token.rules.map((r) => (
          <div
            key={r.rule}
            className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${
              r.passed ? 'border-divider bg-subtle' : 'border-rose/30 bg-rose/10'
            }`}
          >
            <div
              className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ${
                r.passed ? 'bg-emerald/20 text-emerald' : 'bg-rose/20 text-rose'
              }`}
            >
              {r.passed ? <Check size={12} /> : '!'}
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium text-fg">{r.label}</div>
              {r.note ? <div className="mt-0.5 text-[11px] text-muted">{r.note}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-divider bg-subtle px-3 py-2">
      <div className="label-mono">{label}</div>
      <div className={`mt-1 ${mono ? 'font-mono' : ''} text-xs text-fg`}>{value}</div>
    </div>
  );
}
