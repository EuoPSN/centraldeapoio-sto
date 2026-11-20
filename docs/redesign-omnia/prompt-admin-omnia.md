Página 8 (última) do redesign OMNIA Apoio: Painel Admin (rota /admin, src/routes/_authenticated/admin.tsx, componentes em src/components/admin/, seções na tabela admin_sections). Siga os tokens e regras da marca de docs/redesign-omnia/prompt-lovable-base-omnia.md.

Esboços aprovados (siga fielmente):
- docs/redesign-omnia/admin-opcao-b-entrada.png (entrada: "O que precisa de você" + cards das seções)
- docs/redesign-omnia/admin-opcao-b-secao.png (dentro de uma seção: barra de topo com seletor + lista + painel de edição)

Contagens, nomes e itens dos esboços são ilustrativos.

IMPORTANTE SOBRE O MODO DE TRABALHO
- NÃO monte harness visual, servidor de preview com Playwright nem tire capturas de tela. Eu reviso as telas. Valide com build e typecheck.
- Parta do estado atual da main (MarcIAna, Simulador e Central de Ajuda já aplicados).
- Este PR é grande. Faça na ordem das seções abaixo, um commit por seção. Se perceber que não vai caber tudo, termine as seções 1 a 5 com qualidade, pare, abra o PR e liste no PR quais seções do Admin ainda estão no layout antigo (eu rodo uma segunda parte depois). Não deixe nenhuma seção quebrada pela metade.

## 1. Estrutura e navegação (sem barra lateral interna)
- Remova a coluna lateral de seções do Admin (a lista de 220px com grupos).
- Barra de topo do Admin (abaixo do cabeçalho do site, borda inferior line):
  - Na entrada: botão/etiqueta "Painel Admin" à esquerda e busca "Buscar seção ou item…" à direita (≈300px).
  - Dentro de uma seção: link "← Painel Admin" (muted), seletor "<Grupo> › <Seção> ⌄" (contorno; abre um menu com todas as seções agrupadas, com as contagens de pendência) e a busca à direita.
- Rotas: /admin (entrada) e /admin/<chave-da-seção> (ex.: /admin/contatos). Mantenha compatibilidade com o formato atual de URL, redirecionando.
- Novos grupos (atualize admin_sections.group_name e position por migração; não apague linhas):
  - Atendimento: Mensagens e scripts (messages + scriptreview juntos ou lado a lado, como fizer mais sentido no código atual), Fluxos (atendimentos), Amor Saúde (pricing + clínicas), Contatos
  - Inteligência: Base IA (knowledge), IA e indexação (ai), Conhecimento do cliente (clientknowledge), MarcIAna (sugestões de pergunta + perguntas sem boa resposta)
  - Treino: Perfis de cliente (perfis), Situações-problema (problemscenarios), Resultados do simulador (+ configuração "Nota de referência"), Treinamentos, Check-list
  - Central de Ajuda: Procedimentos e Problemas técnicos (o antigo "Conteúdo (legado)", separado pelas seções tutoriais/problemas), Novidades (changelog), Sugestões (suggestions)
  - Equipe e sistema: Usuários, Unidades, Menu e abas (menu + organizacao), Tela inicial (homemsg), Categorias (taxonomy), Imagens (imagelibrary)
- Saem: Aparência (appearance) — esconda a seção (visible=false) e remova o componente se não for usado em mais nada; Planos em promoção (promoplans) — visible=false, sem apagar dados (volta na futura aba Produtos).

## 2. Entrada — admin-opcao-b-entrada.png
- Título "O que precisa de você" (24px). Lista de pendências, cada linha: número grande (tabular, 600), título 600, linha de contexto muted, e "Resolver →" (link dourado) que leva à seção já filtrada no item pendente. Linhas com 0 ficam esmaecidas com o contexto "Tudo em dia" e sem link; esconda as zeradas se todas as outras tiverem pendência e a lista passar de 6.
  - Sugestões e dúvidas em análise (status pendente/em análise) — contexto: data da mais antiga.
  - Scripts enviados para revisar (fila do Criar Scripts/scriptreview) — contexto: autores e categoria.
  - Perguntas sem boa resposta na MarcIAna (marciana_feedback não útil e não resolvido) — contexto: motivo mais citado.
  - Artigos da Central marcados "Não ajudou" (ajuda_feedback util=false ainda não tratado: crie coluna resolvido_em) — contexto: título do artigo com mais "Não".
  - Itens da Amor Saúde sem clínica vinculada — contexto: nome do primeiro item.
  - Contatos sem atualização há mais de 90 dias (updated_at) — contexto: nome do mais antigo.
- Overline "SEÇÕES" e 5 cards (grid de 5 colunas; 2–3 em telas menores): cabeçalho com ícone em círculo de borda dourada (30px) + nome do grupo e linha fina embaixo; depois uma linha por seção (13.5px), cada uma clicável, com fundo hover ao passar o mouse e, quando houver, a contagem de pendências em pílula dourada à direita. Sem texto corrido separado por pontos.
- Contagens: crie uma única função de servidor que devolve todas as contagens de uma vez (para a entrada, o seletor e o ponto do menu).

## 3. Padrão de seção: lista + painel de edição — admin-opcao-b-secao.png
- Crie um layout reutilizável (ex.: AdminListDetail): à esquerda a lista (título 24px, botões de ação à direita do título — "+ Novo …" dourado e ações secundárias em contorno, como "Preencher com IA"; filtros em pílula; busca pequena; linhas de 48px com o item ativo em fundo sidebar e linha dourada à esquerda) e à direita um painel fixo (~480px, borda esquerda line) com overline "EDITANDO · <tipo>", título do item, o formulário e o rodapé "Salvar" (dourado) · "Cancelar" (contorno) · "Excluir" (texto muted à direita, com confirmação).
- "+ Novo" abre o painel vazio ("NOVO · <tipo>"). Sem item selecionado, o painel mostra uma instrução curta ("Escolha um item na lista ou crie um novo.").
- Substitua os modais (Dialog) de criação/edição por esse painel em todas as seções de cadastro em lista. Confirmações de exclusão continuam em diálogo pequeno.
- Seções que não são lista (ex.: IA e indexação, Menu e abas, Tela inicial, configurações) mantêm o conteúdo atual, só dentro da nova moldura e com o visual da marca (sem cards com sombra, sem cores fora da paleta).
- Mostre "Atualizado em dd/mm" na linha quando a tabela tiver updated_at.

## 4. Busca do Admin
- "Buscar seção ou item…": procura nomes de seções e itens das principais tabelas (contatos, itens da Amor Saúde, mensagens/scripts, perfis de cliente, artigos da Central, base de conhecimento por título). Resultados agrupados por seção; Enter/clique abre a seção com o item selecionado no painel. Atalho: "/" quando o foco não estiver num campo.

## 5. Link "Editar" nas páginas do site
- Só para admin: no topo de cada página do site, à esquerda do botão "?", link de texto dourado "Editar" que abre a seção correspondente do Admin (ex.: /contatos → /admin/contatos; /amor-saude → /admin/amor-saude; /scripts → /admin/mensagens; /assistente → /admin/marciana; /simulador-ia → /admin/perfis; /ajuda/* → seção correspondente; Início → /admin/tela-inicial). Páginas sem seção correspondente não mostram o link. Atendentes nunca veem.

## 6. Ponto no menu
- No item "Painel Admin" do menu lateral do site, mostre o total de pendências em pílula dourada pequena (só admin; esconda quando 0).

## Geral
- Remova o título antigo grande do Admin com ícone e os cards com sombra.
- Estados vazios e mensagens de erro simples. Respeite temas claro e escuro.

Trabalhe numa branch omnia-admin, um commit por seção, rode build e typecheck, e abra um Pull Request para a main. Não faça merge sozinho. No PR: migrações a rodar no SQL editor do Lovable Cloud (em ordem, com o SQL pronto para colar), seções que mudaram de grupo, seções escondidas, e, se tiver parado antes do fim, a lista do que ficou para a parte 2.
