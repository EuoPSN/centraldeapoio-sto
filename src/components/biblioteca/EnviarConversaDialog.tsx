import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { gerarFichaConversa, enviarFichaConversa, adminListAutores } from "@/lib/biblioteca.functions";
import { useQuery } from "@tanstack/react-query";
import { prepararConversaTxt, type ConversaPreparada } from "@/lib/cerebro";
import {
  AVISO_PRIVACIDADE_FICHA, ERRO_FICHA, PLANOS_FICHA, type FichaEnvio, type PlanoFicha,
} from "@/lib/biblioteca";
import { PONTOS, PONTO_LABEL, type Ponto } from "@/lib/retomada";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { ErroDiscreto, Overline, useClienteDisseBase } from "@/components/cliente-disse/shared";
import { MarcianaEye } from "@/components/marciana/MarcianaEye";
import { inputCls } from "@/components/admin/AdminListDetail";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { BIBLIOTECA_CONVERSAS_KEY, FICHAS_RETOMADAS_KEY } from "@/components/biblioteca/hooks";
import { cn } from "@/lib/utils";

// Janela "Fechou! Quer enviar esta conversa para a biblioteca?" (atendente, ao clicar Fechou
// na retomada) e "+ Enviar conversa" (Paulo, no Admin, com escolha do autor).
//
// O .txt é lido e limpo AQUI, no navegador. Só as mensagens já mascaradas vão para o
// servidor, que as usa em memória e descarta. Nada da conversa é guardado.

const MAX_BYTES = 5 * 1024 * 1024;
const OUTRA = "__outra__";

interface FichaEdit extends FichaEnvio { titulo: string }

export function EnviarConversaDialog({
  open, onOpenChange, atendente, retomada, comoAdmin, onEnviada,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Nome de quem atende (o WhatsApp comum não diz quem é o atendente). */
  atendente: string;
  retomada?: { id: string; primeiro_nome: string };
  /** Admin: escolhe o atendente da venda. */
  comoAdmin?: boolean;
  onEnviada?: () => void;
}) {
  const qc = useQueryClient();
  const gerarFn = useServerFn(gerarFichaConversa);
  const enviarFn = useServerFn(enviarFichaConversa);
  const autoresFn = useServerFn(adminListAutores);
  const base = useClienteDisseBase();
  const autores = useQuery({ queryKey: ["biblioteca-autores"], queryFn: () => autoresFn({}), enabled: !!comoAdmin && open, staleTime: 60_000 });
  const input = useRef<HTMLInputElement>(null);

  const [autorId, setAutorId] = useState("");
  const [arquivo, setArquivo] = useState<{ nome: string; prep: ConversaPreparada } | null>(null);
  const [ficha, setFicha] = useState<FichaEdit | null>(null);
  const [erro, setErro] = useState("");
  const [arrastando, setArrastando] = useState(false);

  const nomeAtendente = comoAdmin ? (autores.data?.find((a) => a.id === autorId)?.nome ?? "") : atendente;

  const reset = () => { setArquivo(null); setFicha(null); setErro(""); setAutorId(""); };
  const fechar = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

  const gerar = useMutation({
    mutationFn: async (prep: ConversaPreparada) => {
      const nomes = [...prep.nomesTrocados, ...(retomada?.primeiro_nome ? [retomada.primeiro_nome] : [])];
      return gerarFn({ data: { mensagens: prep.mensagensLimpas.slice(0, 1500), nomes } });
    },
    onSuccess: (r) => {
      if (!r.ok) { setErro(r.motivo === "erro" ? ERRO_FICHA : r.mensagem); return; }
      setErro("");
      setFicha(r.ficha);
    },
    onError: () => setErro(ERRO_FICHA),
  });

  const enviar = useMutation({
    mutationFn: async () => {
      if (!ficha || !arquivo) throw new Error("sem ficha");
      const { titulo, ...resto } = ficha;
      const campos = { ...resto, o_que_fez: resto.o_que_fez.map((x) => x.trim()).filter(Boolean) };
      const nomes = [...arquivo.prep.nomesTrocados, ...(retomada?.primeiro_nome ? [retomada.primeiro_nome] : [])];
      return enviarFn({ data: {
        ficha: campos, titulo, mensagens: arquivo.prep.mensagensLimpas.slice(0, 1500), nomes,
        retomada_id: retomada?.id ?? null, autor_id: comoAdmin && autorId ? autorId : null,
      } });
    },
    onSuccess: (r) => {
      if (!r.ok) { setErro(r.mensagem); return; }
      toast.success(comoAdmin ? "Ficha criada. Revise e publique em Conversas enviadas." : "Enviada para aprovação. Obrigada!");
      qc.invalidateQueries({ queryKey: FICHAS_RETOMADAS_KEY });
      qc.invalidateQueries({ queryKey: BIBLIOTECA_CONVERSAS_KEY });
      qc.invalidateQueries({ queryKey: ["admin-fichas"] });
      onEnviada?.();
      fechar(false);
    },
    onError: () => setErro("Não consegui enviar agora. Tente de novo."),
  });

  const lerArquivo = async (f: File) => {
    setErro("");
    if (comoAdmin && !autorId) { setErro("Escolha primeiro o atendente da venda."); return; }
    if (f.size > MAX_BYTES) { setErro("Arquivo grande demais."); return; }
    const prep = prepararConversaTxt(await f.text(), nomeAtendente, {
      marcadorNome: "[nome]",
      nomesExtras: retomada?.primeiro_nome ? [retomada.primeiro_nome] : [],
    });
    if (!prep.mensagens) { setErro("Não achei mensagens nesse arquivo."); return; }
    setArquivo({ nome: f.name, prep });
    setFicha(null);
    gerar.mutate(prep);
  };

  const objecoes = base.data?.objecoes ?? [];
  const set = <K extends keyof FichaEdit>(k: K, v: FichaEdit[K]) => setFicha((f) => (f ? { ...f, [k]: v } : f));
  const trabalhando = gerar.isPending || enviar.isPending;

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-h-[92vh] w-[min(600px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border-line bg-surface p-6">
        <DialogTitle className="pr-6 text-[20px] font-medium leading-7 text-ink">
          {comoAdmin ? "Enviar conversa de uma venda concluída" : "Fechou! 🎉 Quer enviar esta conversa para a biblioteca?"}
        </DialogTitle>
        <DialogDescription className="text-[14px] leading-5 text-ink-muted">
          {comoAdmin
            ? "Escolha quem fez a venda e anexe o .txt. A IA monta a ficha e você revisa antes de publicar."
            : "Ela ajuda os colegas que travam na mesma objeção. Você é a autora e o Paulo aprova antes de publicar."}
        </DialogDescription>

        {comoAdmin && (
          <label className="mt-1 block">
            <Overline className="mb-1 text-ink-muted">Atendente da venda (autor)</Overline>
            <select className={inputCls} value={autorId} onChange={(e) => setAutorId(e.target.value)} disabled={trabalhando || !!arquivo}>
              <option value="">Escolha…</option>
              {(autores.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </label>
        )}

        {/* Arquivo */}
        {arquivo ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-line-strong px-4 py-3 text-[14px]">
            <span className="min-w-0 truncate"><strong className="font-semibold text-ink">{arquivo.nome}</strong> <span className="text-ink-muted">· {arquivo.prep.mensagens} {arquivo.prep.mensagens === 1 ? "mensagem" : "mensagens"}</span></span>
            <button type="button" onClick={() => { setArquivo(null); setFicha(null); setErro(""); }} disabled={trabalhando} className="shrink-0 text-[13px] text-ink-muted hover:text-ink disabled:opacity-50">Remover</button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastando(false); const f = e.dataTransfer.files?.[0]; if (f) void lerArquivo(f); }}
            className={cn("flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-7 text-center", arrastando ? "border-gold bg-surface-2" : "border-line-strong")}
          >
            <p className="text-[14px] text-ink-muted">Arraste o .txt da conversa aqui (Ztalk ou WhatsApp).</p>
            <OutlineButton className="h-10 px-4" onClick={() => input.current?.click()}>Anexar .txt</OutlineButton>
          </div>
        )}
        <input ref={input} type="file" accept=".txt,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void lerArquivo(f); e.target.value = ""; }} />

        {gerar.isPending && (
          <div className="flex items-center gap-3 rounded-xl border border-line p-3 text-gold" aria-live="polite">
            <MarcianaEye size={26} state="thinking" />
            <p className="text-[14px] text-ink">Montando a ficha…</p>
          </div>
        )}

        {erro && (
          <div role="alert" className="space-y-2">
            <ErroDiscreto>{erro}</ErroDiscreto>
            {arquivo && !ficha && !gerar.isPending && (
              <OutlineButton className="h-9 px-3 text-[13.5px]" onClick={() => gerar.mutate(arquivo.prep)}>Tentar de novo</OutlineButton>
            )}
          </div>
        )}

        {ficha && (
          <div className="space-y-3">
            <Overline className="text-ink-muted">Ficha gerada · revise antes de enviar</Overline>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <Overline className="mb-1 text-ink-muted">Objeção</Overline>
                <select
                  className={inputCls}
                  value={ficha.objecao_id ?? (ficha.objecao_rotulo ? OUTRA : "")}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === OUTRA || v === "") setFicha((f) => f && { ...f, objecao_id: null });
                    else setFicha((f) => f && { ...f, objecao_id: v, objecao_rotulo: objecoes.find((o) => o.id === v)?.nome ?? f.objecao_rotulo });
                  }}
                >
                  <option value="">Nenhuma</option>
                  {objecoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  {!ficha.objecao_id && ficha.objecao_rotulo && <option value={OUTRA}>{ficha.objecao_rotulo}</option>}
                </select>
              </label>
              <label className="block">
                <Overline className="mb-1 text-ink-muted">Parou em</Overline>
                <select className={inputCls} value={ficha.ponto_parada} onChange={(e) => set("ponto_parada", e.target.value as Ponto)}>
                  {PONTOS.map((p) => <option key={p} value={p}>{PONTO_LABEL[p]}</option>)}
                </select>
              </label>
            </div>

            <label className="block">
              <Overline className="mb-1 text-ink-muted">O que você fez (um passo por linha)</Overline>
              <textarea className={cn(inputCls, "min-h-[84px]")} value={ficha.o_que_fez.join("\n")} onChange={(e) => set("o_que_fez", e.target.value.split("\n").map((l) => l.replace(/^\s*\d+[.)]\s*/, "")).filter((l, i, a) => l.trim() || i < a.length - 1))} />
            </label>

            <label className="block">
              <Overline className="mb-1 text-ink-muted">Mensagem-chave (seu texto, com [nome])</Overline>
              <textarea className={cn(inputCls, "min-h-[84px]")} value={ficha.mensagem_chave} onChange={(e) => set("mensagem_chave", e.target.value)} />
            </label>

            <details className="rounded-lg border border-line px-3 py-2 text-[13.5px]">
              <summary className="cursor-pointer font-medium text-ink">Ver o resto da ficha</summary>
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <Overline className="mb-1 text-ink-muted">Plano</Overline>
                    <select className={inputCls} value={ficha.plano} onChange={(e) => set("plano", e.target.value as PlanoFicha)}>
                      {PLANOS_FICHA.map((p) => <option key={p} value={p}>{p === "outro" ? "Outro" : p}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <Overline className="mb-1 text-ink-muted">Perfil do cliente</Overline>
                    <input className={inputCls} value={ficha.perfil_cliente} maxLength={160} onChange={(e) => set("perfil_cliente", e.target.value)} />
                  </label>
                </div>
                <label className="block">
                  <Overline className="mb-1 text-ink-muted">Onde travou (resumo, sem citar o cliente)</Overline>
                  <textarea className={cn(inputCls, "min-h-[64px]")} value={ficha.onde_travou} onChange={(e) => set("onde_travou", e.target.value)} />
                </label>
                <label className="block">
                  <Overline className="mb-1 text-ink-muted">Por que funcionou</Overline>
                  <textarea className={cn(inputCls, "min-h-[64px]")} value={ficha.por_que_funcionou} onChange={(e) => set("por_que_funcionou", e.target.value)} />
                </label>
                <p className="text-[12.5px] text-ink-muted">
                  {ficha.dias_ate_fechar == null ? "" : `Dias até fechar (calculado pelas datas da conversa): ${ficha.dias_ate_fechar}.`}
                </p>
              </div>
            </details>
          </div>
        )}

        <p className="text-[12.5px] leading-5 text-ink-muted">{AVISO_PRIVACIDADE_FICHA}</p>

        <div className="flex flex-wrap items-center gap-2">
          <GoldButton className="h-11 px-5" onClick={() => enviar.mutate()} disabled={!ficha || trabalhando}>
            {comoAdmin ? "Criar ficha" : "Enviar para aprovação"}
          </GoldButton>
          <OutlineButton className="h-11 px-4" onClick={() => fechar(false)} disabled={enviar.isPending}>
            {comoAdmin ? "Cancelar" : "Agora não"}
          </OutlineButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
