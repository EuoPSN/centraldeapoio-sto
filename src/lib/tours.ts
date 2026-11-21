// Tutoriais das páginas: tipos, dados dos 12 tours e funções puras
// (filtro de passos, passo "sem resultado", regra de versão).
// Textos copiados de docs/tutoriais/tours-textos.md, sem reescrever.

export type TourPasso = {
  /** Seletor `[data-tour="<tour>-<n>"]`. Ausente nos passos centrais. */
  alvo?: string;
  titulo: string;
  texto: string;
  /** Só aparece quando já há resultado na tela. */
  exigeResultado?: boolean;
  /** Só aparece quando o elemento existe ("só quando houver"). */
  condicional?: boolean;
};

export type Tour = {
  id: string;
  versao: number;
  rotas: string[];
  titulo: string;
  passos: TourPasso[];
  /** Passo central mostrado, uma vez, quando passos `exigeResultado` ficam de fora. */
  semResultado?: TourPasso;
};

export type SituacaoTour = "nao_visto" | "novo" | "visto";

const a = (tour: string, n: number) => `[data-tour="${tour}-${n}"]`;

export const TOURS: Tour[] = [
  {
    id: "inicio",
    versao: 1,
    rotas: ["/"],
    titulo: "Início",
    passos: [
      { alvo: a("inicio", 1), titulo: "Menu lateral", texto: "Aqui ficam todas as páginas, em grupos: Atendimento, Inteligência, Treino e evolução e Contribuir. Clique no nome do grupo para abrir." },
      { alvo: a("inicio", 2), titulo: "Busca central", texto: "Digite o que o cliente pediu: um preço, uma mensagem pronta ou uma clínica. Atalho: Ctrl + K em qualquer página." },
      { alvo: a("inicio", 3), titulo: "Atalhos", texto: "Levam direto para Scripts, Amor Saúde, MarcIAna e Simulador IA, o que você mais usa." },
      { alvo: a("inicio", 4), titulo: "Check-list de hoje", texto: "Mostra quantos itens você já fez hoje. Clique para abrir e marcar os que faltam." },
      { alvo: a("inicio", 5), titulo: 'Botão "?"', texto: "Em qualquer página, clique aqui para rever o tutorial daquela página." },
    ],
  },
  {
    id: "scripts",
    versao: 1,
    rotas: ["/scripts"],
    titulo: "Scripts",
    passos: [
      { alvo: a("scripts", 1), titulo: "Fluxo de atendimento", texto: "A conversa etapa por etapa, da abordagem ao fechamento. É o melhor lugar para começar." },
      { alvo: a("scripts", 2), titulo: "Biblioteca de mensagens", texto: "Todas as mensagens prontas, por categoria. Escolha, copie e cole no WhatsApp." },
      { alvo: a("scripts", 3), titulo: "O cliente disse…", texto: "Cole a fala do cliente e receba a resposta aprovada para a objeção." },
      { alvo: a("scripts", 4), titulo: "Buscar mensagem", texto: "Digite o nome, um pedaço do texto ou o atalho (como /lead) para achar uma mensagem na hora." },
    ],
  },
  {
    id: "cliente-disse",
    versao: 1,
    rotas: ["/scripts/cliente-disse"],
    titulo: "O cliente disse…",
    passos: [
      { alvo: a("cliente-disse", 1), titulo: "Duas ferramentas", texto: 'Use "Objeções" quando o cliente travar e "Fechar com este cliente" para levar a venda ao fim.' },
      { alvo: a("cliente-disse", 2), titulo: "Cole a fala", texto: "Cole a mensagem do cliente exatamente como veio, sem arrumar." },
      { alvo: a("cliente-disse", 3), titulo: "Resposta aprovada", texto: "A ferramenta diz que tipo de fala é e entrega a resposta aprovada. Copie e ajuste com o seu jeito.", exigeResultado: true },
    ],
  },
  {
    id: "retomar",
    versao: 1,
    rotas: ["/retomar"],
    titulo: "Retomar hoje",
    passos: [
      { alvo: a("retomar", 1), titulo: "Fila do dia", texto: "Aqui estão os clientes que pediram para falar depois, no dia certo. Clique em um nome para abrir." },
      { alvo: a("retomar", 2), titulo: "Régua de contato", texto: "São as etapas de contato com esse cliente. A destacada é a da vez." },
      { alvo: a("retomar", 3), titulo: "Mensagem pronta", texto: "Copie a mensagem e envie pelo WhatsApp. Se preferir, grave um áudio com a sua voz." },
      { alvo: a("retomar", 4), titulo: "Depois de falar com o cliente", texto: "Marque o que aconteceu. Isso mantém a sua fila em dia e alimenta o seu mapa." },
      { alvo: a("retomar", 5), titulo: "Raio-X ou voltar para a fila", texto: "Veja onde a venda esfriou ou devolva o cliente para a fila.", condicional: true },
    ],
  },
  {
    id: "copiloto",
    versao: 1,
    rotas: ["/copiloto"],
    titulo: "Copiloto",
    passos: [
      { alvo: a("copiloto", 1), titulo: "Onde está a conversa", texto: "Cole o print ou anexe a conversa exportada do WhatsApp. O Copiloto lê e sugere a próxima mensagem." },
      { alvo: a("copiloto", 2), titulo: "Duas opções de resposta", texto: 'A "Direta" puxa o próximo passo e a "Consultiva" aprofunda. Escolha a que combina com o cliente e copie.', exigeResultado: true },
      { alvo: a("copiloto", 3), titulo: "Conversas parecidas", texto: "Veja como conversas parecidas fecharam, para se inspirar.", exigeResultado: true },
      { alvo: a("copiloto", 4), titulo: "Objeção encontrada", texto: 'Se o cliente travou em algo, aparece aqui. Clique em "Ver em O cliente disse…" para a resposta aprovada.', exigeResultado: true },
      { alvo: a("copiloto", 5), titulo: "Adicionar à retomada", texto: "Se o cliente ficou de voltar, adicione para ele entrar na sua fila no dia certo.", exigeResultado: true },
    ],
    semResultado: {
      titulo: "O que vai aparecer",
      texto: "Depois de ler, aparecem duas opções de mensagem, conversas parecidas, a objeção encontrada e o botão para adicionar à retomada.",
    },
  },
  {
    id: "raiox",
    versao: 1,
    rotas: ["/raiox"],
    titulo: "Raio-X",
    passos: [
      { alvo: a("raiox", 1), titulo: "A conversa da venda perdida", texto: 'Cole o print ou anexe a conversa exportada de uma venda que não fechou e clique em "Fazer Raio-X". Se você veio de Retomar hoje, a conversa já vem indicada.' },
      { alvo: a("raiox", 2), titulo: "Onde perdeu", texto: "O ponto da conversa em que a venda esfriou, com o que o cliente disse e o que você respondeu.", exigeResultado: true },
      { alvo: a("raiox", 3), titulo: "O que faltou", texto: "O que ficou sem ser feito naquela hora para a venda andar.", exigeResultado: true },
      { alvo: a("raiox", 4), titulo: "Como eu responderia", texto: "Uma resposta de exemplo para aquela situação. Use como referência, com as suas palavras.", exigeResultado: true },
      { alvo: a("raiox", 5), titulo: "Qualidade da escrita", texto: "Pontos da sua escrita que pesaram na conversa.", exigeResultado: true },
      { alvo: a("raiox", 6), titulo: "Hábito para treinar", texto: "Um hábito para praticar nas próximas conversas. Um de cada vez.", exigeResultado: true },
    ],
    semResultado: {
      titulo: "O que vai aparecer",
      texto: "O Raio-X mostra onde a venda se perdeu, o que faltou, como você poderia ter respondido e um hábito para treinar.",
    },
  },
  {
    id: "biblioteca",
    versao: 1,
    rotas: ["/biblioteca"],
    titulo: "Biblioteca",
    passos: [
      { alvo: a("biblioteca", 1), titulo: "Duas áreas", texto: '"Materiais" tem imagens e PDFs. "Conversas que fecharam" traz casos reais da equipe, que você filtra por objeção, ponto de parada e plano.' },
      { alvo: a("biblioteca", 2), titulo: "Imagens e PDFs", texto: "Escolha o tipo de material. Clique para abrir ou baixar." },
      { alvo: a("biblioteca", 3), titulo: "Busca e pastas", texto: "Busque pelo título ou escolha uma pasta para achar mais rápido." },
    ],
  },
  {
    id: "meu-mapa",
    versao: 1,
    rotas: ["/meu-mapa"],
    titulo: "Meu mapa",
    passos: [
      { alvo: a("meu-mapa", 1), titulo: "Seus temas", texto: "Cada linha é um tema de atendimento. O nível vem do que você acertou no aquecimento nos últimos dias." },
      { alvo: a("meu-mapa", 2), titulo: "Nível", texto: 'Mostra seu nível e quantas respostas contaram. Poucas respostas significam "ainda não testado".' },
      { alvo: a("meu-mapa", 3), titulo: "Treinar este tema", texto: "Leva direto ao aquecimento daquele tema. O aquecimento não entra no Ranking." },
    ],
  },
  {
    id: "ranking",
    versao: 1,
    rotas: ["/ranking"],
    titulo: "Ranking",
    passos: [
      { alvo: a("ranking", 1), titulo: "Pódios do mês", texto: "Só os 3 primeiros de cada pódio aparecem, atualizados todo dia." },
      { alvo: a("ranking", 2), titulo: "Abas", texto: '"Meu histórico" leva ao Simulador IA, onde ficam suas notas e sua evolução.' },
      { alvo: a("ranking", 3), titulo: "Hall do mês", texto: "No dia 1º, os campeões do mês anterior aparecem aqui." },
      { alvo: a("ranking", 4), titulo: "Como é calculado", texto: "Explica como cada pódio é contado." },
    ],
  },
  {
    id: "novidades",
    versao: 1,
    rotas: ["/novidades"],
    titulo: "Novidades",
    passos: [
      { alvo: a("novidades", 1), titulo: "Filtros", texto: "Separe o que exige confirmação do que é só informação." },
      { alvo: a("novidades", 2), titulo: "Importantes", texto: 'Leia e responda a pergunta rápida para liberar o botão "Li e entendi".', condicional: true },
      { alvo: a("novidades", 3), titulo: "Informativas", texto: "O histórico de tudo que mudou na Omnia e na empresa fica aqui." },
    ],
  },
  {
    id: "treinamentos",
    versao: 1,
    rotas: ["/treinamentos"],
    titulo: "Treinamentos",
    passos: [
      { alvo: a("treinamentos", 1), titulo: "Busca", texto: "Digite o tema para achar o módulo mais rápido." },
      { alvo: a("treinamentos", 2), titulo: "Módulos", texto: "Cada módulo traz um material para abrir em nova aba." },
      { alvo: a("treinamentos", 3), titulo: "Fazer simulado", texto: "Teste o que você aprendeu. O botão aparece nos módulos que têm simulado.", condicional: true },
      { alvo: a("treinamentos", 4), titulo: "Outros simulados", texto: "Simulados que não estão ligados a um módulo ficam aqui.", condicional: true },
    ],
  },
  {
    id: "meus-relatorios",
    versao: 1,
    rotas: ["/meus-relatorios"],
    titulo: "Meus relatórios",
    passos: [
      { alvo: a("meus-relatorios", 1), titulo: "Resultado do dia", texto: "Preencha o seu resultado diário por canal." },
      { alvo: a("meus-relatorios", 2), titulo: "Canais", texto: "Em cada canal, informe Tentativas, Oportunidades e Vendas." },
      { alvo: a("meus-relatorios", 3), titulo: "Salvar", texto: "Salve cada linha. O Total soma tudo." },
    ],
  },
];

export function tourPorId(id: string): Tour | undefined {
  return TOURS.find((t) => t.id === id);
}

function normalizarRota(p: string): string {
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}

/** Tour que vale para o pathname (ou `undefined`). */
export function tourDaRota(pathname: string): Tour | undefined {
  const p = normalizarRota(pathname);
  return TOURS.find((t) => t.rotas.includes(p));
}

/** Regra de "visto": existe linha com versão >= versão do tour. */
export function situacaoDoTour(tour: Tour, vistos: { tour_id: string; versao: number }[]): SituacaoTour {
  const linha = vistos.find((v) => v.tour_id === tour.id);
  if (!linha) return "nao_visto";
  return linha.versao >= tour.versao ? "visto" : "novo";
}

/**
 * Filtra os passos pelo que está na tela. `alvoVisivel` diz se o alvo existe e
 * está visível. Se um passo `exigeResultado` foi removido, insere UMA vez o
 * passo central `semResultado` no lugar do primeiro removido.
 */
export function filtrarPassos(tour: Tour, alvoVisivel: (alvo: string) => boolean): TourPasso[] {
  const saida: TourPasso[] = [];
  let inseriu = false;
  for (const passo of tour.passos) {
    if (!passo.alvo || alvoVisivel(passo.alvo)) {
      saida.push(passo);
    } else if (passo.exigeResultado && tour.semResultado && !inseriu) {
      saida.push(tour.semResultado);
      inseriu = true;
    }
  }
  return saida;
}
