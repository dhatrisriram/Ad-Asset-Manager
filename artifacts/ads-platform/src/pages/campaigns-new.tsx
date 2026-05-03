import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useListPlatformCatalog,
  useCreateCampaign,
  useGenerateAdCopy,
  useGetBudgetSuggestions,
  getListCampaignsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Wand2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

const OBJECTIVES = [
  { value: "awareness", label: "Awareness" },
  { value: "traffic", label: "Traffic" },
  { value: "engagement", label: "Engagement" },
  { value: "conversions", label: "Conversions" },
  { value: "leads", label: "Leads" },
  { value: "app_installs", label: "App installs" },
];

const TONES = ["bold", "friendly", "professional", "playful", "urgent"] as const;

export default function CampaignNew() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { data: catalog } = useListPlatformCatalog();
  const createMutation = useCreateCampaign();
  const generateCopy = useGenerateAdCopy();
  const budgetSuggest = useGetBudgetSuggestions();

  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("traffic");
  const [budget, setBudget] = useState("500");
  const [currency] = useState("USD");
  const [scheduleStart, setScheduleStart] = useState("");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [callToAction, setCallToAction] = useState("Learn more");
  const [creativeType, setCreativeType] = useState<"image" | "video" | "text" | "carousel">("text");
  const [mediaUrl, setMediaUrl] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [publishImmediately, setPublishImmediately] = useState(false);
  const [tone, setTone] = useState<(typeof TONES)[number]>("friendly");
  const [audience, setAudience] = useState("");

  const connected = useMemo(
    () => (catalog ?? []).filter((p) => p.connected),
    [catalog],
  );

  const togglePlatform = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const minTextLimit = useMemo(() => {
    if (selected.size === 0) return null;
    return Math.min(
      ...[...selected]
        .map((k) => (catalog ?? []).find((p) => p.key === k)?.textLimit ?? 1000),
    );
  }, [selected, catalog]);

  const handleGenerateCopy = async () => {
    if (!title || selected.size === 0) {
      toast.error("Add a campaign title and pick at least one platform first.");
      return;
    }
    try {
      const res = await generateCopy.mutateAsync({
        data: {
          product: title,
          audience: audience || "your customers",
          tone,
          platforms: [...selected],
        },
      });
      const first = res.variants[0];
      if (first) {
        setHeadline(first.headline);
        setBody(first.body);
        setCallToAction(first.callToAction);
        toast.success(`Generated copy for ${res.variants.length} platform(s).`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate copy");
    }
  };

  const handleSuggestBudget = async () => {
    if (selected.size === 0) {
      toast.error("Pick at least one platform first.");
      return;
    }
    try {
      const items = await budgetSuggest.mutateAsync({
        data: {
          totalBudget: Number(budget) || 1000,
          objective,
          platforms: [...selected],
        },
      });
      const top = items[0];
      if (top) {
        toast.success(
          `Top allocation: ${top.platformName} → $${top.suggestedBudget} (${top.sharePct}%)`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to suggest budget");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.size === 0) {
      toast.error("Select at least one platform to publish to.");
      return;
    }
    try {
      const created = await createMutation.mutateAsync({
        data: {
          title,
          objective,
          budget: Number(budget),
          currency,
          targetPlatforms: [...selected],
          scheduleStart: scheduleStart ? new Date(scheduleStart) : null,
          scheduleEnd: null,
          creative: {
            type: creativeType,
            headline,
            body,
            callToAction,
            mediaUrl: mediaUrl || null,
            mediaId: null,
          },
          publishImmediately,
        },
      });
      qc.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
      toast.success(
        publishImmediately ? "Campaign queued for publish." : "Draft saved.",
      );
      setLocation(`/campaigns/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create campaign");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">New Campaign</h2>
          <p className="text-muted-foreground">
            Create once, publish across {connected.length} connected platform
            {connected.length === 1 ? "" : "s"}.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basics</CardTitle>
              <CardDescription>What is this campaign about?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Campaign title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Spring product launch"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="objective">Objective</Label>
                  <Select value={objective} onValueChange={setObjective}>
                    <SelectTrigger id="objective">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OBJECTIVES.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget">Total budget (USD)</Label>
                  <Input
                    id="budget"
                    type="number"
                    min="1"
                    step="1"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule">Schedule start (optional)</Label>
                <Input
                  id="schedule"
                  type="datetime-local"
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Creative</CardTitle>
              <CardDescription>
                {minTextLimit
                  ? `Body limit (smallest target): ${minTextLimit} chars`
                  : "Pick platforms to see character limits."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Creative type</Label>
                  <Select
                    value={creativeType}
                    onValueChange={(v) => setCreativeType(v as typeof creativeType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="carousel">Carousel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cta">Call to action</Label>
                  <Input
                    id="cta"
                    value={callToAction}
                    onChange={(e) => setCallToAction(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="headline">Headline</Label>
                <Input
                  id="headline"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Make it punchy"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">
                  Body{" "}
                  <span className="text-xs text-muted-foreground">
                    {body.length}
                    {minTextLimit ? ` / ${minTextLimit}` : ""}
                  </span>
                </Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  placeholder="Tell people why they'll love it"
                  required
                />
              </div>
              {creativeType !== "text" && (
                <div className="space-y-2">
                  <Label htmlFor="media">Media URL</Label>
                  <Input
                    id="media"
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              )}
              <Separator />
              <div className="space-y-3 rounded-lg bg-muted/40 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">AI assist</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="audience" className="text-xs">
                      Audience
                    </Label>
                    <Input
                      id="audience"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      placeholder="busy parents"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Tone</Label>
                    <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TONES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateCopy}
                    disabled={generateCopy.isPending}
                  >
                    <Wand2 className="h-3.5 w-3.5 mr-1" />
                    Generate copy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSuggestBudget}
                    disabled={budgetSuggest.isPending}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    Suggest budget split
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Target platforms</CardTitle>
              <CardDescription>
                {selected.size} of {connected.length} selected
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {connected.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No platforms connected.{" "}
                  <Link href="/platforms" className="text-primary hover:underline">
                    Connect one →
                  </Link>
                </p>
              ) : (
                connected.map((p) => {
                  const isOn = selected.has(p.key);
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => togglePlatform(p.key)}
                      className={`w-full flex items-center justify-between rounded-md border p-3 text-left transition ${isOn ? "border-primary bg-primary/5" : "hover:bg-accent"}`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: p.brandColor }}
                        />
                        <div>
                          <div className="text-sm font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.textLimit} chars · {p.category}
                          </div>
                        </div>
                      </div>
                      {isOn && <Badge>Selected</Badge>}
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="publish-now" className="text-sm font-medium">
                    Publish immediately
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Otherwise saved as draft.
                  </p>
                </div>
                <Switch
                  id="publish-now"
                  checked={publishImmediately}
                  onCheckedChange={setPublishImmediately}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending
                  ? "Saving..."
                  : publishImmediately
                    ? "Create & publish"
                    : "Save draft"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
