import React, { useState, useMemo } from "react";
import {
  useListPlatformCatalog,
  useListPlatforms,
  useConnectPlatform,
  useDisconnectPlatform,
  useTestPlatformConnection,
  getListPlatformCatalogQueryKey,
  getListPlatformsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Plug, Activity, Trash2, Search } from "lucide-react";

const CATEGORIES = ["all", "social", "search", "video", "messaging", "marketplace"] as const;

interface CatalogItem {
  key: string;
  name: string;
  category: string;
  authType: string;
  textLimit: number;
  brandColor: string;
  connected: boolean;
  supportedCreatives: string[];
}

export default function Platforms() {
  const qc = useQueryClient();
  const { data: catalog, isLoading } = useListPlatformCatalog();
  const { data: connectedList } = useListPlatforms();
  const connect = useConnectPlatform();
  const disconnect = useDisconnectPlatform();
  const test = useTestPlatformConnection();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<CatalogItem | null>(null);
  const [accountLabel, setAccountLabel] = useState("");
  const [apiKey, setApiKey] = useState("");

  const filtered = useMemo(() => {
    return (catalog ?? []).filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [catalog, category, search]);

  const connectedById = useMemo(() => {
    const m = new Map<string, string>();
    (connectedList ?? []).forEach((p) => m.set(p.key, p.id));
    return m;
  }, [connectedList]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getListPlatformCatalogQueryKey() });
    qc.invalidateQueries({ queryKey: getListPlatformsQueryKey() });
  };

  const openConnect = (p: CatalogItem) => {
    setTarget(p);
    setAccountLabel(`${p.name} account`);
    setApiKey("");
    setOpen(true);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    try {
      await connect.mutateAsync({
        data: { key: target.key, accountLabel, apiKey: apiKey || null },
      });
      toast.success(`Connected ${target.name}.`);
      setOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connect failed");
    }
  };

  const handleDisconnect = async (key: string) => {
    const id = connectedById.get(key);
    if (!id) return;
    if (!confirm(`Disconnect ${key}?`)) return;
    try {
      await disconnect.mutateAsync({ platformId: id });
      toast.success("Disconnected.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Disconnect failed");
    }
  };

  const handleTest = async (key: string) => {
    const id = connectedById.get(key);
    if (!id) return;
    try {
      const res = await test.mutateAsync({ platformId: id });
      if (res.ok) toast.success(`${key}: ok (${res.latencyMs}ms)`);
      else toast.error(`${key}: ${res.message}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Platforms</h2>
        <p className="text-muted-foreground">
          Connect any of {catalog?.length ?? 16} ad networks. Adapter pattern — adding a new
          one is one file.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search networks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {CATEGORIES.map((c) => (
            <Button
              key={c}
              variant={category === c ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(c)}
              className="capitalize"
            >
              {c}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.key} className="relative overflow-hidden">
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: p.brandColor }}
              />
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{p.name}</CardTitle>
                    <CardDescription className="capitalize">
                      {p.category} · {p.authType}
                    </CardDescription>
                  </div>
                  {p.connected && (
                    <Badge className="shrink-0">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {p.supportedCreatives.map((c) => (
                    <Badge key={c} variant="outline" className="text-xs capitalize">
                      {c}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Body limit: {p.textLimit} chars
                </p>
                <div className="flex gap-2">
                  {p.connected ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleTest(p.key)}
                        disabled={test.isPending}
                      >
                        <Activity className="h-3.5 w-3.5 mr-1" /> Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnect(p.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => openConnect(p)}
                    >
                      <Plug className="h-3.5 w-3.5 mr-1" /> Connect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {target?.name}</DialogTitle>
            <DialogDescription>
              For this demo, any value works — credentials are stored in the KV cache, not in the database.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label">Account label</Label>
              <Input
                id="label"
                value={accountLabel}
                onChange={(e) => setAccountLabel(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key">
                {target?.authType === "oauth" ? "OAuth token" : "API key"} (optional)
              </Label>
              <Input
                id="key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Leave blank to use a mock value"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={connect.isPending}>
                {connect.isPending ? "Connecting..." : "Connect"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
