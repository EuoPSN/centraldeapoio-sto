import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listImageLibrary } from "@/lib/imagelibrary.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DownloadImageButton } from "@/components/DownloadImageButton";
import { Search, Image as ImageIcon } from "lucide-react";
import { SkeletonCard } from "@/components/ui/skeleton-card";

export const Route = createFileRoute("/_authenticated/imagens")({
  component: Page,
});

interface ImageRow {
  id: string; title: string; image_url: string; image_ext: string;
  category: { id: string; name: string } | null;
}

function Page() {
  const fn = useServerFn(listImageLibrary);
  const q = useQuery({ queryKey: ["image-library"], queryFn: () => fn({}) });
  const [filter, setFilter] = useState("");
  const [activeFolder, setActiveFolder] = useState<string>("todas");

  const rows = (q.data ?? []) as unknown as ImageRow[];

  const folders = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => { if (r.category) map.set(r.category.id, r.category.name); });
    return Array.from(map.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    const n = filter.toLowerCase().trim();
    return rows.filter((r) => {
      if (activeFolder !== "todas" && r.category?.id !== activeFolder) return false;
      if (!n) return true;
      return r.title.toLowerCase().includes(n) || (r.category?.name ?? "").toLowerCase().includes(n);
    });
  }, [rows, filter, activeFolder]);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ImageIcon className="h-7 w-7 text-primary" /> Imagens
        </h1>
        <p className="text-muted-foreground mt-1">Biblioteca de imagens pra uso no atendimento (exames, especialidades, planos...).</p>
      </header>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por título ou pasta..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Button size="sm" variant={activeFolder === "todas" ? "default" : "outline"} onClick={() => setActiveFolder("todas")}>Todas as pastas</Button>
        {folders.map(([id, name]) => (
          <Button key={id} size="sm" variant={activeFolder === id ? "default" : "outline"} onClick={() => setActiveFolder(id)}>{name}</Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mb-3">{filtered.length} imagem(ns)</p>

      {q.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      )}
      {!q.isLoading && filtered.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">Nenhuma imagem encontrada.</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastre no Painel Admin → Biblioteca de Imagens.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((img) => (
          <Card key={img.id} className="overflow-hidden flex flex-col">
            <img src={img.image_url} alt={img.title} className="w-full h-48 object-cover" />
            <div className="p-3 space-y-2 flex-1 flex flex-col">
              <div>
                {img.category && <p className="text-xs uppercase tracking-wide text-primary font-medium">{img.category.name}</p>}
                <h3 className="font-semibold">{img.title}</h3>
              </div>
              <div className="mt-auto">
                <DownloadImageButton url={img.image_url} filename={`${img.title}.${img.image_ext || "jpg"}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
