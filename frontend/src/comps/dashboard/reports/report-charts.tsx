"use client"

import {
  Area,
  AreaChart,
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
 * Every recharts chart on /dashboard/reports, in one module.
 *
 * recharts is ~100 kB and was a static import in the route, so it sat in the
 * initial bundle even before any report existed to chart. Keeping all four here
 * means the route lazy-loads recharts exactly once, on demand.
 *
 * Charts render only when `reports.length > 0`, so on an empty account the
 * chunk is never fetched at all.
 */

const TOOLTIP_STYLE = {
  backgroundColor: "#1f2937",
  border: "1px solid #374151",
  borderRadius: "8px",
} as const

const GRID = { strokeDasharray: "3 3", stroke: "#374151", opacity: 0.2 } as const

export interface RiskSlice {
  name: string
  value: number
  color: string
}

export function RiskDistributionChart({ data }: { data: RiskSlice[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function ConfidenceChart({ data }: { data: { range: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="range" stroke="#9ca3af" fontSize={12} />
        <YAxis stroke="#9ca3af" fontSize={12} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#fff" }} />
        <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TimelineChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} />
        <YAxis stroke="#9ca3af" fontSize={12} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function DiagnosisChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid {...GRID} />
        <XAxis type="number" stroke="#9ca3af" />
        <YAxis dataKey="name" type="category" stroke="#9ca3af" width={150} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="value" fill="#10b981" radius={[0, 8, 8, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
