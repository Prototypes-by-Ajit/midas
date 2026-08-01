import { LifeLine } from "@/components/ui/lifeline-loader"

/** Streamed by Suspense while a dashboard route resolves — no artificial delay. */
export default function DashboardLoading() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <LifeLine color="#3b82f6" size="medium" text="Loading..." textColor="#6b7280" />
    </div>
  )
}
