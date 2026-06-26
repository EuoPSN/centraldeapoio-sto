# Plano: Evolução da Central CDT

Transformar a Central CDT em uma plataforma interna de treinamento, consulta e suporte, com forte autonomia administrativa (sem precisar mexer em código para mudanças do dia a dia).

A entrega será dividida em **5 fases** sequenciais. Posso executar tudo de uma vez ou parar entre fases — me avise sua preferência.

---

## Fase 1 — Reorganização e Base Escalável

Antes de qualquer feature nova, refatorar a fundação:

- **Tabelas dinâmicas de taxonomia** (`categories`, `subcategories`) — usadas por mensagens, fluxos, sugestões, etc. Admin cria/edita pela interface.
- **Tabela `app_settings`** (singleton) — guarda nome da plataforma, logo, favicon, imagem de capa, cor primária/secundária/fundo, tema ativo.
- **Tabela `nav_items`** — define as abas do menu (label, ícone, rota, ordem, visível, roles permitidas). A sidebar passa a ler dela em vez de hardcoded.
- **Tabela `themes`** — presets (Claro, Escuro, Corporativo, Personalizado) com tokens de cor; o tema ativo aplica variáveis CSS em runtime.
- Migrar `scripts` atual para o novo modelo de `messages` (mantendo dados existentes via seed/migration).

## Fase 2 — Módulo Scripts (3 sub-abas)

Renomeia/reestrutura `/scripts` com `Tabs`:

### 2.1 Biblioteca de Mensagens
- CRUD completo com categoria/subcategoria dinâmicas, título, conteúdo (markdown), observação interna, botão copiar.
- Busca por categoria, palavra-chave e título; reordenação via campo `position` (drag-and-drop simples com setas ↑↓ para começar).

### 2.2 Central de Fluxos (URA visual)
- Tabelas `flows`, `flow_nodes` (id, flow_id, parent_id, tipo: pergunta/resposta/objeção/ação, título, mensagem, observações, ordem).
- Visualização em árvore expansível/recolhível (componente customizado, sem dep pesada de fluxograma — usa cards aninhados com conectores CSS).
- Cada nó: nome, descrição, mensagem sugerida, botão copiar, lista de "próximos caminhos".
- Editor admin: criar fluxo, adicionar nós filhos, mover, excluir.

### 2.3 Simulador de Atendimento
- Tabela `scenarios` reaproveita a estrutura de `flows` (um cenário = um flow marcado como `is_training=true`).
- UI estilo "chat guiado": apresenta a situação, mostra mensagem sugerida, oferece botões com as possíveis respostas do cliente, navega para o próximo nó.
- Ao final, resumo do caminho percorrido.

## Fase 3 — Painel Administrativo Expandido

Reorganiza `/admin` em abas:
- **Conteúdo**: Mensagens, Fluxos, Cenários, Conhecimento, Preços, Problemas, Tutoriais.
- **Taxonomia**: Categorias e Subcategorias.
- **Menu**: gerenciar `nav_items` (criar, ocultar, reordenar, renomear, trocar ícone via picker do Lucide).
- **Aparência**: editar `app_settings` (cores via color picker, upload de logo/favicon/capa para Supabase Storage, nome da plataforma, seleção de tema).
- **Usuários**, **IA**, **Sugestões** (ver Fase 5).

## Fase 4 — Personalização Visual em Runtime

- Componente `<ThemeProvider>` no `__root.tsx` lê `app_settings` e injeta CSS variables (`--primary`, `--secondary`, `--background`) sobrescrevendo os defaults de `styles.css`.
- `AppLogo` e `<head>` (favicon, title) passam a ler de `app_settings`.
- Bucket `branding` no Storage para logo/favicon/capa, com policies (admin escreve, todos leem).

## Fase 5 — Central de Sugestões

- Tabela `suggestions` (user_id, categoria, descrição, status: pendente/em_análise/implementado/rejeitado, created_at).
- Rota `/sugestoes` — funcionário envia e vê o histórico das próprias.
- Aba "Sugestões" no admin — lista todas, altera status, filtra por categoria/status.

---

## Detalhes técnicos

- **Banco**: ~10 novas tabelas, todas com RLS + GRANTs apropriados. `has_role('admin')` controla escrita em conteúdo e configurações; funcionários têm leitura.
- **Roteamento**: `/scripts` vira layout com `Outlet` + 3 rotas filhas (`mensagens`, `fluxos`, `simulador`).
- **Sidebar**: passa a renderizar dinamicamente a partir de `nav_items` (com fallback para os itens atuais até o seed rodar).
- **Drag-and-drop**: começo com botões ↑↓ por simplicidade; posso adicionar `@dnd-kit` depois se quiser.
- **Tema runtime**: variáveis CSS aplicadas via `<style>` injetado, sem rebuild.
- **RAG existente**: continua funcionando — adiciono `messages` e `flow_nodes` como novas `source_type` na indexação.
- **Migração de dados**: script que copia `scripts` → `messages` preservando categorias.

---

## Escopo do que NÃO faço nesta entrega (a confirmar depois)

- Editor visual estilo node-graph arrastável (react-flow) para os fluxos — começo com árvore aninhada, que é mais leve e suficiente para a operação.
- Versionamento/histórico de edições de conteúdo.
- Aprovação em duas etapas para sugestões.

---

Posso começar pela **Fase 1 + Fase 2** (base + módulo Scripts completo) em uma rodada e depois seguir para Admin/Aparência/Sugestões na próxima? Ou prefere que eu execute tudo de ponta a ponta agora?
