import React, { useState } from "react";
import { Link } from "wouter";
import {
  useListCampaigns,
  getListCampaignsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Megaphone, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_FILTERS = [
  "all",
  "draft",
  "scheduled",
  "publishing",
  "live",
  "partial",
  "failed",
] as const;

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  live: "default",
  publishing: "secondary",
  draft: "outline",
  scheduled: "outline",
  partial: "outline",
  failed: "destructive",
  paused: "outline",
};

export default function Campaigns() {
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const queryParams = filter === "all" ? undefined : { status: filter };
  const { data, isLoading } = useListCampaigns(queryParams, {
    query: { queryKey: getListCampaignsQueryKey(queryParams) },
  });

  const filtered = (data ?? []).filter((c) =>
    search ? c.title.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Campaigns</h2>
          <p className="text-muted-foreground">
            Build once, ship to many networks.
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Create campaign
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((s) => (
            <Button
              key={s}
              variant={filter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(s)}
              className="capitalize"
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !filtered || filtered.length === 0 ? (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No campaigns found</h3>
            <p className="text-muted-foreground mb-4">
              {search || filter !== "all"
                ? "Try a different filter or search term."
                : "Create your first campaign to get started."}
            </p>
            {!search && filter === "all" && (
              <Link href="/campaigns/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Create campaign
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <Card key={c.id} className="hover:bg-accent/30 transition-colors">
              <CardContent className="flex items-center justify-between p-5">
                <Link href={`/campaigns/${c.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg truncate hover:underline">
                      {c.title}
                    </h3>
                    <Badge
                      variant={statusVariant[c.status] ?? "outline"}
                      className="capitalize"
                    >
                      {c.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {c.objective} · ${c.budget.toLocaleString()} {c.currency} ·{" "}
                    {c.targetPlatforms.length} platform
                    {c.targetPlatforms.length === 1 ? "" : "s"}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.targetPlatforms.slice(0, 6).map((p) => (
                      <Badge key={p} variant="outline" className="text-xs">
                        {p}
                      </Badge>
                    ))}
                    {c.targetPlatforms.length > 6 && (
                      <Badge variant="outline" className="text-xs">
                        +{c.targetPlatforms.length - 6}
                      </Badge>
                    )}
                  </div>
                </Link>
                <div className="text-xs text-muted-foreground text-right shrink-0 ml-4">
                  {new Date(c.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
