"use client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
export function Chart({
  data,
  bar = false,
}: {
  data: { name: string; value: number }[];
  bar?: boolean;
}) {
  return (
    <div
      className="chart"
      style={bar ? { height: Math.max(230, data.length * 32) } : undefined}
      role="img"
      aria-label={data.map((d) => `${d.name}: ${d.value}`).join(", ")}
    >
      <ResponsiveContainer width="100%" height="100%">
        {bar ? (
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
          >
            <CartesianGrid stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              stroke="var(--muted)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              interval={0}
              stroke="var(--muted)"
              fontSize={11}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                color: "var(--text)",
              }}
              cursor={{ fill: "var(--hover)" }}
            />
            <Bar
              dataKey="value"
              fill="#ddbc60"
              radius={[0, 4, 4, 0]}
              barSize={15}
              isAnimationActive={false}
            />
          </BarChart>
        ) : (
          <AreaChart
            data={data}
            margin={{ top: 10, right: 15, bottom: 15, left: -20 }}
          >
            <defs>
              <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ddbc60" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ddbc60" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="var(--muted)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--muted)"
              fontSize={11}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                color: "var(--text)",
              }}
            />
            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey="value"
              stroke="#ddbc60"
              strokeWidth={2}
              fill="url(#goldFill)"
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
