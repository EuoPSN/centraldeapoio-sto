import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminApagarFicha, adminListAutoresFicha, adminListFichas, adminSalvarFicha, listObjecoesPublicadas, type FichaAdmin,
} from "@/lib/fichas.functions";
import { dataCurta, diasLabel, tituloFicha, type CamposFicha } from "@/lib/fichas";
import { PONTO_LABEL } from "@/lib/retomada";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GoldButton, OutlineButton } from "@/components/scripts/shared";
import { FichaCampos } from "@/components/biblioteca/FichaForm";
import { EnviarConversaDialog } from "@/components/biblioteca/EnviarConversaDialog";
import { AdminListDetail, DeleteLink, FieldLabel, FilterPill, ListRow, PanelEmpty, inputCls } from "@/components/admin/AdminListDetail";
import { BIBLIOTECA_CONVERSAS_KEY } from "@/components/biblioteca/ConversasQueFecharam";
import { cn } from "@/lib/utils";

const KEY = ["admin-fichas"] as const;
type Filtro = "enviada" | "publicada" | "recusada";
const FILTRO_LABEL: Record<Filtro, string> = { enviada: "Novas", publicada: "Publicadas", recusada: "Recusadas" };

/** Admin > Conversas enviadas: fichas que os atendentes enviaram ao clicar "Fechou". O Paulo revisa,
 * edita, aprova e publica (ou recusa com motivo). Aqui também despublica e edita as já publicadas. */
export function ConversasEnviadasAdminTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListFichas);
  const objFn = useServerFn(listObjecoesPublicadas);
  const q = useQuery({ queryKey: KEY, queryFn: () => listFn({}) });
  const objecoes = useQuery({ queryKey: ["objecoes-publicadas"], queryFn: () => objFn({}), staleTime: 60_000 });
  const [filtro, setFiltro] = useState<Filtro>("enviada");
  const [selId, setSelId] = useState<string | null>(null);
  const [enviar, setEnviar] = useState(false);

  const todas = q.data ?? [];
  const lista = useMemo(() => todas.filter((f) => f.status === filtro), [todas, filtro]);
  const n = (s: Filtro) => todas.filter((f) => f.status === s).length;
  const sel = todas.find((f) => f.id === selId) ?? null;

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: BIBLIOTECA_CONVERSAS_KEY });
    qc.invalidateQueries({ queryKey: ["admin-pending-counts"] });
    qc.invalidateQueries({ queryKey: ["fichas-das-retomadas"] });
  };

  return (
    <>
      <AdminListDetail
        title="Conversas enviadas"
        subtitle="Fichas que os atendentes enviaram ao clicar Fechou. Revise antes de publicar."
        actions={<OutlineButton type="button" className="h-9 text-[14px]" onClick={() => setEnviar(true)}>+ Enviar conversa</OutlineButton>}
        filters={(Object.keys(FILTRO_LABEL) as Filtro[]).map((s) => (
          <FilterPill key={s} active={filtro === s} onClick={() => { setFiltro(s); setSelId(null); }}>{FILTRO_LABEL[s]}{n(s) ? ` · ${n(s)}` : ""}</FilterPill>
        ))}
        panel={sel ? <Painel key={sel.id} ficha={sel} objecoes={objecoes.data ?? []} onMudou={(id) => { recarregar(); if (id === null) setSelId(null); }} /> : <PanelEmpty>Escolha uma ficha para revisar.</PanelEmpty>}
      >
        {q.isLoading ? <p className="py-6 text-[14px] text-ink-muted">Carregando…</p>
          : q.isError ? <p className="py-6 text-[14px] text-ink-muted">Não consegui carregar agora. Se a migração das conversas ainda não rodou, rode-a no SQL editor.</p>
          : lista.length === 0 ? <p className="py-6 text-[14px] text-ink-muted">{filtro === "enviada" ? "Nenhuma ficha nova. Tudo em dia." : `Nenhuma ficha ${FILTRO_LABEL[filtro].toLowerCase()}.`}</p>
          : (
            <div className="border-t border-line">
              {lista.map((f) => (
                <ListRow key={f.id} active={f.id === selId} onClick={() => setSelId(f.id)} trailing={<Selo status={f.status} />}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{f.autor}</span>
                    <span className="block text-[13px] leading-5 text-ink-muted">
                      {[f.objecao_rotulo, PONTO_LABEL[f.ponto_parada], f.fechou_em ? `Fechou em ${dataCurta(f.fechou_em)}` : ""].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </ListRow>
              ))}
            </div>
          )}
      </AdminListDetail>
      <EnviarComoAdmin aberto={enviar} onFechar={() => setEnviar(false)} onEnviada={() => { recarregar(); setFiltro("enviada"); }} />
    </>
  );
}

function Selo({ status }: { status: Filtro }) {
  if (status === "enviada") return <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold px-2.5 py-0.5 text-[12px] font-semibold text-gold-text"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />Nova</span>;
  if (status === "publicada") return <span className="shrink-0 rounded-full border border-dashed border-ink-muted px-2.5 py-0.5 text-[12px] text-ink">Publicada</span>;
  return <span className="shrink-0 rounded-full border border-line-strong px-2.5 py-0.5 text-[12px] text-ink-muted">Recusada</span>;
}

function Painel({ ficha, objecoes, onMudou }: { ficha: FichaAdmin; objecoes: { id: string; nome: string }[]; onMudou: (id: string | null) => void }) {
  const salvarFn = useServerFn(adminSalvarFicha);
  const apagarFn = useServerFn(adminApagarFicha);
  const autoresFn = useServerFn(adminListAutoresFicha);
  const autores = useQuery({ queryKey: ["admin-autores-ficha"], queryFn: () => autoresFn({}), staleTime: 5 * 60_000 });
  const [campos, setCampos] = useState<CamposFicha>({
    objecao_id: ficha.objecao_id, objecao_rotulo: ficha.objecao_rotulo, ponto_parada: ficha.ponto_parada, plano: ficha.plano,
    perfil_cliente: ficha.perfil_cliente, onde_travou: ficha.onde_travou, o_que_fez: ficha.o_que_fez,
    mensagem_chave: ficha.mensagem_chave, por_que_funcionou: ficha.por_que_funcionou,
  });
  const [autorId, setAutorId] = useState(ficha.autor_id);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState(ficha.motivo_recusa ?? "");

  const acao = useMutation({
    mutationFn: (a: "salvar" | "publicar" | "recusar" | "despublicar") =>
      salvarFn({ data: { id: ficha.id, autor_id: autorId, dias_ate_fechar: ficha.dias_ate_fechar, ...campos, acao: a, motivo_recusa: a === "recusar" ? motivo.trim() : null } }),
    onSuccess: (r, a) => {
      if (!r.ok) { toast.error(r.mensagem); return; }
      toast.success({ salvar: "Edição salva.", publicar: "Publicada na Biblioteca e em Novidades.", recusar: "Recusada. O atendente vê o motivo.", despublicar: "Despublicada." }[a]);
      setRecusando(false);
      onMudou(a === "salvar" ? ficha.id : null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui salvar agora."),
  });
  const apagar = useMutation({
    mutationFn: () => apagarFn({ data: { id: ficha.id } }),
    onSuccess: () => { toast.success("Ficha apagada."); onMudou(null); },
    onError: () => toast.error("Não consegui apagar agora."),
  });

  const dias = ficha.dias_ate_fechar;
  return (
    <div>
      <p className="type-overline text-ink-muted">
        Enviada por {ficha.autor}{ficha.fechou_em ? ` · Fechou em ${dataCurta(ficha.fechou_em)}` : ""}{dias != null ? ` · ${diasLabel(dias)} para fechar` : ""}
      </p>
      <h3 className="mt-1 text-[20px] font-medium leading-7 text-ink">{tituloFicha({ ...ficha, objecao_rotulo: campos.objecao_rotulo, ponto_parada: campos.ponto_parada })}</h3>
      {ficha.status === "recusada" && ficha.motivo_recusa && <p className="mt-2 text-[13.5px] text-ink-muted">Recusada: {ficha.motivo_recusa}</p>}

      <div className="mt-4">
        <FichaCampos valor={campos} onChange={setCampos} objecoes={objecoes} completo idBase="adm" />
        <div className="mt-3">
          <FieldLabel htmlFor="adm-autor">Autor (atendente da venda)</FieldLabel>
          <select id="adm-autor" className={cn(inputCls, "mt-1")} value={autorId} onChange={(e) => setAutorId(e.target.value)}>
            {!(autores.data ?? []).some((a) => a.id === ficha.autor_id) && <option value={ficha.autor_id}>{ficha.autor}</option>}
            {(autores.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
      </div>

      <p className="mt-3 text-[12.5px] leading-5 text-ink-muted">
        Checagem automática: sem telefone, CPF, e-mail ou nome de cliente na ficha. O arquivo .txt da conversa já foi descartado.
      </p>

      {recusando && (
        <div className="mt-3">
          <FieldLabel htmlFor="adm-motivo">Motivo da recusa (o atendente vê no ticket)</FieldLabel>
          <input id="adm-motivo" className={cn(inputCls, "mt-1")} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: a mensagem-chave é parecida com uma que já temos" />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {ficha.status !== "publicada" && !recusando && (
          <GoldButton type="button" className="h-10" disabled={acao.isPending} onClick={() => acao.mutate("publicar")}>Aprovar e publicar</GoldButton>
        )}
        <OutlineButton type="button" className="h-10" disabled={acao.isPending} onClick={() => acao.mutate("salvar")}>Salvar edição</OutlineButton>
        {ficha.status === "publicada" && (
          <OutlineButton type="button" className="h-10" disabled={acao.isPending} onClick={() => acao.mutate("despublicar")}>Despublicar</OutlineButton>
        )}
        {ficha.status !== "publicada" && !recusando && <OutlineButton type="button" className="h-10" onClick={() => setRecusando(true)}>Recusar</OutlineButton>}
        {recusando && (
          <>
            <GoldButton type="button" className="h-10" disabled={acao.isPending || !motivo.trim()} onClick={() => acao.mutate("recusar")}>Recusar com este motivo</GoldButton>
            <OutlineButton type="button" className="h-10" onClick={() => setRecusando(false)}>Cancelar</OutlineButton>
          </>
        )}
        <DeleteLink onConfirm={() => apagar.mutate()} title="Apagar esta ficha?" description="A ficha some da Biblioteca e dos votos. Não dá para desfazer." />
      </div>
    </div>
  );
}

/** "+ Enviar conversa": o Paulo sobe o .txt de qualquer venda concluída, escolhendo o atendente autor. */
function EnviarComoAdmin({ aberto, onFechar, onEnviada }: { aberto: boolean; onFechar: () => void; onEnviada: () => void }) {
  const autoresFn = useServerFn(adminListAutoresFicha);
  const autores = useQuery({ queryKey: ["admin-autores-ficha"], queryFn: () => autoresFn({}), staleTime: 5 * 60_000, enabled: aberto });
  const [autorId, setAutorId] = useState("");
  const [passo, setPasso] = useState<"autor" | "arquivo">("autor");
  const fechar = () => { setPasso("autor"); setAutorId(""); onFechar(); };
  const nome = (autores.data ?? []).find((a) => a.id === autorId)?.nome ?? "";

  if (passo === "arquivo" && autorId) {
    return (
      <EnviarConversaDialog
        aberto={aberto}
        onFechar={fechar}
        autorId={autorId}
        atendente={nome}
        titulo="Enviar conversa para a biblioteca"
        descricao={`Venda concluída de ${nome}. A ficha entra como nova e fica em seu nome depois de você aprovar.`}
        onEnviada={onEnviada}
      />
    );
  }
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) fechar(); }}>
      <DialogContent className="max-w-[440px] rounded-2xl border-line bg-surface p-6">
        <DialogHeader className="space-y-2 pr-6 text-left">
          <DialogTitle className="text-[20px] font-semibold leading-7 text-ink">Enviar conversa</DialogTitle>
          <DialogDescription className="text-[14px] leading-5 text-ink-muted">Quem foi o atendente da venda? Depois você anexa o .txt da conversa.</DialogDescription>
        </DialogHeader>
        <div>
          <FieldLabel htmlFor="env-autor">Atendente</FieldLabel>
          <select id="env-autor" className={cn(inputCls, "mt-1")} value={autorId} onChange={(e) => setAutorId(e.target.value)}>
            <option value="">Escolha…</option>
            {(autores.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <GoldButton type="button" className="h-10" disabled={!autorId} onClick={() => setPasso("arquivo")}>Continuar</GoldButton>
          <OutlineButton type="button" className="h-10" onClick={fechar}>Cancelar</OutlineButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
