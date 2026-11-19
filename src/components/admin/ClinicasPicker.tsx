import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listContatos } from "@/lib/contatos.functions";
import { Label } from "@/components/ui/label";

// Seleção múltipla das clínicas Amor Saúde (Contatos e Endereços → Clínica Amor Saúde),
// agrupadas por região. Usada em Consultas, Exames e Odontologia.

interface ClinicaRow { id: string; tipo: string; nome_regiao: string; regiao?: string | null; destaque: boolean; position: number }

export function useClinicasAmorSaude() {
  const fn = useServerFn(listContatos);
  const q = useQuery({ queryKey: ["contatos"], queryFn: () => fn({}) });
  return ((q.data ?? []) as ClinicaRow[]).filter((c) => c.tipo === "clinica_amor_saude");
}

export function ClinicasPicker({ value, onChange, label = "Clínicas onde atende" }: { value: string[]; onChange: (ids: string[]) => void; label?: string }) {
  const clinicas = useClinicasAmorSaude();
  const grupos = new Map<string, ClinicaRow[]>();
  clinicas
    .slice()
    .sort((a, b) => Number(b.destaque) - Number(a.destaque) || a.position - b.position || a.nome_regiao.localeCompare(b.nome_regiao))
    .forEach((c) => {
      const k = c.regiao?.trim() || "Sem região";
      grupos.set(k, [...(grupos.get(k) ?? []), c]);
    });
  const sel = new Set(value);
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((x) => x !== id));

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {clinicas.length > 0 && (
          <span className="text-xs text-muted-foreground">{value.filter((id) => clinicas.some((c) => c.id === id)).length} de {clinicas.length}</span>
        )}
      </div>
      {clinicas.length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground">Nenhuma clínica cadastrada. Cadastre em Contatos e Endereços → Clínica Amor Saúde.</p>
      )}
      <div className="mt-1 space-y-2 rounded-md border border-border p-2">
        {[...grupos.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([regiao, cs]) => (
          <fieldset key={regiao}>
            <legend className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{regiao}</legend>
            <div className="mt-1 grid gap-1 sm:grid-cols-2">
              {cs.map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent">
                  <input type="checkbox" checked={sel.has(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} />
                  <span className="min-w-0 truncate">{c.nome_regiao}</span>
                  {c.destaque && <span className="ml-auto text-[10px] font-semibold uppercase text-muted-foreground">principal</span>}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
