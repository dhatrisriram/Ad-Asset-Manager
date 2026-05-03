import React from "react";
import { Link } from "wouter";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useGetPlatformPerformance,
  getGetDashboardSummaryQueryKey,
  getGetRecentActivityQueryKey,
  getGetPlatformPerformanceQueryKey,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  DollarSign,
  Eye,
  MousePointer,
  TrendingUp,
  Plus,
  Activity,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  scheduled: "#0ea5e9",
  publishing: "#f59e0b",
  live: "#22c55e",
  partial: "#eab308",
  failed: "#ef4444",
  paused: "#a855f7",
};

export default function Dashboard() {
  const { data: summary, isLoading: l1 } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey(), refetchInterval: 5000 },
  });
  const { data: activity, isLoading: l2 } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey(), refetchInterval: 5000 },
  });
  const { data: perf, isLoading: l3 } = useGetPlatformPerformance({
    query: { queryKey: getGetPlatformPerformanceQueryKey(), refetchInterval: 5000 },
  });

  if (l1 || !summary) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Cross-platform performance, refreshed every 5s.
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" /> New campaign
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Total spend"
          value={`$${summary.totalSpend.toLocaleString()}`}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          hint={`${summary.connectedPlatforms} platforms connected`}
        />
        <Metric
          label="Impressions"
          value={summary.totalImpressions.toLocaleString()}
          icon={<Eye className="h-4 w-4 text-muted-foreground" />}
          hint={`${summary.liveCampaigns} live campaigns`}
        />
        <Metric
          label="Clicks"
          value={summary.totalClicks.toLocaleString()}
          icon={<MousePointer className="h-4 w-4 text-muted-foreground" />}
          hint={`CTR ${(summary.avgCtr * 100).toFixed(2)}%`}
        />
        <Metric
          label="Publish success"
          value={`${(summary.successRate * 100).toFixed(0)}%`}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          hint={`${summary.totalCampaigns} total campaigns`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Spend by platform</CardTitle>
            <CardDescription>Top performing networks this period.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {l3 ? (
                <Skeleton className="h-full w-full" />
              ) : !perf || perf.length === 0 ? (
                <EmptyChart message="No spend yet — publish a campaign to see data." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perf}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="platformName"
                      tick={{ fontSize: 11 }}
                      angle={-15}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number) => `$${v.toFixed(2)}`}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="spend" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Status breakdown</CardTitle>
            <CardDescription>Where your campaigns stand right now.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {summary.statusBreakdown.length === 0 ? (
                <EmptyChart message="No campaigns yet." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.statusBreakdown}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(e) => `${e.status} (${e.count})`}
                    >
                      {summary.statusBreakdown.map((entry) => (
                        <Cell
                          key={entry.status}
                          fill={STATUS_COLORS[entry.status] ?? "#64748b"}
                        />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Platform performance</CardTitle>
            <CardDescription>CPC, CTR, success rate by network.</CardDescription>
          </CardHeader>
          <CardContent>
            {l3 ? (
              <Skeleton className="h-32 w-full" />
            ) : !perf || perf.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {perf.map((p) => (
                  <div
                    key={p.platformKey}
                    className="grid grid-cols-[1fr_60px_60px_60px] items-center gap-3 py-2 border-b last:border-0 text-sm"
                  >
                    <span className="font-medium truncate">{p.platformName}</span>
                    <span className="text-right">
                      ${p.spend.toFixed(0)}
                    </span>
                    <span className="text-right text-muted-foreground">
                      {(p.ctr * 100).toFixed(2)}%
                    </span>
                    <Badge
                      variant={p.successRate >= 0.8 ? "default" : "destructive"}
                      className="justify-center text-xs"
                    >
                      {(p.successRate * 100).toFixed(0)}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" /> Recent activity
            </CardTitle>
            <CardDescription>Last 20 events across your account.</CardDescription>
          </CardHeader>
          <CardContent>
            {l2 ? (
              <Skeleton className="h-32 w-full" />
            ) : !activity || activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No activity yet — connect a platform or create a campaign.
              </p>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {activity.map((a) => (
                  <li key={a.id} className="text-sm border-b last:border-0 pb-2 last:pb-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {a.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1">{a.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
