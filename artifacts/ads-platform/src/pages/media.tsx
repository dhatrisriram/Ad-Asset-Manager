import React, { useState } from "react";
import {
  useListMedia,
  useCreateMedia,
  useDeleteMedia,
  getListMediaQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Image as ImageIcon, Video, Trash2, Plus, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Media() {
  const qc = useQueryClient();
  const { data, isLoading } = useListMedia();
  const create = useCreateMedia();
  const remove = useDeleteMedia();

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"image" | "video">("image");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({
        data: { type, name, url, sizeBytes: 0 },
      });
      qc.invalidateQueries({ queryKey: getListMediaQueryKey() });
      toast.success("Asset added.");
      setOpen(false);
      setName("");
      setUrl("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add asset");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this asset?")) return;
    try {
      await remove.mutateAsync({ mediaId: id });
      qc.invalidateQueries({ queryKey: getListMediaQueryKey() });
      toast.success("Deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Media library</h2>
          <p className="text-muted-foreground">
            URL-referenced assets (R2-style storage). Paste a public URL to register an asset.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> Add asset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a media asset</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as "image" | "video")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="hero-banner.jpg"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">Public URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://cdn.example.com/banner.jpg"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Adding..." : "Add asset"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : !data || data.length === 0 ? (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No media assets yet</h3>
            <p className="text-muted-foreground mb-4">
              Add an image or video URL to use in your campaigns.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((m) => (
            <Card key={m.id} className="overflow-hidden">
              <div className="aspect-video bg-muted/50 flex items-center justify-center overflow-hidden">
                {m.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.url}
                    alt={m.name}
                    className="object-cover w-full h-full"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <Video className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
              <CardHeader>
                <CardTitle className="text-base truncate">{m.name}</CardTitle>
                <CardDescription className="capitalize">{m.type}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1 truncate max-w-[180px]"
                >
                  <Link2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{m.url}</span>
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(m.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
