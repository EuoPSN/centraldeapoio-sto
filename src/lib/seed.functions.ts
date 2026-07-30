import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Dados extraídos da Base_Conhecimento_Estruturada_IA.docx
const SEED_SCRIPTS = [
  // Principais
  { category: "Principais", subcategory: "Abertura", title: "Saudação inicial", body: "Olá! Aqui é {atendente} do Cartão de Todos. Tudo bem? Em que posso te ajudar hoje?", usage_note: "Use sempre no primeiro contato." },
  { category: "Principais", subcategory: "Confirmação", title: "Confirmação de dados", body: "Para sua segurança, vou confirmar alguns dados, tudo bem? Pode me informar seu nome completo e CPF, por favor?", usage_note: "Antes de tratar qualquer assunto sensível." },
  { category: "Principais", subcategory: "Encerramento", title: "Encerramento padrão", body: "Foi um prazer te atender! Qualquer dúvida estamos à disposição. Tenha um excelente dia!", usage_note: "Encerre toda ligação assim." },
  // Fili
  { category: "Fili", subcategory: "Apresentação", title: "Apresentação Fili", body: "O Cartão de Todos oferece também o serviço Fili, com benefícios exclusivos em farmácias parceiras. Posso te explicar como funciona?", usage_note: "Ofereça após confirmar interesse no cartão." },
  { category: "Fili", subcategory: "Fechamento", title: "Fechamento Fili", body: "Perfeito! Vou registrar a adesão ao Fili. Você receberá as instruções por SMS e pode usar imediatamente nas farmácias parceiras.", usage_note: "Após o aceite verbal." },
  // Migração
  { category: "Migração", subcategory: "Oferta", title: "Oferta de migração", body: "Identifiquei aqui que você tem direito a migrar para um plano com mais benefícios pelo mesmo valor. Posso te apresentar?", usage_note: "Use quando o cliente tem plano elegível." },
  { category: "Migração", subcategory: "Confirmação", title: "Confirmação de migração", body: "Confirmando a migração do plano {atual} para o {novo}, com vigência a partir de {data}. Posso prosseguir?", usage_note: "Antes de efetivar no sistema." },
  // Energia
  { category: "Energia", subcategory: "Abordagem", title: "Abordagem energia", body: "Sabia que o Cartão de Todos também tem desconto em energia solar e contas de luz? Posso te dar mais detalhes?", usage_note: "Cross-sell em clientes ativos." },
  // Retrabalho
  { category: "Retrabalho", subcategory: "Reabertura", title: "Reabertura de chamado", body: "Estou retornando seu contato referente ao protocolo {protocolo}. Conseguiu resolver a questão ou ainda precisa de ajuda?", usage_note: "Em retornos de pendência." },
  { category: "Retrabalho", subcategory: "Pendência", title: "Cobrança de documento", body: "Para finalizar seu cadastro, preciso que você envie o documento {tipo}. Pode ser pelo WhatsApp do número {numero}.", usage_note: "Quando faltar documentação." },
];

const SEED_CONTENT = [
  // Conhecimento
  { section: "conhecimento", category: "Sobre", title: "O que é o Cartão de Todos", content: "O **Cartão de Todos** é um clube de benefícios que oferece descontos em consultas médicas, exames, odontologia, farmácias e muito mais, com rede credenciada em todo o Brasil. A mensalidade dá direito ao titular e dependentes." },
  { section: "conhecimento", category: "Pacotes", title: "Tipos de planos", content: "- **Plano Família**: titular + até 4 dependentes\n- **Plano Individual**: apenas titular\n- **Plano Premium**: inclui Fili e parcerias estendidas" },
  { section: "conhecimento", category: "Benefícios", title: "Principais benefícios", content: "1. Consultas a partir de R$ 20,00\n2. Rede odontológica nacional\n3. Descontos em farmácias parceiras\n4. Telemedicina 24h\n5. Programa de pontos" },
  { section: "conhecimento", category: "Regras", title: "Carência", content: "Não há carência para uso dos benefícios principais (consultas e exames). Para procedimentos especiais, consulte a tabela." },
  // Problemas
  { section: "problemas", category: "Sistema", title: "Sistema travou / lento", content: "1. Pressione **Ctrl + Shift + Esc** para abrir o Gerenciador de Tarefas\n2. Finalize processos do navegador travado\n3. Limpe o cache (Ctrl + Shift + Delete)\n4. Se persistir, reinicie o computador" },
  { section: "problemas", category: "Login", title: "Não consigo logar no sistema", content: "1. Verifique se o **Caps Lock** está desligado\n2. Confirme que está usando o e-mail corporativo correto\n3. Tente em uma aba anônima\n4. Se persistir, chame o suporte TI no ramal 4000" },
  { section: "problemas", category: "Telefonia", title: "Headset sem áudio", content: "1. Verifique se o cabo USB está conectado\n2. Em **Configurações > Som**, defina o headset como dispositivo padrão\n3. Reinicie o softphone\n4. Teste com outro headset se possível" },
  // Tutoriais
  { section: "tutoriais", category: "KYC", title: "Validar documentos do cliente", content: "**Passo a passo:**\n1. Acesse o módulo **Clientes** > **Documentos pendentes**\n2. Localize pelo CPF\n3. Confira foto, frente e verso do RG ou CNH\n4. Compare com o cadastro\n5. Aprove ou solicite reenvio com justificativa" },
  { section: "tutoriais", category: "Migração", title: "Como fazer migração de plano", content: "1. Confirme elegibilidade no painel\n2. Apresente o novo plano (use o script de Migração)\n3. Registre o aceite no sistema\n4. Confirme nova mensalidade\n5. Envie e-mail de confirmação automático" },
  { section: "tutoriais", category: "Atalhos", title: "Atalhos de teclado úteis", content: "- **Ctrl + K**: busca rápida\n- **Ctrl + C / V**: copiar / colar\n- **Alt + Tab**: alternar janelas\n- **Win + L**: bloquear o PC ao sair\n- **F5**: atualizar página" },
];

const SEED_PRICING = [
  { category: "Consultas", specialty: "Clínico Geral", cartao_price: 30, particular_price: 150, notes: null },
  { category: "Consultas", specialty: "Cardiologista", cartao_price: 60, particular_price: 250, notes: null },
  { category: "Consultas", specialty: "Pediatra", cartao_price: 50, particular_price: 200, notes: null },
  { category: "Consultas", specialty: "Ginecologista", cartao_price: 60, particular_price: 250, notes: null },
  { category: "Consultas", specialty: "Dermatologista", cartao_price: 70, particular_price: 280, notes: null },
  { category: "Consultas", specialty: "Ortopedista", cartao_price: 60, particular_price: 250, notes: null },
  { category: "Consultas", specialty: "Oftalmologista", cartao_price: 60, particular_price: 240, notes: "Inclui acuidade visual" },
  { category: "Consultas", specialty: "Psicólogo", cartao_price: 50, particular_price: 180, notes: null },
  { category: "Exames", specialty: "Hemograma completo", cartao_price: 15, particular_price: 50, notes: null },
  { category: "Exames", specialty: "Raio-X simples", cartao_price: 35, particular_price: 120, notes: null },
  { category: "Exames", specialty: "Ultrassom", cartao_price: 80, particular_price: 280, notes: "Consultar valores por região" },
  { category: "Exames", specialty: "Eletrocardiograma", cartao_price: 40, particular_price: 130, notes: null },
  { category: "Odontologia", specialty: "Consulta odontológica", cartao_price: 0, particular_price: 100, notes: "Gratuita para titulares" },
  { category: "Odontologia", specialty: "Limpeza", cartao_price: 60, particular_price: 200, notes: null },
  { category: "Odontologia", specialty: "Restauração", cartao_price: null, particular_price: null, notes: "Conforme tabela odontológica regional" },
];

export const seedInitialData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdmin = await isAdminUser(context.supabase, context.userId);
    if (!isAdmin) throw new Error("Apenas administradores.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [sc, sp, cnt] = await Promise.all([
      supabaseAdmin.from("scripts").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("pricing_items").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("content_items").select("id", { count: "exact", head: true }),
    ]);

    if ((sc.count ?? 0) === 0) {
      const rows = SEED_SCRIPTS.map((s, i) => ({ ...s, position: i, created_by: context.userId }));
      const { error } = await supabaseAdmin.from("scripts").insert(rows);
      if (error) throw new Error(error.message);
    }
    if ((cnt.count ?? 0) === 0) {
      const rows = SEED_CONTENT.map((c, i) => ({
        section: c.section as "conhecimento" | "problemas" | "tutoriais",
        category: c.category,
        title: c.title,
        content: c.content,
        tags: [] as string[],
        position: i,
        created_by: context.userId,
      }));
      const { error } = await supabaseAdmin.from("content_items").insert(rows);
      if (error) throw new Error(error.message);
    }
    if ((sp.count ?? 0) === 0) {
      const rows = SEED_PRICING.map((p, i) => ({
        category: p.category,
        specialty: p.specialty,
        cartao_price: p.cartao_price,
        particular_price: p.particular_price,
        notes: p.notes,
        position: i,
      }));
      const { error } = await supabaseAdmin.from("pricing_items").insert(rows);
      if (error) throw new Error(error.message);
    }

    return {
      ok: true,
      seeded: {
        scripts: (sc.count ?? 0) === 0 ? SEED_SCRIPTS.length : 0,
        content: (cnt.count ?? 0) === 0 ? SEED_CONTENT.length : 0,
        pricing: (sp.count ?? 0) === 0 ? SEED_PRICING.length : 0,
      },
    };
  });
