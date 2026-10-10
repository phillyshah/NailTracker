interface Bar {
  label: string;
  value: number;
}

interface Props {
  data: Bar[];
  height?: number; // px height of the plot area
  color?: string; // tailwind bg-* class for the bars
}

/**
 * Tiny dependency-free vertical bar chart. Bars scale to the largest value;
 * each shows its value on top and its label underneath. Good enough for the
 * monthly usage trend without pulling in a charting library.
 */
export function MiniBars({ data, height = 160, color = 'bg-primary-500' }: Props) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => {
          const h = Math.round((d.value / max) * 100);
          return (
            <div key={i} className="flex min-w-[2rem] flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs font-semibold text-gray-700">{d.value}</span>
              <div
                className={`w-full rounded-t-md ${color} transition-[height]`}
                style={{ height: `${Math.max(d.value > 0 ? 4 : 0, h)}%` }}
                title={`${d.label}: ${d.value}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-2">
        {data.map((d, i) => (
          <div key={i} className="min-w-[2rem] flex-1 text-center text-xs text-gray-500">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
