import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';

function CustomTooltip({ active, payload, t }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border px-2 py-1.5" style={{ backgroundColor: t.bgCard, borderColor: t.border }}>
      <div className="text-xs font-medium" style={{ color: t.text }}>
        {payload[0].value.toFixed(2)}
      </div>
    </div>
  );
}

export default function StatCard({ card, t }) {
  const positive = card.delta >= 0;
  const badgeBg = positive ? `${t.green}1F` : `${t.red}1F`;
  const badgeColor = positive ? t.green : t.red;

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ backgroundColor: t.bgCard, borderColor: t.border }}
    >
      <div className="metric-label" style={{ color: t.textSecondary }}>
        {card.label}
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div className="hero-number" style={{ color: t.text }}>
          {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
        </div>
        <div
          className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-semibold"
          style={{ backgroundColor: badgeBg, color: badgeColor }}
        >
          {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(card.delta).toFixed(2)}%
        </div>
      </div>

      <div className="mt-3 h-[72px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={card.points}>
            <Tooltip content={<CustomTooltip t={t} />} />
            <Area
              dataKey="y"
              type="monotone"
              stroke={t.accent}
              fill={t.accent}
              fillOpacity={0.12}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
