"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { StatusBadge, processTone } from "@/components/clinical/status-badge"
import { DegradedNotice } from "@/components/clinical/states"
import type { HealthServicesResponse } from "@/types/dashboard"
import { AdminApiError, stopPollingOn403 } from "@/lib/admin/poll"

const POLL_MS = 15_000 // FR-HLT-1

async function fetchHealth(): Promise<HealthServicesResponse> {
  const res = await fetch("/api/admin/health")
  if (!res.ok) throw new AdminApiError(res.status)
  return res.json()
}

const NA = "—"

/**
 * T052's services table, live. `initial` is the page's own server-side
 * `getHealthServices()` call — first paint has real data, `useQuery` takes
 * over from the second 15s tick on.
 *
 * One responsive table with horizontal scroll below `md`, rather than the
 * queue page's card/table dual layout — ponytail: this console is a desk
 * tool, not a ward workflow, and a five-column ops table degrades fine to
 * scroll; the dual layout is worth its own extra code where phone use is the
 * primary case, not by default everywhere.
 */
export function HealthPoll({ initial }: { initial: HealthServicesResponse }) {
  const { data, isError } = useQuery({
    queryKey: ["admin", "health"],
    queryFn: fetchHealth,
    initialData: initial,
    refetchInterval: stopPollingOn403<HealthServicesResponse>(POLL_MS),
    // See overview-poll.tsx's identical comment -- a poll's next tick is
    // already the retry.
    retry: false,
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">Service health, refreshed every 15 seconds.</caption>
          <thead className="border-b bg-surface text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Service</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5 font-medium">p50</th>
              <th scope="col" className="px-4 py-2.5 font-medium">p95</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Throughput</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Error rate</th>
              <th scope="col" className="px-4 py-2.5 font-medium"><span className="sr-only">Detail</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.services.map((svc) => (
              <tr key={svc.id}>
                <td className="px-4 py-3 font-medium text-foreground">{svc.name}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={processTone(svc.status)} dot>
                    {svc.status === "operational" ? "Operational" : svc.status === "degraded" ? "Degraded" : "Unknown"}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{svc.p50_ms ?? NA}</td>
                <td className="px-4 py-3 text-muted-foreground">{svc.p95_ms ?? NA}</td>
                <td className="px-4 py-3 text-muted-foreground">{svc.throughput_rps ?? NA}</td>
                <td className="px-4 py-3 text-muted-foreground">{svc.error_rate ?? NA}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/dashboard/admin/health/${svc.id}`}
                    className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Detail<span className="sr-only"> for {svc.name}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        p95 target {data.p95_target_ms} ms{data.p95_latency_ms != null ? ` · current ${data.p95_latency_ms} ms` : ""}
      </p>
      {isError && (
        <DegradedNotice body="The live status refresh isn't reaching the server right now. The rows above are the last ones that loaded." />
      )}
    </div>
  )
}
