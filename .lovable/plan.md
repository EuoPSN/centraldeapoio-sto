# Plano — Fase 1: Dashboard Geral Administrativo

Entrega dividida em 3 fases, começando pelo Dashboard Geral. Visão Geral e Equipe virão em fases seguintes, reaproveitando as mesmas funções server.

## Escopo desta fase (apenas Dashboard Geral)

Nova rota `_authenticated/dashboard.tsx` protegida por `has_role('admin')`, com item no sidebar visível somente para admin.

### O que será exibido (com fontes reais de dados)

Cards principais:
- Total de usuários → `profiles`
- Usuários ativos (últimos 30d) → `access_logs`
- Simulações realizadas → `simulator_sessions`
- Simulações concluídas → `simulator_results`
- Média geral de desempenho → média de `simulator_results.score`
- Utilização da IA (mensagens 30d) → `chat_messages`
- Conteúdos mais acessados → `access_logs` filtrado por `resource_type='content'` (top 5)
- Taxa de conclusão de treinamentos → `training_completions / content_items(kind='treinamento')`

Gráficos (Recharts, já disponível):
- Evolução de simulados no tempo (linha, por dia)
- Evolução da nota média (linha)
- Utilização da plataforma por período (barra, acessos/dia)
- Ranking uso da IA (barra horizontal, top 10 usuários)
- Ranking de colaboradores (score médio, top 10)
- Ranking por cargo/"equipe" (score médio agrupado)

Indicadores operacionais:
- Colaboradores com maior evolução (delta score últimos 30d vs 30d anteriores)
- Colaboradores com queda de desempenho (delta negativo)
- Cargos com melhor resultado (média mais alta)
- Cargos com menor engajamento (menos acessos por membro)

Filtros globais no topo:
- Período (7d / 30d / 90d / customizado)
- Cargo (CLT, Estágio Manhã, Estágio Tarde, Todos)
- Usuário (dropdown)

Atualização automática: `useQuery` com `refetchInterval: 60_000` e `invalidate` em mutações.

## Estruturas de dados novas (migration)

Criar apenas o que hoje não tem fonte:

1. `training_completions` — registra conclusão de treinamento
   - user_id (uuid, ref profiles), content_id (uuid, ref content_items), completed_at, progress_pct
   - RLS: usuário lê/cria os próprios; admin lê tudo
2. Coluna `last_seen_at timestamptz` em `profiles`
   - Atualizada por um server fn `touchLastSeen` chamado no `_authenticated/route.tsx`
3. Índices para performance:
   - `access_logs(user_id, created_at)`
   - `simulator_results(user_id, created_at)`
   - `chat_messages(user_id, created_at)` (se colunas existirem)

Não altero nada em tabelas existentes além de adicionar `last_seen_at` e índices.

## Arquivos que serão criados/alterados

Novos:
- `supabase/migrations/<ts>_dashboard_infra.sql`
- `src/lib/dashboard.functions.ts` — server functions agregadas, todas protegidas por `requireSupabaseAuth` + checagem `has_role('admin')`
- `src/routes/_authenticated/dashboard.tsx` — página com cards + charts + filtros
- `src/components/dashboard/StatCard.tsx`
- `src/components/dashboard/RankingList.tsx`
- `src/components/dashboard/TrendChart.tsx`

Alterados (mínimo):
- `src/components/app-sidebar.tsx` — adicionar item "Dashboard" visível só para admin
- `src/routes/_authenticated/route.tsx` — chamar `touchLastSeen` uma vez ao montar

Não vou alterar: nenhum arquivo do fluxo de relatórios, prospecção, chat, admin, meus-relatórios, integrations/supabase/*.

## Segurança e performance

- Todas as funções server: `requireSupabaseAuth` + verificam `has_role(userId, 'admin')`; retornam 403 caso contrário.
- Agregações feitas no Postgres (SQL RPC ou queries com `.select` + `count`/`avg` do PostgREST), não no cliente.
- Uma única função `getDashboardOverview({ periodo, cargo, userId })` retorna todos os cards + séries num só round-trip, para reduzir latência.
- Ranking e séries paginados a top-N (10) para manter payload leve.

## Detalhes técnicos

- Charts: Recharts (`LineChart`, `BarChart`) — já usado no projeto via `src/components/ui/chart.tsx`.
- Filtros na URL via `validateSearch` no route file para deep-linking e refresh preservando estado.
- Loader usa `ensureQueryData`; componente usa `useSuspenseQuery`.
- `errorComponent` e `notFoundComponent` obrigatórios no route.

## Fora do escopo (fases 2 e 3)

- Fase 2 — Visão Geral executiva: reformula a aba `Visão Geral` de `meus-relatorios.tsx` reutilizando `getDashboardOverview`, adiciona destaques automáticos e seção de alertas.
- Fase 3 — Equipe: nova visão agrupada por cargo com drill-down, ranking interno, comparação entre cargos.

## Confirmação necessária antes de codar

1. Ok criar a migration com `training_completions` + `last_seen_at` + índices?
2. Sidebar: item novo "Dashboard" (ícone `LayoutDashboard`) só para admin — ok?
3. Auto-refresh a cada 60s tá bom, ou prefere manual?
