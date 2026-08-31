"use client"

import { useQuery } from "@tanstack/react-query"

import { DegradedNotice } from "@/components/clinical/states"
import type { OverviewResponse, OverviewTiles } from "@/types/dashboard"
import { AdminApiError, stopPollingOn403 } from "@/lib/admin/poll"

const POLL_MS = 30_000 // FR-OV-1

async function fetchOverview(): Promise<OverviewResponse> {
  const res = await fetch("/api/admin/overview")
  if (!res.ok) throw new AdminApiError(res.status)
  return res.json()
}

/**
 * T051's four tiles, live. The only client island on the Overview page --
 * everything else (the seven-panel grid, T051) stays server-rendered.
 *
 * `initialData` is what the page's own server-side `getOverview()` call
 * already fetched, so the first paint has real numbers with no loading
 * flash; `useQuery` only takes over from the second tick on.
 */
export function OverviewPoll({ initial }: { initial: OverviewResponse }) {
  const { data, isError } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: fetchOverview,
    initialData: initial,
    refetchInterval: stopPollingOn403<OverviewResponse>(POLL_MS),
    // A poll's own next tick already IS the retry -- React Query's default
    // retry: 3 would otherwise fire ~4 requests (and ~4 `refused` audit
    // rows, append-only, on a mid-session denial) before a settled error
    // ever reaches `stopPollingOn403`.
    retry: false,
  })

  const tiles = data.tiles

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Services operational" value={tiles.services_operational ?? "—"} />
        <Tile label="Open incidents" value={formatCount(tiles.open_incidents)} />
        <Tile label="Abstention rate (24h)" value={formatPercent(tiles.abstention_rate_24h)} />
        <Tile
          label="p95 latency"
          value={tiles.p95_latency_ms != null ? `${tiles.p95_latency_ms} ms` : "—"}
          hint={`Target ${data.p95_target_ms} ms`}
        />
      </div>
      {isError && (
        <DegradedNotice body="The live tile refresh isn't reaching the server right now. The values above are the last ones that loaded." />
      )}
    </div>
  )
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function formatCount(n: OverviewTiles["open_incidents"]) {
  return n == null ? "—" : n.toLocaleString()
}

function formatPercent(n: OverviewTiles["abstention_rate_24h"]) {
  return n == null ? "—" : `${(n * 100).toFixed(1)}%`
}
