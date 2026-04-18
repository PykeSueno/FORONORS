type MetricCardProps = {
  label: string;
  value: string;
  trend?: string;
};

export function MetricCard({ label, value, trend }: MetricCardProps) {
  return (
    <article className="glass-card p-5 smooth-hover">
      <p className="text-xs uppercase tracking-[0.18em] text-[#d9bea0]/75">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[#f8e6cf]">{value}</p>
      {trend ? <p className="mt-2 text-xs text-[#cfa980]">{trend}</p> : null}
    </article>
  );
}
