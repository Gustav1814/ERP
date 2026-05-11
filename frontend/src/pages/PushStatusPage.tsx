import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Play, RefreshCcw } from 'lucide-react';
import { leadPushRecords, type PushState } from '../data/pushStatus';
import { Card, Dot, KpiTile, PageHeader, Pill, TableShell, Td, Th } from '../components/ui';

const stateTone = (s: PushState) => {
  if (s === 'pushed') return 'emerald' as const;
  if (s === 'queued') return 'sky' as const;
  if (s === 'failed') return 'rose' as const;
  return 'neutral' as const;
};

function fmt(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

const STATE_NODES: { key: PushState; label: string; helper: string; tone: 'neutral' | 'sky' | 'emerald' | 'rose' }[] = [
  { key: 'null', label: 'null', helper: 'Never attempted', tone: 'neutral' },
  { key: 'queued', label: 'queued', helper: 'Waiting for retry / in progress', tone: 'sky' },
  { key: 'pushed', label: 'pushed', helper: 'ERP bound · success', tone: 'emerald' },
  { key: 'failed', label: 'failed', helper: 'Last attempt failed · retry available', tone: 'rose' },
];

export default function PushStatusPage() {
  const [filter, setFilter] = useState<'all' | PushState>('all');

  const list = useMemo(
    () => (filter === 'all' ? leadPushRecords : leadPushRecords.filter((r) => r.erp_push_status === filter)),
    [filter],
  );

  const counts = useMemo(() => {
    const base: Record<PushState, number> = { null: 0, queued: 0, pushed: 0, failed: 0 };
    for (const r of leadPushRecords) base[r.erp_push_status] += 1;
    return base;
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Integration · Sync Status"
        title="Push Status"
        description="Track how each lead progresses from CRM into the ERP system. Monitor queued, pushed, and failed states with retry capability."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Pushed"
          value={String(counts.pushed)}
          tone="emerald"
          icon={<CheckCircle2 size={14} />}
        />
        <KpiTile label="Queued" value={String(counts.queued)} tone="sky" icon={<Clock size={14} />} />
        <KpiTile
          label="Failed"
          value={String(counts.failed)}
          tone="rose"
          icon={<AlertTriangle size={14} />}
        />
        <KpiTile label="Never attempted" value={String(counts.null)} tone="neutral" />
      </div>

      {/* State machine */}
      <Card>
        <div className="label-mono">State machine</div>
        <h3 className="mt-1 font-display text-xl font-semibold">Lead lifecycle</h3>
        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-stretch">
          {STATE_NODES.map((node, idx) => (
            <div key={node.key} className="flex flex-1 items-stretch gap-3">
              <div
                className={`flex flex-1 flex-col rounded-2xl border p-4 ${
                  node.tone === 'neutral'
                    ? 'border-divider bg-subtle'
                    : node.tone === 'sky'
                      ? 'border-sky/30 bg-sky/10'
                      : node.tone === 'emerald'
                        ? 'border-emerald/30 bg-emerald/10'
                        : 'border-rose/30 bg-rose/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Dot tone={node.tone} />
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-fg">
                    {node.label}
                  </span>
                  <span className="ml-auto font-display text-lg font-semibold">
                    {counts[node.key]}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted">{node.helper}</p>
              </div>
              {idx < STATE_NODES.length - 1 ? (
                <div className="hidden items-center md:flex">
                  <div className="h-px w-6 bg-divider" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card padded={false}>
        <div className="flex items-center justify-between border-b border-divider p-4">
          <div>
            <div className="label-mono">Leads</div>
            <div className="mt-1 text-sm text-muted">Every CRM lead routed toward ERP.</div>
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl border border-divider bg-subtle p-1">
            {(['all', 'pushed', 'queued', 'failed', 'null'] as const).map((f) => (
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
              <Th>Lead · Order</Th>
              <Th>Company</Th>
              <Th>ERP binding</Th>
              <Th align="center">Attempts</Th>
              <Th>Status</Th>
              <Th>Timestamp</Th>
              <Th>Operator</Th>
              <Th align="right">Action</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.lead_id} className="border-t border-divider transition-colors hover:bg-subtle">
                <Td>
                  <div className="font-mono text-xs text-fg">#{r.lead_id}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted">{r.source_order_id}</div>
                </Td>
                <Td>
                  <span className="text-sm text-fg">{r.company_name}</span>
                </Td>
                <Td>
                  <div className="font-mono text-[11px] text-muted">
                    company {r.erp_company_id ?? '—'}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted">
                    order {r.erp_order_id ?? '—'}
                  </div>
                </Td>
                <Td align="center">
                  <span className="font-mono text-sm text-fg">{r.attempts}</span>
                </Td>
                <Td>
                  <Pill tone={stateTone(r.erp_push_status)}>
                    <Dot tone={stateTone(r.erp_push_status)} />
                    {r.erp_push_status}
                  </Pill>
                  {r.erp_last_error ? (
                    <div className="mt-1.5 text-[11px] text-rose/90">{r.erp_last_error}</div>
                  ) : null}
                </Td>
                <Td>
                  <div className="text-xs text-muted">
                    {r.erp_pushed_at ? `pushed ${fmt(r.erp_pushed_at)}` : `queued ${fmt(r.queued_at)}`}
                  </div>
                </Td>
                <Td>
                  <span className="font-mono text-[11px] text-muted">{r.operator}</span>
                </Td>
                <Td align="right">
                  {r.erp_push_status === 'failed' ? (
                    <button className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
                      <RefreshCcw size={12} /> Requeue
                    </button>
                  ) : r.erp_push_status === 'null' ? (
                    <button className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
                      <Play size={12} /> Push
                    </button>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </Card>
    </div>
  );
}
