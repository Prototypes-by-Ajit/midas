"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

/**
 * Every recharts chart on /dashboard/analysis, in one module, so the route
 * lazy-loads recharts once. Charts only render once an analysis result exists,
 * so uploading is not blocked on the chunk.
 */

const TOOLTIP_STYLE = {
  backgroundColor: "#1f2937",
  border: "1px solid #374151",
  borderRadius: "8px",
} as const

const GRID = { strokeDasharray: "3 3", stroke: "#374151", opacity: 0.2 } as const

const percent = (value: number) => `${value.toFixed(1)}%`

export interface ColoredSlice {
  name?: string
  value: number
  color: string
}

export function ConfidenceDonut({ data }: { data: ColoredSlice[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={entry.name ?? index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => percent(value)} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function MetricsBar({
  data,
  height,
  fill,
  cellFills,
}: {
  data: { name: string; value: number }[]
  height: number
  /** Single fill for every bar. Ignored when `cellFills` is supplied. */
  fill?: string
  /** Per-bar fills, applied by index. */
  cellFills?: string[]
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="name" stroke="#9ca3af" />
        <YAxis stroke="#9ca3af" domain={[0, 100]} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => percent(value)} />
        <Bar dataKey="value" fill={cellFills ? undefined : fill} radius={[8, 8, 0, 0]}>
          {cellFills &&
            data.map((entry, index) => (
              <Cell key={entry.name} fill={cellFills[index % cellFills.length]} />
            ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
