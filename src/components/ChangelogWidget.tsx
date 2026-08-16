import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { listChangelog } from "@/lib/changelog.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

const LAST_SEEN_KEY = "cdt_changelog_last_seen";

interface Entry { id: string; title: string; summary: string; published: boolean; created_at: string; }

export function ChangelogWidget() {
  const listFn = useServerFn(listChangelog);
  const q = useQuery({ queryKey: ["changelog"], queryFn: () => listFn({}) });
  const entries = ((q.data ?? []) as Entry[]).filter((e) => e.published);

  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLastSeen(localStorage.getItem(LAST_SEEN_KEY));
  }, []);

  const unreadCount = lastSeen
    ? entries.filter((e) => new Date(e.created_at) > new Date(lastSeen)).length
    : entries.length;

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) {
      const now = new Date().toISOString();
      localStorage.setItem(LAST_SEEN_KEY, now);
      setLastSeen(now);
    }
  };

  if (entries.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full shadow-lg"
        >
          <Star className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-80 max-h-[70vh] overflow-y-auto p-0">
        <div className="p-3 border-b border-border">
          <h4 className="font-semibold text-sm">Novidades do site</h4>
        </div>
        <div className="divide-y divide-border">
          {entries.map((e) => (
            <div key={e.id} className="p-3">
              <p className="font-medium text-sm">{e.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{e.summary}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{new Date(e.created_at).toLocaleDateString("pt-BR")}</p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
