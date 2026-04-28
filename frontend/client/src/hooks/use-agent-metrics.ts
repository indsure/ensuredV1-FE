import { useEffect, useMemo, useState } from "react"
import { format, startOfMonth, subMonths } from "date-fns"

import { supabase } from "@/lib/supabase"

export type AgentStats = {
  totalPolicies: number
  completed: number
  highRisk: number
  avgRiskScore: number | null
}

export type PerformancePoint = {
  name: string
  monthStart: Date
  resolved: number
  failed: number
}

export function useAgentMetrics(agentId: string | null | undefined) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<AgentStats>({
    totalPolicies: 0,
    completed: 0,
    highRisk: 0,
    avgRiskScore: null,
  })
  const [performance, setPerformance] = useState<PerformancePoint[]>([])

  const last6Months = useMemo(() => {
    const now = new Date()
    const months: PerformancePoint[] = []
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(now, i))
      months.push({
        name: format(d, "MMM"),
        monthStart: d,
        resolved: 0,
        failed: 0,
      })
    }
    return months
  }, [])

  async function refetch() {
    if (!agentId) return
    setLoading(true)
    setError(null)

    try {
      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5)).toISOString()
      const thirtyDaysAgo = subMonths(new Date(), 1).toISOString()

      const [qTotal, qCompleted, qHighRisk, qScores, qPerf] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("agent_id", agentId),
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("agent_id", agentId)
          .eq("status", "done"),
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("agent_id", agentId)
          .eq("status", "done")
          .gte("score", 70),
        supabase
          .from("clients")
          .select("score")
          .eq("agent_id", agentId)
          .eq("status", "done")
          .gte("created_at", thirtyDaysAgo),
        supabase
          .from("clients")
          .select("status, created_at")
          .eq("agent_id", agentId)
          .gte("created_at", sixMonthsAgo)
          .in("status", ["done", "error"]),
      ])

      if (qTotal.error) throw new Error(qTotal.error.message)
      if (qCompleted.error) throw new Error(qCompleted.error.message)
      if (qHighRisk.error) throw new Error(qHighRisk.error.message)
      if (qScores.error) throw new Error(qScores.error.message)
      if (qPerf.error) throw new Error(qPerf.error.message)

      const scores = (qScores.data ?? [])
        .map((r: any) => r.score)
        .filter((n: any) => typeof n === "number") as number[]
      const avgRiskScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null

      setStats({
        totalPolicies: qTotal.count ?? 0,
        completed: qCompleted.count ?? 0,
        highRisk: qHighRisk.count ?? 0,
        avgRiskScore,
      })

      const buckets = last6Months.map((m) => ({ ...m, resolved: 0, failed: 0 }))
      for (const row of qPerf.data ?? []) {
        const createdAt = new Date((row as any).created_at)
        const monthKey = format(createdAt, "yyyy-MM")
        const b = buckets.find((x) => format(x.monthStart, "yyyy-MM") === monthKey)
        if (!b) continue
        if ((row as any).status === "done") b.resolved++
        if ((row as any).status === "error") b.failed++
      }
      setPerformance(buckets)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId])

  return { loading, error, stats, performance, refetch }
}

