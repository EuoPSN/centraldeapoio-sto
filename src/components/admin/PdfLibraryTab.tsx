import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listPdfLibrary, upsertPdfLibraryItem, deletePdfLibraryItem } from "@/lib/pdflibrary.functions";
import { listCategories } from "@/lib/taxonomy.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Trash2, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

interface Cat { id: string; name: string; parent_id: string | null; }
interface Item {
  id: string; title: string; category_id: string | null; pdf_path: string; pdf_name: string | null;
  pdf_url: string; category: { id: string; name: string } | null;
}

export function PdfLibraryTab() {
  const list = useServerFn(listPdfLibrary);
  const upsert = useServerFn(upsertPdfLibraryItem);
  const del = useServerFn(deletePdfLibraryItem);
  const catFn = useServerFn(listCategories);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["pdf-library"], queryFn: () => list({}) });
  const catsQ = useQuery({ queryKey: ["cats", "pdf_library"], queryFn: () => catFn({ data: { scope: "pdf_library" } }) });

  const items = (q.data ?? []) as Item[];
  const folders = (catsQ.data ?? []).filter((c: Cat) => !c.parent_id) as Cat[];

  const [activeFolder, setActiveFolder] = useState<string>("todas");
  const filtered = activeFolder === "todas" ? items : items.filter((i) => i.category_id === activeFolder);

  const [edit, setEdit] = useState<null | { id?: string; title: string; category_id: string; pdf_path: string; pdf_name: string }>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    if (!edit) return;
    if (file.type !== "application/pdf") { toast.error("Envie um arquivo PDF."); return; }
    if (file.size > 30 * 1024 * 1024) { toast.error("PDF excede 30MB."); return; }
    setUploading(true);
    try {
      const path = `biblioteca-pdf/${crypto.randomUUID()}.pdf`;
      const { error } = await supabase.storage.from("knowledge-files").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setEdit((prev) => prev && { ...prev, pdf_path: path, pdf_name: file.name });
      toast.success("PDF enviado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload do PDF.");
    } finally {
      setUploading(false);
    }
  };

  const mUp = useMutation({
    mutationFn: () => upsert({ data: {
      id: edit!.id,
      category_id: edit!.category_id || null,
      title: edit!.title,
      pdf_path: edit!.pdf_path,
      pdf_name: edit!.pdf_name || null,
      position: 0,
    } }),
    onSuccess: () => { toast.success("Salvo."); setEdit(null); qc.invalidateQueries({ queryKey: ["pdf-library"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["pdf-library"] }); },
  });

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-border gap-3 flex-wrap">
          <h3 className="font-semibold">Biblioteca de PDFs ({items.length})</h3>
          <Button size="sm" className="gap-2" onClick={() => setEdit({ title: "", category_id: "", pdf_path: "", pdf_name: "" })}>
            <Plus className="h-4 w-4" /> Novo PDF
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap p-4 pb-0">
          <Button size="sm" variant={activeFolder === "todas" ? "default" : "outline"} onClick={() => setActiveFolder("todas")}>Todas</Button>
          {folders.map((f) => (
            <Button key={f.id} size="sm" variant={activeFolder === f.id ? "default" : "outline"} onClick={() => setActiveFolder(f.id)}>{f.name}</Button>
          ))}
          {folders.length === 0 && (
            <p className="text-xs text-muted-foreground self-center">Nenhuma pasta ainda — crie em Admin → Categorias → escopo "Biblioteca de PDFs".</p>
          )}
        </div>

        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full">Nenhum PDF nessa pasta ainda.</p>}
          {filtered.map((item) => (
            <Card key={item.id} className="overflow-hidden group relative">
              <div className="h-32 flex items-center justify-center bg-muted/40">
                <FileText className="h-10 w-10 text-primary" />
              </div>
              <div className="p-2 space-y-1">
                <p className="text-sm font-medium truncate">{item.title}</p>
                {item.category && <Badge variant="secondary" className="text-[10px]">{item.category.name}</Badge>}
              </div>
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => setEdit({
                  id: item.id, title: item.title, category_id: item.category_id ?? "", pdf_path: item.pdf_path, pdf_name: item.pdf_name ?? "",
                })}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => confirm("Excluir este PDF?") && mDel.mutate(item.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </Card>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar PDF" : "Novo PDF"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
              <div>
                <Label>Pasta</Label>
                <Select value={edit.category_id || "none"} onValueChange={(v) => setEdit({ ...edit, category_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— sem pasta —</SelectItem>
                    {folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>PDF</Label>
                {edit.pdf_name ? (
                  <div className="flex items-center justify-between gap-2 p-2 rounded border border-border mt-1">
                    <span className="text-sm flex items-center gap-1.5"><FileText className="h-4 w-4 text-primary" /> {edit.pdf_name}</span>
                    <Button size="sm" variant="ghost" onClick={() => setEdit({ ...edit, pdf_path: "", pdf_name: "" })}>Trocar</Button>
                  </div>
                ) : (
                  <label className="mt-1 flex items-center gap-2 justify-center border border-dashed border-border rounded-md p-4 cursor-pointer hover:bg-muted/40 text-sm text-muted-foreground">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    {uploading ? "Enviando..." : "Escolher PDF"}
                    <input type="file" accept="application/pdf" className="hidden" disabled={uploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                  </label>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => mUp.mutate()} disabled={mUp.isPending || !edit?.title || !edit?.pdf_path}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
