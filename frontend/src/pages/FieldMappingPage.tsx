import { useMemo, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import {
  categoryLabels,
  fieldMappings,
  type FieldMapping,
  type MappingCategory,
} from '../data/fieldMapping';
import { Card, PageHeader, Pill } from '../components/ui';

const categoryOrder: MappingCategory[] = [
  'company',
  'billing_address',
  'pickup_address',
  'order_core',
  'order_value',
  'schedule',
  'attachments',
  'meta',
];

export default function FieldMappingPage() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'all' | MappingCategory>('all');

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return fieldMappings.filter((m) => {
      if (cat !== 'all' && m.category !== cat) return false;
      if (!query) return true;
      return (
        m.crm_source.toLowerCase().includes(query) ||
        m.erp_target.toLowerCase().includes(query) ||
        (m.notes ?? '').toLowerCase().includes(query)
      );
    });
  }, [q, cat]);

  const grouped = useMemo(() => {
    const map = new Map<MappingCategory, FieldMapping[]>();
    for (const f of filtered) {
      if (!map.has(f.category)) map.set(f.category, []);
      map.get(f.category)!.push(f);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Integration · Data Flow"
        title="Field Mapping"
        description="See how each CRM field maps to its ERP counterpart. Review required vs. optional fields and transformation notes."
      />

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-divider p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-divider bg-subtle px-3">
            <Search size={14} className="text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search source field, target column, or notes…"
              className="w-full bg-transparent py-2.5 text-sm text-fg outline-none placeholder:text-muted"
            />
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl border border-divider bg-subtle p-1">
            <button
              onClick={() => setCat('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                cat === 'all'
                  ? 'bg-accent text-white shadow-lg shadow-accent/30'
                  : 'text-muted hover:text-fg'
              }`}
            >
              All
            </button>
            {categoryOrder.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  cat === c
                    ? 'bg-accent text-white shadow-lg shadow-accent/30'
                    : 'text-muted hover:text-fg'
                }`}
              >
                {categoryLabels[c]}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-divider">
          {categoryOrder
            .filter((c) => grouped.has(c))
            .map((c) => (
              <section key={c} className="p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="label-mono">{categoryLabels[c]}</div>
                  <div className="h-px flex-1 bg-divider" />
                  <span className="text-xs text-muted">{grouped.get(c)!.length} fields</span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {grouped.get(c)!.map((m, idx) => (
                    <div
                      key={`${m.crm_source}-${idx}`}
                      className="rounded-2xl border border-divider bg-subtle p-4 transition-colors hover:bg-subtle-strong"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="label-mono">CRM source</div>
                          <div className="mt-1 font-mono text-xs text-fg">{m.crm_source}</div>
                        </div>
                        <ArrowRight size={14} className="mx-3 mt-6 text-accent" />
                        <div className="flex-1 text-right">
                          <div className="label-mono">ERP target</div>
                          <div className="mt-1 font-mono text-xs text-fg">{m.erp_target}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Pill tone={m.required ? 'accent' : 'neutral'}>
                          {m.required ? 'required' : 'optional'}
                        </Pill>
                        {m.notes ? (
                          <span className="text-[11px] text-muted">{m.notes}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
        </div>
      </Card>
    </div>
  );
}
