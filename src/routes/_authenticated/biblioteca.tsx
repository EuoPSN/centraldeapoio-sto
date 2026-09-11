import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listImageLibrary } from "@/lib/imagelibrary.functions";
import { listPdfLibrary } from "@/lib/pdflibrary.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DownloadImageButton } from "@/components/DownloadImageButton";
import { Search, Image as ImageIcon, FileText } from "lucide-react";
import { SkeletonCard } from "@/components/ui/skeleton-card";

export const Route = createFileRoute("/_authenticated/biblioteca")({
  component: Page,
});

interface ImageRow {
  id: string; title: string; image_url: string; image_ext: string;
  category: { id: string; name: string } | null;
}
interface PdfRow {
  id: string; title: string; pdf_url: string; pdf_name: string | null;
  category: { id: string; name: string } | null;
}

// O visualizador de PDF embutido do Chrome tem um bug conhecido de ficar com a
// tela preta depois que a aba do navegador fica em segundo plano e volta. Forçamos
// o PDF a recarregar nesse momento específico pra contornar isso (mesma correção de Treinamentos).
function useReloadKeyOnTabReturn() {
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const handler = () => { if (document.visibilityState === "visible") setReloadKey((k) => k + 1); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);
  return reloadKey;
}

function Page() {
  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ImageIcon className="h-7 w-7 text-primary" /> Imagens
        </h1>
        <p className="text-muted-foreground mt-1">Biblioteca de imagens e PDFs pra uso no atendimento (exames, especialidades, planos...).</p>
      </header>

      <Tabs defaultValue="imagens">
        <TabsList className="mb-6">
          <TabsTrigger value="imagens" className="gap-1.5"><ImageIcon className="h-4 w-4" /> Imagens</TabsTrigger>
          <TabsTrigger value="pdfs" className="gap-1.5"><FileText className="h-4 w-4" /> PDFs</TabsTrigger>
        </TabsList>
        <TabsContent value="imagens"><ImagensSubPage /></TabsContent>
        <TabsContent value="pdfs"><PdfsSubPage /></TabsContent>
      </Tabs>
    </div>
  );
}

function ImagensSubPage() {
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
    <div>
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

function PdfsSubPage() {
  const fn = useServerFn(listPdfLibrary);
  const q = useQuery({ queryKey: ["pdf-library"], queryFn: () => fn({}), refetchOnWindowFocus: false, staleTime: 10 * 60 * 1000 });
  const [filter, setFilter] = useState("");
  const [activeFolder, setActiveFolder] = useState<string>("todas");
  const [openPdf, setOpenPdf] = useState<PdfRow | null>(null);
  const pdfReloadKey = useReloadKeyOnTabReturn();

  const rows = (q.data ?? []) as unknown as PdfRow[];

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
    <div>
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

      <p className="text-xs text-muted-foreground mb-3">{filtered.length} PDF(s)</p>

      {q.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      )}
      {!q.isLoading && filtered.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">Nenhum PDF encontrado.</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastre no Painel Admin → Biblioteca de Imagens → aba PDFs.</p>
        </Card>
      )}

      {!openPdf && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((pdf) => (
            <Card key={pdf.id} className="overflow-hidden flex flex-col cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setOpenPdf(pdf)}>
              <div className="h-40 flex items-center justify-center bg-muted/40">
                <FileText className="h-12 w-12 text-primary" />
              </div>
              <div className="p-3 space-y-1">
                {pdf.category && <p className="text-xs uppercase tracking-wide text-primary font-medium">{pdf.category.name}</p>}
                <h3 className="font-semibold">{pdf.title}</h3>
              </div>
            </Card>
          ))}
        </div>
      )}

      {openPdf && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Button size="sm" variant="outline" onClick={() => setOpenPdf(null)}>← Voltar pra lista</Button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground flex items-center gap-1"><FileText className="h-4 w-4" /> {openPdf.title}</span>
              <a href={openPdf.pdf_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Abrir em nova aba</a>
            </div>
          </div>
          <iframe
            key={`${openPdf.id}-${pdfReloadKey}`}
            src={`${openPdf.pdf_url}#toolbar=0&navpanes=0&view=FitH`}
            title={openPdf.pdf_name ?? openPdf.title}
            className="w-full h-[75vh] min-h-[560px] rounded-md border border-border"
          />
        </div>
      )}
    </div>
  );
}
