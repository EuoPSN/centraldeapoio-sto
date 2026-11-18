---
name: Central de Apoio
description: Ferramenta de atendimento do Cartão de TODOS, usada em meia tela ao lado do WhatsApp Web.
colors:
  cdt-green: "#0b6b45"
  cdt-green-foreground: "#ffffff"
  cdt-green-muted: "#d5ebdf"
  green-wash: "#e7f1eb"
  page-mist: "#f4f6f4"
  surface-white: "#ffffff"
  ink: "#1c221f"
  ink-soft: "#3a443f"
  muted-text: "#5c6862"
  quiet-fill: "#eef1ef"
  hairline: "#e1e6e2"
  input-stroke: "#d6ddd8"
  gondola-yellow: "#ffd400"
  promo-red: "#e1251b"
  state-danger: "#c62a1f"
  state-success: "#12804f"
  state-warning: "#9a5b00"
typography:
  price:
    fontFamily: "Barlow Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0em"
    fontFeature: "tnum, lnum"
  price-sm:
    fontFamily: "Barlow Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1
  headline:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.375
  message:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  nav:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.05em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "20px"
  xl: "32px"
  topbar: "100px"
components:
  button-primary:
    backgroundColor: "{colors.cdt-green}"
    textColor: "{colors.cdt-green-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.cdt-green}"
  copy-button:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.cdt-green}"
    rounded: "{rounded.md}"
    height: "32px"
    width: "100px"
  copy-button-copied:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.cdt-green}"
  copy-button-icon:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.cdt-green}"
    rounded: "{rounded.lg}"
    size: "36px"
  price-tag:
    backgroundColor: "{colors.gondola-yellow}"
    textColor: "{colors.ink}"
    typography: "{typography.price}"
    padding: "4px 10px 3px 18px"
    width: "100px"
  price-tag-promo:
    backgroundColor: "{colors.promo-red}"
    textColor: "{colors.cdt-green-foreground}"
    typography: "{typography.price}"
  pill:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "0 14px"
    height: "32px"
  pill-active-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface-white}"
  pill-active-brand:
    backgroundColor: "{colors.cdt-green}"
    textColor: "{colors.cdt-green-foreground}"
  panel:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.xl}"
  panel-row:
    padding: "10px 16px"
  input:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  topbar:
    backgroundColor: "{colors.cdt-green}"
    textColor: "{colors.cdt-green-foreground}"
    height: "{spacing.topbar}"
  topbar-tab-active:
    backgroundColor: "{colors.page-mist}"
    textColor: "{colors.cdt-green}"
    typography: "{typography.nav}"
    rounded: "{rounded.lg}"
  sidebar-item-active:
    backgroundColor: "{colors.cdt-green}"
    textColor: "{colors.cdt-green-foreground}"
    rounded: "{rounded.md}"
---

# Design System: Central de Apoio

## Overview

**Creative North Star: "A Bancada e a Etiqueta"**

A Central é uma bancada de trabalho: fundo claro levemente esverdeado, superfícies brancas com fio fino, tipografia do sistema e nada que dispute a atenção do atendente enquanto ele conversa com o cliente no WhatsApp. O verde CDT profundo marca onde você está (barra superior, aba atual, item ativo do menu, ação principal) e só isso. Sobre essa bancada quieta existe um único objeto que grita: a etiqueta de preço de gôndola, amarela para o preço normal e vermelha para promoção, com ponta recortada e numeral condensado pesado.

A densidade é de ferramenta, não de vitrine. Telas em coluna única até ~960px, linhas de painel compactas, valor e ação sempre alinhados à direita. A régua de acabamento é a de apps de banco: limpo, direto, cor forte da marca usada com parcimônia. Profundidade vem de tom (fundo cinza-verde contra branco) e de fio, não de sombra.

**Key Characteristics:**
- Fundo `page-mist` com painéis brancos de borda `hairline`; sem sombra em repouso.
- Verde CDT sólido como marcador de lugar e de ação principal.
- Etiqueta de gôndola como único elemento chamativo, sempre com o numeral Barlow Condensed.
- Copiar sempre no canto superior direito ou na coluna da direita, com largura fixa.
- Pensado para meia tela (640–960px) ao lado do WhatsApp Web.

## Colors

Paleta de trabalho quase neutra, puxada para o verde, com uma cor de marca forte e duas cores de etiqueta reservadas ao preço.

### Primary
- **Verde CDT Profundo** (`cdt-green`): barra superior inteira, aba atual (como texto sobre o fundo da página), item ativo do menu lateral em bloco sólido, botão principal, anel de foco, ícones de linha e texto do botão Copiar.
- **Verde Névoa** (`cdt-green-muted`): texto secundário sobre a barra verde (abas inativas, placeholder da busca).
- **Lavagem Verde** (`green-wash`): hover de botões contorno e pílulas, estado "Copiado", seleção leve, chips de atalho (`/atalho`) e selo Admin.

### Secondary
- **Amarelo Gôndola** (`gondola-yellow`): fundo da etiqueta de preço normal. Não aparece em nenhum outro lugar.
- **Vermelho Promoção** (`promo-red`): fundo da etiqueta de preço em promoção. Não aparece em nenhum outro lugar.

### Neutral
- **Névoa da Página** (`page-mist`): fundo de todas as telas e da aba ativa da barra superior, que "encaixa" na página.
- **Branco Superfície** (`surface-white`): painéis, cartões, inputs, menu lateral, pílulas inativas.
- **Grafite** (`ink`): texto principal, pílula de filtro ativa (tom "ink"), texto da etiqueta amarela.
- **Grafite Suave** (`ink-soft`): texto dos itens do menu lateral.
- **Texto Calmo** (`muted-text`): descrições, linhas secundárias de preço, títulos de painel.
- **Preenchimento Quieto** (`quiet-fill`): botão secundário, blocos de código, fio interno entre linhas de painel.
- **Fio** (`hairline`): bordas de painel, cartão e menu lateral.
- **Contorno de Campo** (`input-stroke`): borda de inputs, selects, textareas e botões contorno.

### Estado
- **Perigo** (`state-danger`), **Sucesso** (`state-success`), **Aviso** (`state-warning`): só onde o estado significa algo (erro, confirmação, uma observação de preparo de exame). Nunca como decoração ou para dar "cor" a uma tela.

### Named Rules
**A Regra da Única Voz Alta.** Amarelo e vermelho de etiqueta existem só dentro da etiqueta de preço. Se um amarelo ou vermelho aparece fora dela, está errado.

**A Regra do Verde que Marca Lugar.** O verde sólido diz "você está aqui" ou "esta é a ação". Não pinte cabeçalhos, cartões ou ícones decorativos de verde sólido.

**A Regra do Estado com Significado.** Cor de estado só quando há um estado real a comunicar.

### Temas de cores
O seletor de temas de cores foi removido nesta fase e volta numa atualização futura. Até lá, as cores deste documento valem para todos: o `active_theme` salvo em `app_settings` não altera mais nenhuma cor.

## Typography

**Fonte de interface:** fonte do sistema (`system-ui`, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial)
**Fonte de preço:** Barlow Condensed 700/800 (com Arial Narrow), carregada do Google Fonts só para a etiqueta.

**Character:** A fonte do sistema some e deixa o conteúdo trabalhar; o numeral condensado pesado é o sotaque de supermercado que faz o preço saltar da tela.

### Hierarchy
- **Preço** (800, 1.5rem, line-height 1, numerais tabulares): dentro da etiqueta de gôndola; "R$" pequeno (11px, 700) alinhado no topo. Versão compacta a 1.125rem com "R$" a 9px.
- **Headline** (600, 1.25rem, tracking levemente apertado): título de página ("Preços", "Olá, nome"). Um por tela, sem ícone decorativo.
- **Title** (600, 1rem): nome do item numa linha de painel (especialidade, plano, exame). Títulos de mensagem usam 13.5px/600; nome de unidade 15px/600.
- **Message** (400, 14.5px, line-height 1.625): corpo das mensagens que o atendente copia.
- **Body** (400, 0.875rem): descrições, texto auxiliar. Linhas secundárias de preço a 12.5px em `muted-text`.
- **Nav** (600, 13.5px): abas da barra superior.
- **Label** (700, 0.75rem, 0.05em, caixa alta): título de painel ("CONSULTAS", "PLANOS EM PROMOÇÃO"), em `muted-text`. Nomeia o conteúdo do painel; não é chamada decorativa acima de um título.

### Named Rules
**A Regra do Numeral de Gôndola.** Barlow Condensed é exclusiva da etiqueta de preço. Nenhum título, número de contagem ou destaque usa essa fonte.

## Layout

A casca tem duas faixas fixas: barra superior verde de 100px (`--topbar-h`) com uma linha de 56px (menu, logo, busca) e uma linha de abas de 44px, e abaixo dela o menu lateral à esquerda e o conteúdo à direita.

- **Barra superior:** botão do menu, logo sobre placa branca arredondada, campo de busca que ocupa o espaço restante e abre a busca global (Ctrl K). Abaixo, as abas principais Mensagens, Preços, Regras, Unidades e Treino, cada uma só aparece se o item correspondente estiver visível em `nav_items`. A linha de abas rola na horizontal sem barra visível.
- **Menu lateral:** começa abaixo da barra superior. Abre expandido (16rem) a partir de 1280px e recolhido em ícones (3rem) abaixo disso, que é o caso da meia tela. Abaixo de 768px vira gaveta.
- **Conteúdo:** coluna centralizada; `max-w-3xl` na Início, `max-w-4xl` em Mensagens, Preços e Unidades, `max-w-5xl` no contêiner padrão (`PageBody`). Respiro lateral de 16px, 20px a partir de 640px e 32px em telas grandes; 20px no topo, 28px em telas grandes.
- **Ritmo:** 16px entre painéis; linhas de painel com 16px laterais e 10–12px verticais; pílulas com 6px de intervalo e quebra de linha.
- **Grades:** duas colunas só a partir de 640px (unidades, mensagens com bifurcação) ou 768px (painéis da Início); a Biblioteca de mensagens só vira duas colunas a partir de 1536px.

### Named Rules
**A Regra da Meia Tela.** Todo layout precisa funcionar entre 640px e 960px de largura útil. Projete primeiro para essa faixa; tela cheia é bônus.

## Elevation & Depth

O sistema é plano. Profundidade vem do contraste de tom entre `page-mist` e as superfícies brancas e do fio `hairline`. Painéis, cartões, botões, pílulas e etiquetas não têm sombra. Sombra existe só para o que flutua de verdade sobre a página: menus, popovers, diálogos e toasts.

### Shadow Vocabulary
- **Sobreposição** (`--shadow-overlay`, valor no sidecar): camadas flutuantes (menus suspensos, popovers, diálogos, toasts).

### Named Rules
**A Regra do Chão Plano.** Nada que está no fluxo da página tem sombra. Se não flutua, não tem sombra.

## Shapes

Cantos suaves e consistentes: 8px em botões e campos, 10px no botão Copiar só-ícone, no campo de busca da barra e no topo das abas, 14px nos painéis e na mensagem do dia, 12px nos cartões de mensagem e de unidade. Pílulas e abas de filtro são totalmente arredondadas. A exceção deliberada é a etiqueta de gôndola: retângulo reto com a ponta esquerda recortada em seta (`clip-path`), como uma etiqueta de prateleira. A aba ativa da barra superior tem só os cantos de cima arredondados e o mesmo fundo da página, para parecer uma aba de pasta encaixada no conteúdo.

## Components

### Etiqueta de Gôndola (componente assinatura)
Amarela, reta, com ponta recortada; o único objeto que grita.
- **Forma:** ponta esquerda em seta de 10px (8px na compacta), largura mínima de 100px (76px na compacta), alinhada à direita da linha.
- **Cor:** `gondola-yellow` com texto `ink`; promoção em `promo-red` com texto branco.
- **Conteúdo:** "R$" pequeno no topo e o valor formatado em pt-BR com duas casas. Leitores de tela recebem "R$" e "(promoção)" em texto oculto. Sem valor, mostra "Sem preço" em texto calmo, nunca uma etiqueta vazia.

### Buttons
- **Shape:** cantos suaves (8px), altura 36px (32px no tamanho `sm`).
- **Primary:** fundo verde CDT, texto branco; hover a 90% de opacidade.
- **Outline:** fundo branco, contorno `input-stroke`; hover em lavagem verde com texto verde.
- **Secondary / Ghost:** preenchimento quieto / sem fundo, hover em lavagem verde.
- **Focus:** anel de 2px verde CDT com afastamento de 1px.

### Botão Copiar
Uma das duas ações principais da Central.
- **Com texto:** contorno, 32px de altura, largura mínima fixa de 100px, texto 600 em verde. Ao copiar, troca o ícone por um check, o texto por "Copiado" e ganha borda verde e fundo lavagem verde por 1,5s, sem mudar de tamanho.
- **Só ícone:** 36×36px, cantos de 10px, ícone verde; usado nas linhas de preço ao lado da etiqueta.
- **Posição:** sempre no canto superior direito do cartão ou na última coluna da linha.

### Chips / Pílulas
- **Style:** 32px de altura, totalmente arredondadas, fundo branco com fio, texto 13px/500. Abas de seção (TabsTrigger) usam exatamente o mesmo desenho.
- **State:** ativa em tom "ink" (grafite sólido, texto branco) para filtros e seções; tom "brand" (verde sólido) reservado à trilha de etapas do Fluxo de Atendimento. Hover em lavagem verde.

### Cards / Containers
- **Painel:** branco, borda `hairline`, cantos de 14px, título em rótulo caixa-alta no canto superior esquerdo e ação opcional à direita. Linhas internas separadas por fio `quiet-fill`, conteúdo à esquerda, valor e ação à direita.
- **Cartão de mensagem / unidade:** branco, borda fina, cantos de 12px, 16px × 12px de respiro; título à esquerda, Copiar à direita, texto logo abaixo.
- **Shadow Strategy:** nenhuma (ver Elevation & Depth).

### Inputs / Fields
- **Style:** 36px de altura, fundo branco, contorno `input-stroke`, cantos de 8px; texto 16px em telas pequenas e 14px a partir de 768px.
- **Focus:** anel de 1px verde CDT.
- **Disabled:** 50% de opacidade.

### Navigation
- **Barra superior:** fundo verde CDT sólido. Abas em 13.5px/600: inativas em `cdt-green-muted`, hover com branco a 10%; a ativa ganha fundo `page-mist`, texto verde e cantos superiores de 10px. Busca em branco translúcido (14%) com atalho "Ctrl K" à direita.
- **Menu lateral:** branco, itens em `ink-soft` agrupados (Central, Inteligência, Administração) com ícone de 16px; item ativo em bloco verde CDT sólido com texto branco. Rodapé com e-mail, selo Admin e Sair.

### Cabeçalho de página
Título em headline, descrição opcional em body calmo, ações alinhadas à direita na mesma linha e quebrando para baixo na meia tela. Sem ícone decorativo.

## Do's and Don'ts

### Do:
- **Do** deixar a etiqueta de gôndola como o único elemento chamativo da tela: amarela para preço normal, vermelha só para promoção.
- **Do** usar cor de estado (perigo, sucesso, aviso) só onde ela significa algo.
- **Do** colocar o botão Copiar sempre no canto superior direito do cartão ou alinhado à direita da linha, com largura fixa e confirmação "Copiado" no próprio botão.
- **Do** testar todo layout entre 640px e 960px de largura, com o menu lateral recolhido em ícones.
- **Do** separar conteúdo com painéis brancos de fio fino sobre o fundo `page-mist`.
- **Do** usar o verde CDT sólido para marcar lugar (aba atual, item ativo) e a ação principal.
- **Do** filtrar com pílulas em tom "ink"; reservar o tom "brand" à trilha de etapas.

### Don't:
- **Don't** criar blocos ou atalhos com gradiente nem sombras decorativas em painéis, cartões e botões.
- **Don't** usar amarelo ou vermelho de etiqueta fora da etiqueta de preço.
- **Don't** usar Barlow Condensed fora do numeral de preço.
- **Don't** pintar cabeçalhos ou cartões inteiros de verde sólido.
- **Don't** mover o Copiar para a esquerda, para o rodapé do cartão ou mudar sua largura ao copiar.
- **Don't** criar layouts que só funcionam em tela cheia ou que exigem rolagem horizontal na meia tela.
