Página 7 do redesign OMNIA Apoio: Central de Ajuda (junta as rotas atuais /tutoriais, /problemas e /sugestoes, e mostra o Changelog). Siga os tokens e regras da marca de docs/redesign-omnia/prompt-lovable-base-omnia.md e o padrão lista + detalhe de Contatos/Amor Saúde.

Esboços aprovados (siga fielmente):
- docs/redesign-omnia/ajuda-hub.png (entrada)
- docs/redesign-omnia/ajuda-artigo.png (Procedimentos; Problemas técnicos segue o mesmo modelo)
- docs/redesign-omnia/ajuda-sugestoes.png (Sugestões e dúvidas)

Títulos, contagens, artigos e solicitações dos esboços são ilustrativos: tudo vem do banco.

IMPORTANTE SOBRE O MODO DE TRABALHO
- NÃO monte harness visual, servidor de preview com Playwright nem tire capturas de tela. Eu reviso as telas. Valide com build e typecheck.
- Parta do estado atual da main.

## Rotas e menu
- /ajuda (entrada), /ajuda/procedimentos, /ajuda/problemas, /ajuda/novidades, /ajuda/sugestoes. Procedimentos e Problemas aceitam ?artigo=<id>.
- Redirecione /tutoriais → /ajuda/procedimentos, /problemas → /ajuda/problemas, /sugestoes → /ajuda/sugestoes (mantendo parâmetros).
- No menu: "Central de Ajuda" fica fixo no rodapé da barra lateral (já previsto na base) e sai qualquer item separado de Tutoriais, Problemas Técnicos e Sugestões (atualize nav_items com migração; não apague linhas, desative).
- A seção "tutoriais" de content_items passa a se chamar na interface "Procedimentos do atendimento" (não renomeie no banco).
- NÃO crie nada de "Como usar a Omnia" nesta etapa (vem no final do projeto, em outro formato).

## Botão "?" em todas as páginas
- No topo de todas as páginas, à esquerda do botão de tema sol/lua: botão redondo "?" (30px, borda line-strong, texto muted). Tooltip "Em breve: tutorial desta página". Ao clicar, não faz nada (sem modal, sem navegação). Deixe o componente pronto para receber, no futuro, um destino por rota (ex.: mapa rota → conteúdo), sem implementar o conteúdo agora.

## 1. Entrada — ajuda-hub.png
- Overline "CENTRAL DE AJUDA", título "COMO PODEMOS AJUDAR?" (Cinzel, caixa alta), busca grande "Busque um procedimento, problema ou novidade…" que procura em título e texto de procedimentos, problemas técnicos e novidades, com resultados agrupados por tipo.
- 4 cards (componente de portas já usado em Scripts/Amor Saúde): Procedimentos do atendimento ("N artigos"), Problemas técnicos ("N artigos"), Novidades ("Última: dd/mm", selo dourado "N novas" quando houver não vistas), Sugestões e dúvidas ("Você tem N em análise", ou "Mande uma ideia ou dúvida").
- "Mais vistos esta semana": até 5 artigos mais abertos nos últimos 7 dias (registre cada abertura de artigo numa tabela simples de visualizações). Se não houver dados, esconda o bloco.

## 2. Procedimentos e Problemas técnicos — ajuda-artigo.png
- Cabeçalho: título da seção (24px), busca "Buscar na Central…" à direita, abas de texto Início · Procedimentos · Problemas técnicos · Novidades · Sugestões e dúvidas.
- Lista à esquerda (≈340px): overline com o nome da seção e uma linha por artigo (ordem do Admin), ativa com fundo sidebar e linha dourada à esquerda. Primeiro artigo já aberto. NÃO mostre a etiqueta "Vídeo" nas linhas por enquanto.
- Artigo: overline "PROCEDIMENTO" ou "PROBLEMA TÉCNICO", título (24px), **bloco de vídeo** e **passo a passo**:
  - Bloco de vídeo no mesmo formato da capa "Para quem é" dos Scripts: capa escura no gradiente da marca (#0B0B0B → #17131F → #2A1A42), 300px de altura, cantos 14px. Nesta etapa NÃO há vídeo nem campo no banco: a capa mostra só o texto "Vídeo em breve" em #B8B2A6. Reaproveite/estenda o componente da capa do "Para quem é" com a prop opcional de vídeo, para o vídeo entrar no futuro nos dois lugares.
  - Passo a passo: se o texto do artigo tiver linhas numeradas ou em lista, mostre como passos numerados (círculo surface-2 com o número + texto); senão, mostre o texto formatado normalmente. Imagens já existentes no conteúdo continuam aparecendo.
- Rodapé do artigo: "Isso ajudou?" com botões "Sim" e "Não" (contorno) e, à direita, link dourado "Não resolveu? Avisar o Paulo →", que abre /ajuda/sugestoes?tipo=duvida&artigo=<id>.
- "Isso ajudou?": nova tabela `ajuda_feedback` (content_item_id, user_id, util boolean, created_at; um por usuário por artigo, editar substitui). Após clicar, troque os botões por "Obrigado pelo retorno." No Admin, na área de conteúdos, mostre por artigo: Sim / Não e a lista dos "Não" mais recentes.

## 3. Novidades
- Lista do Changelog existente por data (mais recente primeiro), no mesmo visual de lista: data em muted, título 600, texto. Itens que o usuário ainda não viu com um ponto dourado.
- Não vistos: guarde por usuário a data da última visita a /ajuda/novidades (coluna ou tabela simples). Enquanto houver item mais novo que essa data, mostre um ponto dourado (7px) no item "Central de Ajuda" do rodapé do menu e o selo "N novas" no card da entrada. Ao abrir Novidades, marque como vistas.

## 4. Sugestões e dúvidas — ajuda-sugestoes.png
- Duas colunas: formulário à esquerda e "MINHAS SOLICITAÇÕES" à direita.
- Formulário: "TIPO" em pílulas (Sugestão · Dúvida · Novo script · Novo fluxo · Melhoria, mesmos valores atuais), "TÍTULO", "DESCRIÇÃO" (placeholder "Conte o que aconteceu e o que você tentou…"), botão "Enviar" (dourado).
- Se vier com ?artigo=<id>: mostre o bloco surface-2 "Sobre o artigo: <título> (veio do 'Não resolveu?')" e salve o vínculo com o artigo na sugestão (coluna opcional). ?tipo= pré-seleciona o tipo.
- Minhas solicitações: data · título · status em pílula (Em análise = contorno; Respondida = surface-2; Feito = dourado com texto preto; use os status que já existem, mapeando os nomes) · tipo em muted. Clicar abre a resposta do admin, se houver.

## Geral
- Remova o visual antigo das páginas de Tutoriais, Problemas Técnicos e Sugestões (ContentList em cards).
- Estados vazios simples. Respeite temas claro e escuro.

Trabalhe numa branch omnia-ajuda, um commit por seção, rode build e typecheck, e abra um Pull Request para a main. Não faça merge sozinho. No PR: migrações a rodar no SQL Editor do Supabase (em ordem), tabelas/colunas novas, rotas novas e redirecionamentos, e o que mudou no menu e no Admin.
