---
version: 1
slug: "src-routes-authenticated-route-tsx"
primary_target: "src/routes/_authenticated/route.tsx"
related_targets: ["src/routes/_authenticated/index.tsx","src/routes/_authenticated/scripts.tsx","src/routes/_authenticated/precos.tsx"]
---

# Surface: Central de Apoio — shell do app e telas de atendimento

Scope: app inteiro (shell, Início, Mensagens/Fluxo, Preços); demais telas herdam tokens e componentes. Visitor mode: Operate.
Audience/job: atendentes no PC com a Central em meia tela (~640–960 px) ao lado do WhatsApp Web; copiar a mensagem da etapa e achar preço/cobertura em segundos. Admin (Paulo) em tela cheia.
Constraints: só o logo é obrigatório; seletor de temas removido agora (volta numa atualização futura); português; dados vêm do Supabase.

## Direction contract

THESIS: Um padrão limpo de software de trabalho (canon) com um único elemento chamativo: a etiqueta de gôndola. Recusa os tiles com gradiente arco-íris, cards com sombra e cara de "dashboard de IA".
OWN-WORLD: Fundo cinza-esverdeado muito claro, superfícies brancas com borda fina, verde CDT profundo no topo/menu ativo, tipografia de sistema/workhorse. Etiqueta amarela (#FFD400) com ponta recortada e numeral condensado pesado para preços; vermelha para promoção. Cor de estado só onde significa algo.
STORY: O atendente abre, vê a etapa do fluxo, copia a mensagem; procura um preço e o enxerga como numa prateleira; volta ao WhatsApp.
FIRST VIEWPORT: Barra superior verde com logo + busca Ctrl K ocupando a largura; abas principais (Mensagens, Preços, Regras, Unidades, Treino); em Mensagens, trilha de etapas em pílulas e lista de mensagens com botão Copiar à direita; em Preços, linhas com etiqueta de gôndola alinhada à direita e Copiar.
CRAFT BAR: Nubank / apps de banco.
FORM: canon escolhido pelo usuário, com o movimento-assinatura da direção B (etiqueta de gôndola) como item chamativo. seed: b8e1c82358d2dac3
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
