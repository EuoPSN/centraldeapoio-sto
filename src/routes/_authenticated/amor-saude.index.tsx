import { createFileRoute } from "@tanstack/react-router";
import { CircleQuestionMark, MapPin, Microscope, Stethoscope, Video } from "lucide-react";
import { HubCard, HubSearchField } from "@/components/HubCard";
import { TopbarBreadcrumb, SkeletonLine } from "@/components/scripts/shared";
import { useAmorSaude } from "@/components/amor-saude/model";
import { ToothIcon } from "@/components/amor-saude/ui";

export const Route = createFileRoute("/_authenticated/amor-saude/")({
  component: AmorSaudeHub,
});

const contagem = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function AmorSaudeHub() {
  const { consultas, exames, procedimentos, clinicas, isLoading } = useAmorSaude();
  const footer = (text: string) => (isLoading ? <SkeletonLine className="h-3.5 w-28" /> : text);

  return (
    <div className="min-h-0 flex-1 md:overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center px-4 pb-16 pt-10 sm:px-6 lg:pt-16">
        <TopbarBreadcrumb items={[{ label: "Atendimento" }, { label: "Amor Saúde" }]} />

        <p className="text-xs font-normal uppercase leading-4 tracking-[0.22em] text-ink-muted">Amor Saúde</p>
        <h1 className="mt-3 text-center font-display text-[clamp(2rem,3.6vw,2.75rem)] font-medium uppercase leading-[1.18] tracking-[0.08em] text-ink [text-wrap:balance]">
          Como posso ajudar o cliente?
        </h1>
        <p className="mt-4 max-w-[72ch] text-center text-base leading-[26px] text-ink-muted [text-wrap:balance]">
          Preços, clínicas e serviços para os clientes do Cartão de TODOS.
        </p>

        <div className="mt-11 grid w-full grid-cols-1 justify-center gap-4 min-[560px]:grid-cols-[repeat(2,minmax(0,300px))] min-[1000px]:grid-cols-[repeat(3,300px)]">
          <HubCard
            to="/amor-saude/consultas"
            icon={Stethoscope}
            title="Consultas"
            text="Especialidades, valores e onde atende."
            footer={footer(contagem(consultas.length, "especialidade", "especialidades"))}
          />
          <HubCard
            to="/amor-saude/exames"
            icon={Microscope}
            title="Exames"
            text="Laboratoriais e de imagem, com o preparo."
            footer={footer(contagem(exames.length, "exame", "exames"))}
          />
          <HubCard
            to="/amor-saude/odontologia"
            icon={ToothIcon}
            title="Odontologia"
            text="Procedimentos e avaliação odontológica."
            footer={footer(contagem(procedimentos.length, "procedimento", "procedimentos"))}
          />
          <HubCard
            to="/amor-saude/clinicas"
            icon={MapPin}
            title="Clínicas"
            text="Endereço, telefone e rota no Maps."
            footer={footer(contagem(clinicas.length, "unidade", "unidades"))}
          />
          <HubCard icon={Video} title="Teleconsulta e PA digital" text="Atendimento online e pronto atendimento." badge="Em breve" soon />
          <HubCard icon={CircleQuestionMark} title="Dúvidas frequentes" text="As perguntas que os clientes mais fazem." badge="Em breve" soon />
        </div>

        <HubSearchField
          scope="amor"
          label="Buscar no Amor Saúde"
          placeholder="Ou busque uma especialidade, exame ou clínica…"
        />
      </div>
    </div>
  );
}
