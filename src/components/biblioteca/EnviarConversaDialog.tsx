import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MarcianaEye } from "@/components/marciana/MarcianaEye";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { Overline } from "@/components/cliente-disse/shared";
import { FichaCampos } from "@/components/biblioteca/FichaForm";
import { enviarFicha, gerarFichaConversa, listObjecoesPublicadas, type GerarFichaResultado } from "@/lib/fichas.functions";
import { AVISO_PRIVACIDADE_FICHA, ERRO_FICHA, MAX_CARACTERES_CONVERSA, type CamposFicha, type FichaGerada } from "@/lib/fichas";
import { prepararConversaTxt } from "@/lib/cerebro";
import { cn } from "@/lib/utils";

export const FICHAS_RETOMADAS_KEY = ["fichas-das-retomadas"] as const;

/** Janela "Quer enviar esta conversa para a biblioteca?": anexa o .txt, a IA monta a ficha,
 * a pessoa revisa e envia para aprovação. O arquivo só existe aqui, em memória: nunca é guardado. */
export function EnviarConversaDialog({ aberto, onFechar, retomadaId = null, autorId = null, titulo, descricao, atendente = "", onEnviada }: {
  aberto: boolean;
  onFechar: () => void;
  retomadaId?: string | null;
  /** Só o Admin: atendente da venda. */
  autorId?: string | null;
  titulo: string;
  descricao: string;
  /** Nome de quem atende (para ler o formato do WhatsApp comum). */
  atendente?: string;
  onEnviada?: () => void;
}) {
  const qc = useQueryClient();
  const gerarFn = useServerFn(gerarFichaConversa);
  const enviarFn = useServerFn(enviarFicha);
  const objFn = useServerFn(listObjecoesPublicadas);
  const objecoes = useQuery({ queryKey: ["objecoes-publicadas"], queryFn: () => objFn({}), enabled: aberto, staleTime: 60_000 });

  const input = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<{ nome: string; texto: string; mensagens: number } | null>(null);
  const [ficha, setFicha] = useState<FichaGerada | null>(null);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);

  const limpar = () => { setArquivo(null); setFicha(null); setErro(null); };
  const fechar = () => { limpar(); onFechar(); };

  const gerar = useMutation({
    mutationFn: (texto: string): Promise<GerarFichaResultado> => gerarFn({ data: { texto, retomada_id: retomadaId, autor_id: autorId } }),
    onSuccess: (r) => {
      if (r.ok) { setFicha(r.ficha); setVersao((v) => v + 1); setErro(null); }
      else setErro(r.motivo === "erro" ? ERRO_FICHA : r.mensagem);
    },
    onError: () => setErro(ERRO_FICHA),
  });

  const enviar = useMutation({
    mutationFn: (f: FichaGerada) => enviarFn({ data: { ...f, retomada_id: retomadaId, autor_id: autorId } }),
    onSuccess: (r) => {
      if (!r.ok) { setErro(r.mensagem); return; }
      toast.success("Ficha enviada para aprovação.");
      qc.invalidateQueries({ queryKey: FICHAS_RETOMADAS_KEY });
      qc.invalidateQueries({ queryKey: ["admin-fichas"] });
      qc.invalidateQueries({ queryKey: ["admin-pending-counts"] });
      onEnviada?.();
      fechar();
    },
    onError: () => setErro("Não consegui enviar agora. Tente de novo."),
  });

  const ler = async (f: File | undefined) => {
    if (!f) return;
    setErro(null); setFicha(null);
    if (!/\.txt$/i.test(f.name) && f.type !== "text/plain") { setErro("Envie o arquivo .txt exportado da conversa."); return; }
    const texto = await f.text();
    if (texto.length > MAX_CARACTERES_CONVERSA) { setErro("Esse arquivo é grande demais. Exporte só a conversa dessa venda."); return; }
    const conv = prepararConversaTxt(texto, atendente);
    if (!conv.mensagens) { setErro("Não achei mensagens nesse arquivo. Envie o .txt exportado da conversa."); return; }
    setArquivo({ nome: f.name, texto, mensagens: conv.mensagens });
    gerar.mutate(texto);
  };

  const campos: CamposFicha | null = ficha;

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) fechar(); }}>
      <DialogContent className="max-h-[92vh] max-w-[560px] overflow-y-auto rounded-2xl border-line bg-surface p-6 sm:p-7">
        <DialogHeader className="space-y-2 pr-6 text-left">
          <DialogTitle className="text-[20px] font-semibold leading-7 text-ink">{titulo}</DialogTitle>
          <DialogDescription className="text-[14px] leading-5 text-ink-muted">{descricao}</DialogDescription>
        </DialogHeader>

        {!arquivo ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastando(false); void ler(e.dataTransfer.files[0]); }}
            className={cn("flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center", arrastando ? "border-gold bg-surface-2" : "border-line-strong")}
          >
            <Upload className="h-5 w-5 text-ink-muted" strokeWidth={1.5} aria-hidden />
            <p className="text-[14px] text-ink">Arraste o arquivo .txt da conversa ou</p>
            <OutlineButton type="button" className="h-9" onClick={() => input.current?.click()}>Anexar</OutlineButton>
            <input ref={input} type="file" accept=".txt,text/plain" className="sr-only" aria-label="Anexar conversa em .txt" onChange={(e) => { void ler(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-3.5 py-3 text-[14px]">
            <FileText className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0 truncate font-semibold text-ink">{arquivo.nome}</span>
            <span className="shrink-0 text-ink-muted">· {arquivo.mensagens} {arquivo.mensagens === 1 ? "mensagem" : "mensagens"}</span>
            <button type="button" onClick={limpar} className="ml-auto shrink-0 text-[13px] text-ink-muted hover:text-ink">Remover</button>
          </div>
        )}

        {gerar.isPending && (
          <div className="flex items-center gap-3 py-2" role="status" aria-live="polite">
            <MarcianaEye size={30} state="thinking" />
            <p className="text-[14px] text-ink-muted">Lendo a conversa e montando a ficha…</p>
          </div>
        )}

        {erro && (
          <div role="alert" className="space-y-2">
            <p className="text-[14px] text-ink">{erro}</p>
            {arquivo && !gerar.isPending && !ficha && (
              <OutlineButton type="button" className="h-9" onClick={() => gerar.mutate(arquivo.texto)}>Tentar de novo</OutlineButton>
            )}
          </div>
        )}

        {campos && (
          <>
            <Overline>Ficha gerada · revise antes de enviar</Overline>
            <FichaCampos
              key={versao}
              valor={campos}
              objecoes={objecoes.data ?? []}
              onChange={(v) => setFicha({ ...ficha!, ...v })}
              idBase="envio"
            />
          </>
        )}

        <p className="text-[12.5px] leading-5 text-ink-muted">{AVISO_PRIVACIDADE_FICHA}</p>

        <div className="flex flex-wrap gap-2">
          <GoldButton type="button" className="h-10" disabled={!ficha || enviar.isPending || gerar.isPending} onClick={() => ficha && enviar.mutate(ficha)}>
            {enviar.isPending ? "Enviando…" : "Enviar para aprovação"}
          </GoldButton>
          <OutlineButton type="button" className="h-10" onClick={fechar}>Agora não</OutlineButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
