// Política de privacidade da extensão OMNIA Apoio (WhatsApp Web). Fonte única do texto da página
// pública /privacidade-extensao. O mesmo conteúdo está em docs/fase-c/politica-privacidade-extensao.md
// (o teste extension/tests/privacidade.test.ts confere que as duas versões têm as mesmas seções).

/** E-mail que aparece na política. Troque aqui (um único lugar). */
export const PRIVACIDADE_CONTATO = "[definir o e-mail de contato]";

/** Data da última revisão do texto. */
export const PRIVACIDADE_ATUALIZADA = "23/11/2026";

export interface SecaoPrivacidade {
  titulo: string;
  paragrafos?: string[];
  itens?: string[];
}

export const PRIVACIDADE_INTRO =
  "A extensão OMNIA Apoio é uma ferramenta interna da equipe de atendimento do Cartão de TODOS (unidade de Ribeirão das Neves). Ela ajuda o atendente a organizar tickets de clientes e a preparar respostas. Este texto explica, em linguagem simples, o que ela faz com os dados.";

export const PRIVACIDADE_SECOES: SecaoPrivacidade[] = [
  { titulo: "Quem pode usar", paragrafos: ["Somente atendentes autorizados, com a mesma conta da plataforma OMNIA Apoio."] },
  {
    titulo: "O que a extensão lê",
    itens: [
      "Só a conversa individual que o atendente abriu, e só quando ele clica em \"Ler esta conversa\". Lê apenas as mensagens que já estão carregadas na tela.",
      "A lista de conversas (nome, prévia, horário e se há mensagem não lida), apenas para medir o tempo da primeira resposta. Nenhuma conversa é aberta por esse processo, e nome e prévia não saem do navegador.",
    ],
  },
  {
    titulo: "O que a extensão nunca faz",
    itens: [
      "Nunca lê grupos, comunidades, listas de transmissão nem Status.",
      "Nunca envia mensagens, nunca escreve na caixa de texto e nunca clica em nada no WhatsApp.",
      "Nunca rola o histórico nem abre conversas sozinha.",
      "Nunca guarda o conteúdo das conversas.",
    ],
  },
  {
    titulo: "O que é enviado e para onde",
    paragrafos: [
      "Para sugerir o ticket e as respostas, o texto da conversa é enviado, depois de remover telefone, CPF, e-mail e outros dados de identificação, ao servidor da OMNIA Apoio e a um provedor de inteligência artificial que processa o texto e devolve a sugestão. O texto não é guardado.",
    ],
  },
  {
    titulo: "O que é guardado",
    paragrafos: [
      "No ticket do atendente: primeiro nome do cliente, telefone (visível só ao atendente dono do ticket), etapa do funil, ponto de parada, plano, observação resumida e prazo de retomada, além do histórico do que mudou no ticket. O telefone é apagado quando o ticket sai da fila ou em até 30 dias.",
      "Também são guardados contadores de uso (por exemplo, quantos tickets foram criados) e tempos de resposta, sem nome, telefone nem conteúdo de conversa: para cada conversa nova, só um código irreversível (hash) da conversa, os horários e os minutos até a primeira resposta. Se o atendente ignorar um contato, guardamos apenas um código irreversível (hash) do número, nunca o número, para a extensão não ler essa conversa. Guardamos também a confirmação de que o atendente leu o aviso \"O que a extensão faz\".",
    ],
  },
  {
    titulo: "Quem acessa",
    paragrafos: ["O atendente vê só os próprios tickets. A gestão vê apenas números por atendente (quantidades e tempos), nunca o conteúdo das conversas nem os telefones dos clientes."],
  },
  {
    titulo: "Controle do atendente",
    paragrafos: ["Há um botão Pausar, que desliga qualquer leitura, e um botão para ignorar um contato. Para remover a extensão, basta desinstalá-la no Chrome."],
  },
  {
    titulo: "Compartilhamento",
    paragrafos: ["Os dados não são vendidos nem usados para publicidade. São compartilhados apenas com os prestadores necessários para o funcionamento (hospedagem e provedor de IA)."],
  },
  {
    titulo: "Seus direitos e contato",
    paragrafos: ["Pedidos sobre dados pessoais (LGPD) e dúvidas: {contato}."],
  },
];
