Tutoriais da Omnia: tours guiados por página ("Como usar a Omnia"). Cada página de atendente ganha um passo a passo curto que destaca um elemento por vez e explica o que ele faz. Abre pelo botão "?" do topo (hoje só mostra "Em breve: tutorial desta página") e, na 1ª visita a cada página, abre sozinho uma vez.

Fontes de verdade (leia antes de codar): `docs/tutoriais/tours-textos.md` (todos os textos e alvos, aprovados pelo Paulo) e os 3 esboços aprovados `docs/tutoriais/tour-inicio.png`, `tour-retomar.png` e `rever-tutoriais.png`. Os textos dos passos devem ser copiados EXATAMENTE como estão no arquivo, sem reescrever.

Regras de trabalho: sem harness visual nem capturas; use build, typecheck e o script de verificação descrito abaixo. Branch `tutoriais-tours`, um commit por seção, PR para a main sem merge. Não altere nenhuma regra de negócio, rota ou comportamento das páginas: o tour só observa a tela, nunca clica, nunca preenche e nunca altera nada. Código novo segue o padrão do projeto (TanStack Start, server functions com `requireSupabaseAuth`, Tailwind v4, tokens do tema claro e escuro). Português do Brasil em toda a interface.

## A. Biblioteca e visual
1. Instale `driver.js` (leve, sem dependências). Sem outras dependências novas.
2. Crie `src/components/tour/tour.css` com o visual OMNIA (importe uma vez), usando as variáveis do tema (claro e escuro, nunca cores fixas além do overlay):
   - Overlay escuro `rgba(11,11,11,.58)`; o elemento do passo fica destacado com borda dourada de 2px (`--gold`), raio 12px e respiro de 8px. Sem sombra colorida e sem animação exagerada.
   - Cartão: fundo `--surface`, borda 1px `--gold`, raio 14px, sombra `--shadow-overlay`, largura 330px (máx. `calc(100vw - 32px)`). Cabeçalho: contador "2/5" num círculo dourado de 34px (fundo `--gold`, texto preto, 12px, peso 600) ao lado do título em Cinzel 15px. Texto em Montserrat 13.5px, entrelinha 21px.
   - Rodapé: "Pular" como link de texto à esquerda (cor `--ink-muted`), "Voltar" (botão contorno, 34px) e "Próximo" (botão dourado com texto preto, 34px) à direita; no último passo "Próximo" vira "Concluir"; no primeiro, sem "Voltar". Abaixo, pontinhos de progresso (ativo dourado, outros cinza a 35%).
   - Nada de estilo de etiqueta de preço. Botões como o resto do app (GoldButton/OutlineButton se for simples reaproveitar a aparência; senão, CSS equivalente).
3. Acessibilidade: o cartão com `role="dialog"`, `aria-label` com o título do passo e foco no botão "Próximo" ao abrir cada passo; teclas Esc (fecha), seta direita/esquerda e Enter funcionam; respeitar `prefers-reduced-motion` (sem animação). Ao fechar, devolver o foco ao botão "?".

## B. Definição dos tours
1. `src/lib/tours.ts`: tipos e dados dos 12 tours de `tours-textos.md`, na ordem do arquivo. Para cada tour: `id` (o código entre crases, ex.: `inicio`, `scripts`, `cliente-disse`, `retomar`, `copiloto`, `raiox`, `biblioteca`, `meu-mapa`, `ranking`, `novidades`, `treinamentos`, `meus-relatorios`), `versao` (inteiro, começa em 1), `rotas` (pathname(s) onde o tour vale: `/`, `/scripts`, `/scripts/cliente-disse`, `/retomar`, `/copiloto`, `/raiox`, `/biblioteca`, `/meu-mapa`, `/ranking`, `/novidades`, `/treinamentos`, `/meus-relatorios`), `titulo` (nome na lista de "Rever tutoriais"), `passos` e, quando existir, `semResultado` (passo central).
2. Cada passo: `alvo` (seletor `[data-tour="<tour>-<n>"]`, ausente nos passos centrais), `titulo`, `texto`, `exigeResultado?` (os marcados "só com resultado") e `condicional?` (os marcados "só quando houver"/"só quando os botões aparecem").
3. Ao iniciar um tour, filtre os passos: remova os que têm `alvo` sem elemento visível na tela (existe no DOM, tem tamanho > 0 e não está escondido por `hidden`/`display:none`). Se algum passo `exigeResultado` foi removido, insira UMA vez o passo central `semResultado` no lugar do primeiro removido. Se, depois do filtro, sobrar menos de 1 passo, não inicia (e não marca como visto). O contador "n/total" usa a contagem depois do filtro.
4. Em telas pequenas, onde o menu lateral fica recolhido, o passo "Menu lateral" do Início é removido pelo mesmo filtro (não abra o menu sozinho).
5. Âncoras `data-tour`: adicione os atributos abaixo nos elementos certos, sem mudar layout nem classes. Procure cada elemento pelo nome/texto indicado.

| Âncora | Onde |
|---|---|
| inicio-1 | menu lateral (o `Sidebar` inteiro, `app-sidebar.tsx`) |
| inicio-2 | campo de busca central (o `label` da `CentralSearch`) |
| inicio-3 | o `nav` "Atalhos" |
| inicio-4 | o `ChecklistBlock` ("Check-list de hoje") |
| inicio-5 | o botão "?" (`HelpButton`) |
| scripts-1 / -2 / -3 | cards "Fluxo de atendimento", "Biblioteca de mensagens", "O cliente disse…" |
| scripts-4 | `HubSearchField` ("Buscar mensagem") |
| cliente-disse-1 | `TextTabs` "Ferramentas" (Objeções / Fechar com este cliente) |
| cliente-disse-2 | campo de texto onde se cola a fala do cliente (aba Objeções) |
| cliente-disse-3 | bloco da resposta aprovada (`exigeResultado`) |
| retomar-1 | lista da esquerda (a fila) |
| retomar-2 | a "Régua da cadência" (`ol` com 5 etapas) |
| retomar-3 | caixa da mensagem pronta (com Copiar) |
| retomar-4 | linha dos botões Enviei, Respondeu, Fechou, Perdido |
| retomar-5 | par "Fazer Raio-X desta venda" e "Voltar para a fila" (`condicional`) |
| copiloto-1 | bloco "Onde está a conversa" |
| copiloto-2 | os cartões Direta e Consultiva (`exigeResultado`) |
| copiloto-3 | `CasosParecidos` (`exigeResultado`) |
| copiloto-4 | faixa "Objeção encontrada" (`exigeResultado`) |
| copiloto-5 | botão "Adicionar à retomada" (`exigeResultado`) |
| raiox-1 | `ConversaCard` (entrada da conversa) |
| raiox-2 a -6 | blocos "Onde perdeu", "O que faltou", "Como eu responderia", "Qualidade da escrita", "Hábito para treinar" (`exigeResultado`) |
| biblioteca-1 | `TextTabs` "Biblioteca" (Materiais / Conversas que fecharam) |
| biblioteca-2 | sub-abas Imagens / PDFs |
| biblioteca-3 | campo "Buscar por título ou pasta..." junto com o filtro "Todas as pastas" |
| meu-mapa-1 | a lista de temas |
| meu-mapa-2 | o selo de nível do 1º tema (`NivelPill` + a linha de respostas) |
| meu-mapa-3 | o botão "Treinar este tema" do 1º tema |
| ranking-1 | cabeçalho e o bloco dos pódios |
| ranking-2 | as abas Pódios / Hall do mês / Meu histórico |
| ranking-3 | a seção "Hall do mês" |
| ranking-4 | o link/botão "Como é calculado" |
| novidades-1 | os filtros Todas / Importantes / Informativas |
| novidades-2 | a 1ª novidade importante (`condicional`) |
| novidades-3 | a seção "Informativas" |
| treinamentos-1 | campo "Buscar treinamento" |
| treinamentos-2 | o 1º módulo (cartão) |
| treinamentos-3 | o 1º botão "Fazer simulado" (`condicional`) |
| treinamentos-4 | a seção "Outros simulados" (`condicional`) |
| meus-relatorios-1 | título e campo de data da aba do usuário |
| meus-relatorios-2 | a tabela de canais (Canal, Tentativas, Oportunidades, Vendas) |
| meus-relatorios-3 | o botão "Salvar" da 1ª linha e a linha Total |

Para listas, use a âncora só no primeiro item (ex.: primeiro módulo). Se algum alvo da tabela não existir exatamente como descrito, escolha o elemento mais próximo, anote no PR e não invente UI nova.

## C. Memória do que já foi visto (1 migração)
1. Arquivo `supabase/migrations/20261203090000_tour_vistos.sql`, idempotente, no estilo das migrações da Fase C (GRANTs explícitos, RLS ativado, políticas explícitas de SELECT, INSERT e UPDATE apenas do próprio usuário):
   - Tabela `public.tour_vistos`: `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid()`, `tour_id TEXT NOT NULL CHECK (char_length(tour_id) BETWEEN 1 AND 60)`, `versao INT NOT NULL DEFAULT 1 CHECK (versao >= 1)`, `visto_em TIMESTAMPTZ NOT NULL DEFAULT now()`, `PRIMARY KEY (user_id, tour_id)`.
   - Sem políticas de DELETE (o usuário não apaga). Admin não precisa ler.
2. `src/lib/tours.functions.ts` (padrão de `ajuda.functions.ts`): `listarToursVistos` (GET: devolve `{ tour_id, versao }[]` do usuário) e `marcarTourVisto` (POST: valida `tour_id` e `versao` com zod, faz upsert por `(user_id, tour_id)` guardando a maior versão e atualizando `visto_em`).
3. Regra de "visto": o tour está visto se existe linha com `versao >= tour.versao`. Se o tour subir de versão, volta a abrir sozinho uma vez.

## D. Comportamento
1. `src/components/tour/TourProvider.tsx` dentro do layout `_authenticated/route.tsx` (envolve o conteúdo, dentro do SidebarProvider). Expõe `useTour()` com: `tourDaRota` (o tour da rota atual ou nulo), `iniciar(id?)`, `iniciarAposNavegar(id)`, `situacao(id)` (`"nao_visto" | "novo" | "visto"`) e `carregando`.
2. **Botão "?" (`HelpButton`)**: se a rota tem tour, clique inicia o tour; tooltip "Tutorial desta página". Se não tem, o botão continua visível, o tooltip diz "Esta página ainda não tem tutorial" e o clique abre a Central de Ajuda (`/ajuda`). Mantenha `aria-label` coerente.
3. **Abertura automática (1ª visita)**: ao entrar numa rota com tour NÃO visto (ou com versão nova), inicia sozinho depois de a página estar pronta: aguarde até 3 segundos, conferindo a cada 200 ms se o 1º alvo existe; se não aparecer, não inicia e não marca. Não inicia se houver outro diálogo/aviso aberto (`[role="dialog"]` ou `[role="alertdialog"]`, ex.: os avisos de Follow-up, Aquecimento e Mudanças, a busca global e o painel de login); nesse caso tenta de novo quando o diálogo fechar, no máximo uma vez por visita à página. Nunca abre em telas de login/pendente. Nunca roda dois tours ao mesmo tempo.
4. **Marcar como visto**: ao concluir, ao clicar em "Pular" e ao fechar com Esc ou pelo X, chame `marcarTourVisto` com a versão do tour (uma vez por execução). Nada de marcar quando o tour nem chegou a abrir. Falha de rede ao marcar não deve quebrar nada nem mostrar erro (tenta de novo na próxima visita).
5. Se a rota mudar enquanto o tour está aberto, feche-o sem marcar como visto. Se o elemento do passo sumir da tela (por exemplo, a lista recarregou), avance para o próximo passo existente; se não houver, conclua.
6. `iniciarAposNavegar(id)`: guarda o pedido no provider, navega para a primeira rota do tour e inicia assim que a página estiver pronta (mesmo critério do item 3), mesmo que o tour já tenha sido visto; esse início não depende nem altera a regra de "visto" além de marcar a versão atual ao concluir.
7. O tour nunca clica, rola a página à força (apenas `scrollIntoView` suave do elemento do passo, sem animação se `prefers-reduced-motion`), nem grava nada além de `tour_vistos`.

## E. Rever tutoriais (Central de Ajuda)
1. Na Central de Ajuda (`/ajuda`), acrescente um `HubCard` "Tutoriais das páginas" (texto: "Passo a passo de cada página da Omnia.") que leva a uma nova rota `/ajuda/tutoriais-paginas`. NÃO altere o redirect `/tutoriais` existente.
2. A nova página segue o esboço `rever-tutoriais.png`: título "Tutoriais das páginas", um painel com o cabeçalho "Rever tutoriais" e a frase "Cada página tem um passo a passo curto. Clique para abrir; ele roda na própria página.", e uma linha por tour (na ordem de `tours.ts`) com o `titulo`, a situação ("Visto", "Novo" para tour visto numa versão antiga, "Não visto") e um botão: "Rever" (se visto) ou "Ver agora" (se novo/não visto). "Novo" e "Não visto" aparecem em dourado. Rodapé: "Também dá para abrir o tutorial da página em que você está pelo botão “?” no topo."
3. O botão chama `iniciarAposNavegar(id)`. Breadcrumb: Central de Ajuda › Tutoriais das páginas. Carregamento e erro com o mesmo padrão discreto do app.

## F. Verificação (sem runner de testes)
1. `scripts/verificar-tours.mjs` e o script `npm run verificar:tours`: lê `src/lib/tours.ts` e confere que (a) todo `alvo` `data-tour="x"` aparece pelo menos uma vez no `src/` (em `.tsx`), (b) não há `data-tour` repetido sem necessidade, (c) cada tour tem entre 3 e 7 passos antes do filtro, (d) nenhum texto de passo passa de 2 frases (conte por `.`, `?` e `!` finais) e (e) todo `id` de `tours.ts` aparece em `tours-textos.md`. O script sai com erro se algo falhar. Rode-o junto com typecheck e build.
2. Estes casos devem estar cobertos por funções puras em `tours.ts` (exportadas), conferidos pelo mesmo script ou por um teste simples em Node, sem nova dependência: filtro de passos sem alvo; inserção única do passo `semResultado`; regra de versão (`visto` / `novo` / `nao_visto`).

## Entrega
PR com o que mudou, a lista das âncoras adicionadas (arquivo e elemento) e qualquer alvo escolhido de forma diferente da tabela. Informe a migração `20261203090000_tour_vistos.sql` para o Paulo rodar no editor SQL do Lovable ANTES do merge, e lembre-o de que, depois do merge, é preciso pedir ao chat do Lovable para regenerar `src/integrations/supabase/types.ts`. Peça ao Paulo para testar na prévia: (1) abrir uma página pela 1ª vez (o tour abre sozinho), (2) clicar em "Pular" e recarregar (não deve abrir de novo), (3) o botão "?" reabrir o tour, (4) Central de Ajuda › Tutoriais das páginas › "Rever", (5) Copiloto e Raio-X sem resultado (passo central) e depois com resultado, (6) tema escuro e tela estreita.
