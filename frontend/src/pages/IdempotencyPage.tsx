import { useMemo, useState } from 'react';
import { Copy, RefreshCcw, ShieldCheck } from 'lucide-react';
import { idempotencyEntries, type IdempotencyEntry } from '../data/idempotency';
import { Card, Dot, KpiTile, PageHeader, Pill, TableShell, Td, Th } from '../components/ui';

const outcomeTone = (o: IdempotencyEntry['outcome']) => {
  if (o === 'first_write') return 'emerald' as const;
  if (o === 'replay_hit') return 'amber' as const;
  return 'sky' as const;
};

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

export default function IdempotencyPage() {
  const [filter, setFilter] = useState<'all' | IdempotencyEntry['outcome']>('all');

  const list = useMemo(
    () => (filter === 'all' ? idempotencyEntries : idempotencyEntries.filter((e) => e.outcome === filter)),
    [filter],
  );

  const stats = useMemo(() => {
    const total = idempotencyEntries.length;
    const firstWrite = idempotencyEntries.filter((e) => e.outcome === 'first_write').length;
    const replays = idempotencyEntries.reduce((a, e) => a + e.replay_count, 0);
    const inFlight = idempotencyEntries.filter((e) => e.outcome === 'in_flight').length;
    return { total, firstWrite, replays, inFlight };
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Data Integrity"
        title="Idempotency"
        description="Duplicate request protection ensures every order is processed exactly once. Replay attempts are safely blocked and logged."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Unique keys" value={String(stats.total)} tone="accent" />
        <KpiTile
          label="First writes"
          value={String(stats.firstWrite)}
          tone="emerald"
          icon={<ShieldCheck size={14} />}
        />
        <KpiTile
          label="Replays blocked"
          value={String(stats.replays)}
          tone="amber"
          icon={<RefreshCcw size={14} />}
        />
        <KpiTile label="In flight" value={String(stats.inFlight)} tone="sky" />
      </div>

      <Card padded={false}>
        <div className="flex items-center justify-between border-b border-divider p-4">
          <div>
            <div className="label-mono">Log</div>
            <div className="mt-1 text-sm text-muted">
              First-write events + 409 replays, most recent first.
            </div>
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl border border-divider bg-subtle p-1">
            {(['all', 'first_write', 'replay_hit', 'in_flight'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  filter === f
                    ? 'bg-accent text-white shadow-lg shadow-accent/30'
                    : 'text-muted hover:text-fg'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <TableShell>
          <thead>
            <tr>
              <Th>Key</Th>
              <Th>Lead · Order</Th>
              <Th>ERP Order</Th>
              <Th align="center">HTTP</Th>
              <Th>Response</Th>
              <Th align="right">Replays</Th>
              <Th>Outcome</Th>
              <Th>Last seen</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id} className="border-t border-divider transition-colors hover:bg-subtle">
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-fg">{e.key}</span>
                    <button
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-subtle-strong hover:text-fg"
                      title="Copy key"
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                </Td>
                <Td>
                  <div className="font-mono text-xs text-fg">#{e.crm_lead_id}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted">
                    {e.source_order_id}
                  </div>
                </Td>
                <Td>
                  {e.erp_order_id ? (
                    <span className="font-mono text-xs text-fg">#{e.erp_order_id}</span>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </Td>
                <Td align="center">
                  <span
                    className={`font-mono text-xs font-semibold ${
                      e.http_status >= 400
                        ? 'text-amber'
                        : e.http_status === 202
                          ? 'text-sky'
                          : 'text-emerald'
                    }`}
                  >
                    {e.http_status}
                  </span>
                </Td>
                <Td>
                  <span className="text-xs text-muted">{e.response_summary}</span>
                </Td>
                <Td align="right">
                  <span className="font-mono text-sm text-fg">{e.replay_count}</span>
                </Td>
                <Td>
                  <Pill tone={outcomeTone(e.outcome)}>
                    <Dot tone={outcomeTone(e.outcome)} />
                    {e.outcome.replace('_', ' ')}
                  </Pill>
                </Td>
                <Td>
                  <span className="text-xs text-muted">{fmt(e.last_seen_at)}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </Card>
    </div>
  );
}
