import React from "react";
import { Link, useParams, useLocation } from "wouter";
import {
  useGetCampaign,
  useRetryPublishJob,
  usePublishCampaign,
  useDuplicateCampaign,
  useDeleteCampaign,
  getGetCampaignQueryKey,
  getListCampaignsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Send, Copy, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  success: "default",
  live: "default",
  pending: "secondary",
  processing: "secondary",
  retrying: "outline",
  publishing: "secondary",
  failed: "destructive",
  draft: "outline",
  scheduled: "outline",
  partial: "outline",
  paused: "outline",
};

export default function CampaignDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const campaignId = params.id;
  const { data, isLoading, refetch } = useGetCampaign(campaignId, {
    query: { refetchInterval: 3000 },
  });
  const retryJob = useRetryPublishJob();
  const publishCampaign = usePublishCampaign();
  const duplicate = useDuplicateCampaign();
  const remove = useDeleteCampaign();

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  const { campaign, jobs, logs } = data;
  const totals = jobs.reduce(
    (acc, j) => {
      acc.impressions += j.impressions;
      acc.clicks += j.clicks;
      acc.spend += j.spend;
      return acc;
    },
    { impressions: 0, clicks: 0, spend: 0 },
  );

  const handleRetry = async (jobId: string) => {
    try {
      await retryJob.mutateAsync({ jobId });
      toast.success("Retry queued.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    }
  };

  const handlePublish = async () => {
    try {
      await publishCampaign.mutateAsync({
        data: { campaignId, platforms: campaign.targetPlatforms },
      });
      toast.success("Publish queued.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
    }
  };

  const handleDuplicate = async () => {
    try {
      const copy = await duplicate.mutateAsync({ campaignId });
      qc.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
      toast.success("Duplicated.");
      setLocation(`/campaigns/${copy.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Duplicate failed");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${campaign.title}"? This cannot be undone.`)) return;
    try {
      await remove.mutateAsync({ campaignId });
      qc.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
      qc.removeQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
      toast.success("Campaign deleted.");
      setLocation("/campaigns");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/campaigns">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Campaigns
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight">{campaign.title}</h2>
              <Badge variant={statusVariant[campaign.status] ?? "outline"}>
                {campaign.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {campaign.objective} · ${campaign.budget} {campaign.currency} · {campaign.targetPlatforms.length} platforms
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDuplicate}>
            <Copy className="h-4 w-4 mr-1" /> Duplicate
          </Button>
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={publishCampaign.isPending}
          >
            <Send className="h-4 w-4 mr-1" /> Publish now
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile label="Impressions" value={totals.impressions.toLocaleString()} />
        <MetricTile label="Clicks" value={totals.clicks.toLocaleString()} />
        <MetricTile
          label="CTR"
          value={
            totals.impressions
              ? `${((totals.clicks / totals.impressions) * 100).toFixed(2)}%`
              : "—"
          }
        />
        <MetricTile label="Spend" value={`$${totals.spend.toFixed(2)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Platform jobs</CardTitle>
            <CardDescription>
              One job per platform — auto-retried on failure (max 3 attempts).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No publish jobs yet. Click <strong>Publish now</strong> to push this campaign.
              </p>
            ) : (
              jobs.map((j) => (
                <div
                  key={j.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{j.platformName}</span>
                      <Badge
                        variant={statusVariant[j.status] ?? "outline"}
                        className="capitalize"
                      >
                        {j.status}
                      </Badge>
                      {j.attempts > 1 && (
                        <span className="text-xs text-muted-foreground">
                          {j.attempts} attempts
                        </span>
                      )}
                    </div>
                    {j.externalId && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <span>id: {j.externalId}</span>
                        {j.externalUrl && (
                          <a
                            href={j.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-primary inline-flex items-center"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                    {j.error && (
                      <div className="text-xs text-destructive">{j.error}</div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {j.impressions.toLocaleString()} imp · {j.clicks.toLocaleString()} clicks · ${j.spend.toFixed(2)}
                    </div>
                  </div>
                  {j.status === "failed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetry(j.id)}
                      disabled={retryJob.isPending}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Creative preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="outline" className="capitalize">
              {campaign.creative.type}
            </Badge>
            <div>
              <p className="font-semibold">{campaign.creative.headline}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {campaign.creative.body}
              </p>
            </div>
            {campaign.creative.callToAction && (
              <Button variant="default" size="sm" disabled className="w-full">
                {campaign.creative.callToAction}
              </Button>
            )}
            {campaign.creative.mediaUrl && (
              <div className="rounded-md border bg-muted/30 p-2 text-xs break-all">
                {campaign.creative.mediaUrl}
              </div>
            )}
            <Separator />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                Created {new Date(campaign.createdAt).toLocaleString()}
              </p>
              {campaign.scheduleStart && (
                <p>Scheduled {new Date(campaign.scheduleStart).toLocaleString()}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity log</CardTitle>
          <CardDescription>Latest 50 events for this campaign.</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {logs.map((l) => (
                <li
                  key={l.id}
                  className="flex items-start gap-3 text-sm border-b last:border-0 pb-2 last:pb-0"
                >
                  <Badge
                    variant={
                      l.level === "error"
                        ? "destructive"
                        : l.level === "warn"
                          ? "secondary"
                          : "outline"
                    }
                    className="text-xs"
                  >
                    {l.level}
                  </Badge>
                  <div className="flex-1">
                    <div className="font-mono text-xs text-muted-foreground">
                      {new Date(l.createdAt).toLocaleString()}
                      {l.platformKey ? ` · ${l.platformKey}` : ""}
                    </div>
                    <div>{l.message}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
