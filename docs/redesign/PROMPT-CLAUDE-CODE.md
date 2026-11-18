# Redesign da Central — instruções para o Claude Code

Cole o texto abaixo no Claude Code, com o repositório aberto.

---

Vamos remodelar o visual da Central de Apoio. A decisão de design já foi tomada; não reabra a escolha da direção.

Leia antes de mexer em qualquer coisa:
- `PRODUCT.md` (quem usa, como e para quê; a Central fica em meia tela ao lado do WhatsApp Web)
- `.impeccable/surfaces/src-routes-authenticated-route-tsx.md` (contrato da direção)
- `docs/redesign/esboco-escolhido.png` e `.html` (tela de Preços na direção escolhida)
- `docs/redesign/esboco-mensagens-base.png` e `.html` (base da tela de Mensagens/Fluxo)

Use a skill de design (impeccable) e siga o contrato:
1. Padrão limpo de software de trabalho, régua de acabamento Nubank: fundo claro, superfícies brancas com borda fina, verde CDT profundo no topo e no item ativo, fonte de sistema.
2. Único elemento chamativo: preço em etiqueta de gôndola (amarela; vermelha para promoção, ponta recortada, numeral condensado pesado). Use em Preços, Exames, Odontologia, Planos em promoção e onde mais houver preço.
3. Remover os tiles com gradiente arco-íris da Início, as sombras decorativas e o seletor de temas (`src/lib/themes.ts` e aba Aparência), deixando anotado que os temas voltam numa atualização futura.
4. Tudo tem que funcionar bem entre 640 e 960 px de largura (meia tela), além de tela cheia para o Admin.
5. Copiar mensagem e achar preço são as duas ações mais importantes: botão Copiar sempre visível e alinhado, busca Ctrl K em destaque.

Ordem:
1. Tokens em `src/styles.css` + shell (`app-sidebar.tsx`, `_authenticated/route.tsx`)
2. Início (`index.tsx`)
3. Mensagens/Fluxo (`scripts.tsx`) e Preços (`precos.tsx`)
4. Demais telas herdando os mesmos tokens e componentes
5. Revisão final e `DESIGN.md` documentando o sistema

Não mexa em lógica, server functions nem banco. Trabalhe numa branch `redesign-visual` e me mostre as telas antes do merge na `main`.
