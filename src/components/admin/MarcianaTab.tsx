import { MarcianaSugestoesSection } from "@/components/admin/MarcianaSugestoesSection";
import { MarcianaFeedbackSection } from "@/components/admin/MarcianaFeedbackSection";

// Seção "MarcIAna" do Admin: sugestões de pergunta (o que os atendentes mais
// perguntam) e as perguntas sem boa resposta (feedback 👎). Configurações do
// modelo e system prompt continuam em "IA e indexação".
export function MarcianaTab() {
  return (
    <div className="space-y-4">
      <MarcianaSugestoesSection />
      <MarcianaFeedbackSection />
    </div>
  );
}
