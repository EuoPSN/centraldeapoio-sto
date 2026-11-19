Vamos aplicar a nova identidade OMNIA Apoio na base do site (antiga Central de Apoio CDT). Esta etapa muda SOMENTE a base visual: cores, fontes, logo, favicon, menu lateral, tema claro/escuro e tela de login. NÃO mude o layout interno das páginas (Início, Scripts, Preços etc.), nem lógica, server functions ou banco: as páginas serão redesenhadas uma a uma depois. Elas só herdam as novas cores e fontes.

Anexei os arquivos da marca (logos e favicons). Salve-os em src/assets/omnia/ (logos) e public/ (favicons).

## 1. Nome
- O site passa a se chamar "OMNIA Apoio" (título da aba, cabeçalhos, login, meta tags).
- O logo da Cartão de Todos sai do menu lateral e do login.

## 2. Cores (tokens), tema claro e escuro
Substitua a paleta atual em src/styles.css pelas cores OMNIA, mapeando nas variáveis do shadcn (background, foreground, card, muted, primary, border, input, ring, sidebar etc.):

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| surface | #FFFFFF | #0B0B0B | fundo principal |
| surface-2 | #F2F0EB | #17131F | cards, faixas, áreas secundárias |
| sidebar | #FAF9F6 | #111014 | fundo do menu lateral |
| ink | #0B0B0B | #F5F5F0 | texto principal |
| ink-muted | #5C564C | #B8B2A6 | texto secundário |
| gold | #B58A35 | #D4AF37 | primary: botão principal, item ativo, ícones, títulos ≥24px |
| gold-text | #8A6623 | #D4AF37 | texto e links pequenos em dourado |
| on-gold | #0B0B0B | #0B0B0B | texto sobre fundo dourado (NUNCA branco sobre dourado) |
| nebula | #5A2D91 | #A98BDB | roxo complementar, no máximo 5% da tela |
| line | #E4E0D6 | #2A2433 | divisórias e bordas de cards |
| line-strong | #8C8578 | #6E6680 | borda de inputs e controles |

Regras: dourado nunca como texto pequeno no tema claro (use gold-text); botão principal = fundo gold + texto on-gold; cores de estado (erro, alerta, sucesso) continuam existindo, só onde têm significado.

Raios: 4px (inputs, tags), 8px (botões, cards), 16px (painéis grandes), 999px só para avatar e o botão de tema. Remova sombras decorativas: separe por borda fina (line) e espaço.

## 3. Fontes (Google Fonts)
- Cinzel (500/600): só para o nome OMNIA, a saudação da Início e títulos institucionais grandes, sempre em CAIXA ALTA com letter-spacing de 0.08em a 0.14em. Nunca em texto corrido.
- Montserrat (300/400/500/600): todo o resto. 400 texto, 500 títulos de interface e botões, 600 rótulos de grupo, 300 para descritores em caixa alta (ex.: "APOIO", com letter-spacing 0.24em).
- Escala: título de página 24/32 (Montserrat 500), subtítulo 18/28, corpo 16/26 (interface densa pode usar 14/22), overline 12/16 em caixa alta com letter-spacing 0.12em.

## 4. Tema claro/escuro
- Primeiro acesso: se o usuário ainda não escolheu, mostre um pequeno modal "Como você prefere ver a OMNIA Apoio?" com dois cartões (Claro / Escuro) e a opção "Seguir o sistema" pré-selecionada conforme o prefers-color-scheme.
- Salve a escolha por usuário (no perfil do Supabase, para valer em qualquer computador; use localStorage só como cache).
- Botão de alternância sol/lua no canto superior direito do topo, formato pílula (sol à esquerda, lua à direita, o lado ativo com círculo dourado). Clicar alterna na hora.
- Transição suave das cores em 250ms. Respeite prefers-reduced-motion.
- Remova o seletor de temas coloridos antigo (src/lib/themes.ts, ThemeProvider de presets, aba Aparência do Admin) e faça o active_theme salvo no banco deixar de alterar as cores. Deixe um comentário no código: "temas coloridos podem voltar numa atualização futura".

## 5. Menu lateral em sanfona
Estrutura (os itens continuam vindo da tabela nav_items; adicione o agrupamento):
- Início (fixo, fora dos grupos)
- ATENDIMENTO: Scripts, Tabela de Preços (Amor Saúde), Contatos e Endereços, Biblioteca
- INTELIGÊNCIA: MarcIAna
- TREINO E EVOLUÇÃO: Simulador IA, Treinamentos, Check-list, Ranking
- CONTRIBUIR: Criar Scripts
- ADMINISTRAÇÃO (só admin): Painel Admin, Conhecimento
- Rodapé fixo: Central de Ajuda (por enquanto leva para Problemas Técnicos; Tutoriais e Sugestões continuam acessíveis por ela até unificarmos a página), avatar + nome + papel do usuário, Sair.

Comportamento:
- Títulos de grupo em overline (12px, caixa alta, letter-spacing 0.12em, Montserrat 600, ink-muted) com chevron. Abrir um grupo fecha o anterior. O grupo da página atual abre sozinho.
- Ao abrir, os itens aparecem em cascata: cada item entra com fade + leve deslize de 4px, com 30ms de atraso entre um e outro, duração total abaixo de 250ms. Nada de "pulo". Com prefers-reduced-motion, abre sem animação.
- Itens do grupo ficam recuados com uma linha vertical fina (line) à esquerda; item ativo em gold-text, peso 600, com um pequeno ponto dourado na linha.
- Topo do menu: símbolo OMNIA (32px) + nome OMNIA (logo horizontal sem slogan, versão do tema) + descritor "APOIO" em Montserrat 300 caixa alta. Abaixo, campo "Buscar… Ctrl K" (abre a busca global atual).
- Fundo do menu neutro (sidebar), sem cor forte; borda direita fina (line).
- Modo recolhido: o menu vira uma barra flutuante e arredondada (radius 16px, 64px de largura, afastada 12px das bordas, fundo sidebar, borda line) só com ícones (traço 1.5px), cada grupo virando um ícone que abre um menu suspenso com suas páginas. Tooltip com o nome. Alterna pelo botão de recolher que já existe; lembra a escolha.
- Ícones de traço fino (lucide, strokeWidth 1.5), em ink-muted; no item ativo, gold.

## 6. Tela de login (estilo dividido)
- Duas metades. Esquerda (surface): símbolo + "OMNIA / APOIO" pequeno no topo do bloco, título "BEM-VINDO DE VOLTA" em Cinzel, subtítulo "Entre para acessar scripts, preços e a MarcIAna.", campos E-mail e Senha (borda line-strong, radius 8), botão "Entrar" gold com texto on-gold, link "Esqueci minha senha" em gold-text. Mantenha todos os fluxos atuais (cadastro, aprovação pendente, recuperação de senha).
- Direita: fundo escuro com gradiente sutil (preto #0B0B0B → #17131F → #2A1A42 no canto inferior direito), duas órbitas: círculos finos (1–1.5px) em #D4AF37 com 22–35% de opacidade, cortando a área; no centro, o logo vertical OMNIA versão fundo escuro (≈360px de largura); embaixo, em pequeno, "Atendimento da equipe de Venda Interna" em #B8B2A6.
- No celular, só a metade esquerda, com o símbolo no topo.

## 7. Favicon e metadados
- Favicon: omnia-favicon.svg (+ favicon-32.png de fallback), apple-touch-icon: favicon-180.png, manifest: favicon-192.png.
- <title>: "OMNIA Apoio". theme-color: #0B0B0B.

## Regras da marca (não quebrar)
- Não aplicar sombra, brilho, contorno, gradiente ou galáxia atrás do símbolo. O gradiente só existe em painéis de fundo (login e, depois, a faixa da Início), nunca no logo.
- Não distorcer o logo nem redesenhar o símbolo.
- Nada de texto em gradiente, glow em cards, vidro desfocado ou ícones de brilho/estrelinhas.

Ao final, liste os arquivos alterados e confirme que build e tipos passam. Teste nos dois temas: login, menu aberto e recolhido, troca sol/lua, e uma página qualquer (ex.: Scripts) para conferir que nada quebrou com as novas cores.
