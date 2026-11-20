import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { adminListAtendentesRetomada, getDadosRelatorio } from "@/lib/retomada.functions";
import { montarRelatorioXlsx, nomeArquivoRelatorio } from "@/lib/retomada-relatorio";
import { diaBR, somarDias } from "@/lib/retomada";
import { GoldButton } from "@/components/scripts/shared";
import { Overline } from "@/components/cliente-disse/shared";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { inputCls } from "@/components/admin/AdminListDetail";

/** "Baixar relatório (Excel)": período + (no Admin) atendente. Telefone nunca vai no arquivo. */
export function BaixarRelatorioButton({ admin = false, variant = "link" }: { admin?: boolean; variant?: "link" | "button" }) {
  const hoje = diaBR(new Date());
  const [open, setOpen] = useState(false);
  const [de, setDe] = useState(somarDias(hoje, -29));
  const [ate, setAte] = useState(hoje);
  const [atendente, setAtendente] = useState("");
  const [gerando, setGerando] = useState(false);
  const dadosFn = useServerFn(getDadosRelatorio);
  const listFn = useServerFn(adminListAtendentesRetomada);
  const atendentes = useQuery({ queryKey: ["retomada-atendentes"], queryFn: () => listFn({}), enabled: admin && open, staleTime: 60_000 });

  const baixar = async () => {
    if (de > ate) { toast.error("A data inicial vem depois da final."); return; }
    setGerando(true);
    try {
      const dados = await dadosFn({ data: { de, ate, atendente_id: atendente || null, equipe: admin } });
      const buf = await montarRelatorioXlsx(dados);
      const nome = nomeArquivoRelatorio(dados, atendentes.data?.find((a) => a.id === atendente)?.nome);
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setOpen(false);
    } catch {
      toast.error("Não consegui gerar o relatório agora.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "link" ? (
          <button type="button" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-gold-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <Download className="h-4 w-4" strokeWidth={1.5} /> Baixar relatório (Excel)
          </button>
        ) : (
          <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-[14px] font-medium text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <Download className="h-4 w-4" strokeWidth={1.5} /> Baixar relatório (Excel)
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-2rem))] rounded-2xl border-line bg-surface p-5">
        <div className="space-y-3">
          <h3 className="text-[16px] font-medium text-ink">Relatório de retomadas</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><Overline className="mb-1">De</Overline><input type="date" className={inputCls} value={de} max={ate} onChange={(e) => setDe(e.target.value)} /></label>
            <label className="block"><Overline className="mb-1">Até</Overline><input type="date" className={inputCls} value={ate} min={de} max={hoje} onChange={(e) => setAte(e.target.value)} /></label>
          </div>
          {admin && (
            <label className="block">
              <Overline className="mb-1">Atendente</Overline>
              <select className={inputCls} value={atendente} onChange={(e) => setAtendente(e.target.value)}>
                <option value="">Equipe toda</option>
                {(atendentes.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </label>
          )}
          <p className="text-[12.5px] leading-5 text-ink-muted">
            {admin ? "Sem telefone e sem a fala do cliente." : "Só os seus clientes. Sem telefone e sem a fala do cliente."}
          </p>
          <GoldButton className="h-10" onClick={baixar} disabled={gerando}>{gerando ? "Gerando…" : "Baixar .xlsx"}</GoldButton>
        </div>
      </PopoverContent>
    </Popover>
  );
}
