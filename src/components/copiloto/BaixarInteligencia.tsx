import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { adminListAtendentesInteligencia, getDadosInteligencia } from "@/lib/inteligencia-relatorio.functions";
import { montarRelatorioInteligenciaXlsx, nomeArquivoInteligencia } from "@/lib/inteligencia-relatorio";
import { diaBR, somarDias } from "@/lib/retomada";
import { GoldButton } from "@/components/scripts/shared";
import { Overline } from "@/components/cliente-disse/shared";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { inputCls } from "@/components/admin/AdminListDetail";

/** O Raio-X só guarda 90 dias: é também o período máximo do relatório. */
const MAX_DIAS = 90;

const linkCls = "inline-flex items-center gap-1.5 text-[14px] font-semibold text-gold-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60";
const botaoCls = "inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-[14px] font-medium text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Hook: gera e baixa o .xlsx. Telefone, e-mail, nome e fala do cliente nunca vão no arquivo. */
function useBaixarInteligencia() {
  const dadosFn = useServerFn(getDadosInteligencia);
  const [gerando, setGerando] = useState(false);
  const baixar = async (args: { de: string; ate: string; equipe: boolean; atendente_id?: string | null; nomeAtendente?: string | null }): Promise<boolean> => {
    setGerando(true);
    try {
      const dados = await dadosFn({ data: { de: args.de, ate: args.ate, equipe: args.equipe, atendente_id: args.atendente_id || null } });
      const buf = await montarRelatorioInteligenciaXlsx(dados);
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url; a.download = nomeArquivoInteligencia(dados, args.nomeAtendente); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return true;
    } catch (e) {
      toast.error(e instanceof Error && /período|data/i.test(e.message) ? e.message : "Não consegui gerar o relatório agora.");
      return false;
    } finally {
      setGerando(false);
    }
  };
  return { baixar, gerando };
}

/** Link "Baixar relatório (Excel)" de /raiox e /copiloto: só os próprios dados, últimos 90 dias. */
export function BaixarInteligenciaLink() {
  const { baixar, gerando } = useBaixarInteligencia();
  return (
    <button
      type="button"
      className={linkCls}
      disabled={gerando}
      onClick={() => { const hoje = diaBR(new Date()); void baixar({ de: somarDias(hoje, -(MAX_DIAS - 1)), ate: hoje, equipe: false }); }}
    >
      <Download className="h-4 w-4" strokeWidth={1.5} /> {gerando ? "Gerando…" : "Baixar relatório (Excel)"}
    </button>
  );
}

/** Botão da aba "Raio-X da equipe" (Admin): período (máx. 90 dias) e atendente. */
export function BaixarInteligenciaAdmin() {
  const hoje = diaBR(new Date());
  const [open, setOpen] = useState(false);
  const [de, setDe] = useState(somarDias(hoje, -(MAX_DIAS - 1)));
  const [ate, setAte] = useState(hoje);
  const [atendente, setAtendente] = useState("");
  const { baixar, gerando } = useBaixarInteligencia();
  const listFn = useServerFn(adminListAtendentesInteligencia);
  const atendentes = useQuery({ queryKey: ["inteligencia-atendentes"], queryFn: () => listFn({}), enabled: open, staleTime: 60_000 });

  // Mantém o período dentro de 90 dias: mexer num lado puxa o outro.
  const mudarDe = (v: string) => { setDe(v); if (v && v > ate) setAte(v); else if (v && somarDias(v, MAX_DIAS - 1) < ate) setAte(somarDias(v, MAX_DIAS - 1)); };
  const mudarAte = (v: string) => { setAte(v); if (v && v < de) setDe(v); else if (v && somarDias(v, -(MAX_DIAS - 1)) > de) setDe(somarDias(v, -(MAX_DIAS - 1))); };

  const enviar = async () => {
    if (!de || !ate || de > ate) { toast.error("Confira as datas."); return; }
    const ok = await baixar({ de, ate, equipe: true, atendente_id: atendente || null, nomeAtendente: atendentes.data?.find((a) => a.id === atendente)?.nome });
    if (ok) setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={botaoCls}><Download className="h-4 w-4" strokeWidth={1.5} /> Baixar relatório (Excel)</button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-2rem))] rounded-2xl border-line bg-surface p-5">
        <div className="space-y-3">
          <h3 className="text-[16px] font-medium text-ink">Relatório de inteligência</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><Overline className="mb-1">De</Overline><input type="date" className={inputCls} value={de} min={somarDias(hoje, -(MAX_DIAS - 1))} max={hoje} onChange={(e) => mudarDe(e.target.value)} /></label>
            <label className="block"><Overline className="mb-1">Até</Overline><input type="date" className={inputCls} value={ate} min={somarDias(hoje, -(MAX_DIAS - 1))} max={hoje} onChange={(e) => mudarAte(e.target.value)} /></label>
          </div>
          <label className="block">
            <Overline className="mb-1">Atendente</Overline>
            <select className={inputCls} value={atendente} onChange={(e) => setAtendente(e.target.value)}>
              <option value="">Todos</option>
              {(atendentes.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </label>
          <p className="text-[12.5px] leading-5 text-ink-muted">
            Período de até {MAX_DIAS} dias (o Raio-X só guarda esse tempo). Sem telefone, nome nem fala do cliente.
          </p>
          <GoldButton className="h-10" onClick={enviar} disabled={gerando}>{gerando ? "Gerando…" : "Baixar .xlsx"}</GoldButton>
        </div>
      </PopoverContent>
    </Popover>
  );
}
