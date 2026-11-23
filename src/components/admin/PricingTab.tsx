import { ConsultasSubTab } from "@/components/admin/PricingConsultasTab";
import { ExamesSubTab } from "@/components/admin/PricingExamesTab";
import { OdontologiaSubTab } from "@/components/admin/PricingOdontologiaTab";
import { ClinicasSubTab } from "@/components/admin/PricingClinicasTab";
import { TelemedicinaSubTab } from "@/components/admin/TelemedicinaAdmin";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function PricingTab({ defaultTab = "consultas" }: { defaultTab?: "consultas" | "exames" | "odontologia" | "telemedicina" | "clinicas" } = {}) {
  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList>
        <TabsTrigger value="consultas">Consultas</TabsTrigger>
        <TabsTrigger value="exames">Exames</TabsTrigger>
        <TabsTrigger value="odontologia">Procedimentos Odontológicos</TabsTrigger>
        <TabsTrigger value="telemedicina">Teleconsulta e PA</TabsTrigger>
        <TabsTrigger value="clinicas">Clínicas</TabsTrigger>
      </TabsList>
      <TabsContent value="consultas" className="mt-4"><ConsultasSubTab /></TabsContent>
      <TabsContent value="exames" className="mt-4"><ExamesSubTab /></TabsContent>
      <TabsContent value="odontologia" className="mt-4"><OdontologiaSubTab /></TabsContent>
      <TabsContent value="telemedicina" className="mt-4"><TelemedicinaSubTab /></TabsContent>
      {/* Cadastro das clínicas Amor Saúde (nome, região, endereço, telefones, Maps, principal).
          Morava em Contatos e Endereços → "Clínica Amor Saúde"; mudou pra cá porque é onde
          vive o resto do catálogo do Amor Saúde (Consultas/Exames/Odontologia já selecionam
          clínicas daqui pelo ClinicasPicker). Nada nos dados ou nas rotas do Amor Saúde mudou. */}
      <TabsContent value="clinicas" className="mt-4"><ClinicasSubTab /></TabsContent>
    </Tabs>
  );
}
