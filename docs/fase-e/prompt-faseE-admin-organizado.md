Fase E da OMNIA Apoio: **Painel Admin mais organizado**. Entregas: (1) 7 grupos novos, com renomeações; (2) nova entrada "O que precisa de você" (pendências com trabalho em cima, zeradas recolhidas, novos avisos); (3) novo seletor de seções, com **abas de grupo + seções do grupo sempre visíveis**; (4) remoção de páginas e seções mortas; (5) um arquivo por seção do Admin, sem mudar o comportamento.

Documentos e esboços aprovados (siga fielmente; números e nomes de pendências são ilustrativos): docs/fase-e/mapa-admin.md (levantamento que originou esta fase), docs/fase-e/admin-entrada.png (entrada) e docs/fase-e/admin-seletor-b.png (seletor de seções). O esboço de seletor em lista suspensa foi **descartado**: o Paulo achou longo e cansativo.

Regras de trabalho (as mesmas das fases anteriores): sem harness visual nem capturas; migração idempotente com SQL para o SQL editor do Lovable; admin com `private.has_role(auth.uid(), 'admin'::app_role)`; nunca apagar tabelas nem dados de negócio; nada de telefone, nome nem fala de cliente. Branch `fase-e-admin-organizado`, **um commit por seção**, build + typecheck + testes + `npm run verificar:tours`, Pull Request para a main **sem merge**. No PR: migração, o que não foi possível validar sem navegador, e qualquer divergência dos esboços.

## 1. Novos grupos e nomes (migração em `admin_sections`)
Uma migração `faseE_admin_reorganizacao.sql`, idempotente, que só faz UPDATE por `tab_key` (grupo, rótulo, posição) e DELETE das linhas mortas. Grupos, na ordem, com as seções em ordem de posição (10, 20, 30…):
- **Atendimento:** messages (Mensagens e scripts) · atendimentos (Fluxos) · roteirosaudio (Roteiros de áudio) · scriptsligacao (Scripts de ligação) · pricing (Amor Saúde) · duvidas (Dúvidas frequentes) · contatos (Contatos).
- **Vendas e retomada:** objecoes · objecoesnovas · fechamento · economia · cadencia · motivosperda · mensagensvendem · conversasenviadas (rótulos como hoje).
- **Inteligência:** cerebro (Cérebro da Omnia) · knowledge (Base IA) · ai (IA e indexação) · clientknowledge (Conhecimento do cliente) · marciana (MarcIAna).
- **Treino:** perfis · problemscenarios · treinamentos · checklist · bancoexercicios · aquecimentoadmin.
- **Equipe e resultados:** raioxequipe (Raio-X da equipe) · mapaequipe (Mapa da equipe) · simuladorresultados (Resultados do simulador) · rankingadmin (Ranking) · extensaoadmin (Extensão do WhatsApp).
- **Central de Ajuda:** procedimentos · problemastecnicos · changelog (rótulo **Mudanças e novidades**) · suggestions.
- **Sistema** (substitui "Equipe e sistema"): users · unidades · menu (Menu e abas) · homemsg (Tela inicial) · taxonomy (Categorias) · imagelibrary (rótulo **Biblioteca de imagens**).
- Mantém escondidas (`visible = false`), sem mexer: scriptreview, telemedicina, organizacao, promoplans.
- **Remove** as linhas `content` (Conteúdo legado) e `appearance` (Identidade) de `admin_sections`, e as entradas correspondentes em `ADMIN_TAB_COMPONENTS` e no restante do código. Não apague tabelas nem a lógica de tema (`themes`, `ThemeController`); só a seção morta do Admin.
- Atualize `ADMIN_GROUP_ORDER` em AdminShell para os 7 grupos novos. Redirecionamentos: um `tab_key` removido ou renomeado deve levar a `/admin` sem erro; os links antigos `?aba=<tab_key>` continuam funcionando.

## 2. Entrada do Admin (ver admin-entrada.png)
- Em `admin.index.tsx`: "O que precisa de você" mostra só as pendências com `count > 0`, ordenadas da maior para a menor; as zeradas ficam numa faixa recolhível **"Em dia (N)"** com os títulos separados por vírgula e o botão "Ver ⌄" que expande a lista; se tudo estiver zerado, só a faixa e o texto "Tudo em dia".
- Novos avisos em `admin-pending.functions.ts` (mesmo formato dos existentes, com `bySection`): **Roteiros de áudio em rascunho** (`roteiros_audio` com status rascunho; contexto "Sem áudio de exemplo" se houver rascunho sem `audio_url`), **Scripts de ligação em rascunho** (`roteiros_ligacao` com status rascunho; só aparece se houver), **Teleconsulta sem especialidades** (nenhum `telemedicina_itens` com `tipo = 'teleconsulta'`; contagem 1 e href para Amor Saúde > Teleconsulta). Mostre o selo "novo aviso" apenas nesta primeira versão (flag simples no item, pode sair numa fase futura).
- Grade "Seções": 7 cartões (4 + 3 por linha em telas largas; 1 a 2 colunas em telas menores), cada cartão com o ícone, o nome do grupo, "N seções · M pendências" (singular quando for 1) e as seções com a pílula dourada onde houver pendência. Atualize os textos de acordo com as contagens por `bySection`; some por grupo no cliente.

## 3. Seletor de seções (ver admin-seletor-b.png)
- Em `AdminTopBar` (AdminShell): **remova o `DropdownMenu`** com todas as seções. Mantenha "← Painel Admin" e a busca "Buscar seção ou item…" (mesmo comportamento atual).
- Abaixo da barra, uma linha de **abas de grupo** (botões em pílula; o grupo da seção atual em preto, com a pílula de pendências nos demais grupos) e, na linha seguinte, as **seções do grupo atual** (a atual com fundo cinza claro e sublinhado dourado, pílula de pendências onde houver). Clicar num grupo abre a primeira seção dele (a de menor posição); clicar numa seção navega para ela. Quebra de linha permitida; em telas pequenas, rolagem horizontal em cada linha.
- Sem seção atual (`/admin`), nenhuma aba fica ativa. Acessibilidade: `role="tablist"`/`tab`, foco visível, `aria-current` na seção atual. Respeita `prefers-reduced-motion`.

## 4. Remoções
- **Páginas antigas sem link no menu:** apague as rotas `/dashboard`, `/funcionarios`, `/crm-leads`, `/crm-prospeccao` e `/motor-decisao`, seus componentes exclusivos e as entradas delas na busca global (`GlobalSearch.tsx`), em `EditPageLink.tsx` e em qualquer lista de rotas. **Cuidado:** antes de apagar uma função de servidor, confirme se algo ainda a usa. Em especial, `touchLastSeen` de `dashboard.functions.ts` é usada em `routes/_authenticated/route.tsx` e **deve continuar**; funções de `painel.functions.ts` e `metas.functions.ts` só saem se nada mais as chamar. Tabelas e dados ficam como estão.
- Migração: apagar de `nav_items` as linhas com `route` em ('/dashboard', '/funcionarios', '/crm-leads', '/crm-prospeccao', '/motor-decisao').
- Regenerar `routeTree.gen.ts` do jeito normal do projeto (sem edição manual).
- Liste no PR o que foi removido e o que foi mantido por ainda ter uso.

## 5. Um arquivo por seção (sem mudar comportamento)
- Separe `CoreTabs.tsx` (AiTab, ProcedimentosTab, ProblemasTecnicosTab, UsersTab), `ClienteDisseAdmin.tsx` (Objeções, Objeções novas, Fechamento, Economia), `RetomadaAdmin.tsx` (Cadência, Motivos de perda), `CerebroAdmin.tsx` (Cérebro, Raio-X da equipe) e `AquecimentoAdmin.tsx` (Mapa da equipe, Banco de exercícios, Aquecimento) em um arquivo por seção, com o que for compartilhado em um arquivo `*-shared.tsx` da mesma pasta. Em `PricingTab.tsx` (mais de mil linhas), separe ao menos as abas Consultas, Exames, Odontologia e Teleconsulta/PA em arquivos próprios, mantendo a tela igual.
- Só mova código; mesmos nomes exportados em `AdminShell.tsx`. Os testes existentes devem continuar passando sem alteração. Se algo exigir mudar comportamento, deixe como está e relate no PR.

## Antes de terminar
`npm run build`, typecheck, testes e `npm run verificar:tours` (os tours do Admin, se houver, devem seguir achando as âncoras). No PR liste: a migração (também em docs/fase-e/migracoes-fase-e.md, com o passo "rodar no SQL editor do Lovable antes do merge"), o que foi removido e o que depende de teste no navegador (abas de grupo, "Em dia", pílulas de pendência).
