import React, { useState } from "react";
import { useListAuditLogs, getListAuditLogsQueryKey } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollText, RefreshCw } from "lucide-react";

const LEVELS = ["all", "info", "warn", "error"] as const;

export default function Logs() {
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("all");
  const { data, isLoading, refetch, isFetching } = useListAuditLogs(
    { limit: 200 },
    { query: { queryKey: getListAuditLogsQueryKey({ limit: 200 }) } },
  );

  const filtered = (data ?? []).filter((l) =>
    level === "all" ? true : l.level === level,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Audit log</h2>
          <p className="text-muted-foreground">
            Every action across your account, in chronological order.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l} className="capitalize">
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
          <CardDescription>
            Showing {filtered.length} of {data?.length ?? 0} events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <ScrollText className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No log entries.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((l) => (
                <div
                  key={l.id}
                  className="grid grid-cols-[120px_70px_140px_1fr] items-start gap-3 py-2 border-b last:border-0 text-sm"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString()}
                  </span>
                  <Badge
                    variant={
                      l.level === "error"
                        ? "destructive"
                        : l.level === "warn"
                          ? "secondary"
                          : "outline"
                    }
                    className="justify-center text-xs"
                  >
                    {l.level}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground truncate">
                    {l.action}
                  </span>
                  <span>
                    {l.message}
                    {l.platformKey && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        [{l.platformKey}]
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
