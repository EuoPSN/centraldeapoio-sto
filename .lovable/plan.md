
# Fase A — Atendimento + Base de Conhecimento IA

Escopo desta rodada (Fases B e C ficam para depois).

## 1. Banco de dados

Novas tabelas / colunas:

- `knowledge_entries` — substitui o uso atual de `content_items` para a IA. Tipos: `regra`, `procedimento`, `artigo`, `conversa_modelo`, `documento`, `treinamento`. Campos: título, conteúdo (markdown), `kind`, `category_id`, `tags[]`, `file_url`, `file_mime`, `external_url`, `metadata jsonb`, `position`, `created_by`.
- `flow_nodes` ganha colunas para o editor visual: `position_x`, `position_y`, `color`, `icon`, `data jsonb` (campos extras).
- `flow_edges` (nova) — arestas livres do React Flow: `flow_id`, `source_node_id`, `target_node_id`, `label`, `condition`.
- `simulator_sessions` (nova) — histórico de simulações: `user_id`, `flow_id`, `path jsonb`, `started_at`, `finished_at`.
- Bucket Storage `knowledge-files` (privado, leitura autenticada) para PDFs/DOCX/XLSX/vídeos/imagens.
- RLS + GRANTs padrão em todas as novas tabelas (admin escreve, autenticado lê; sessions só do próprio user).
- Reindexação RAG passa a varrer `knowledge_entries` (todos os tipos) + `messages` + `flow_nodes`.

## 2. Módulo Atendimento (`/scripts` reorganizado)

### 2.1 Biblioteca de Mensagens
Já existe — pequenos ajustes: filtro por subcategoria, ordenação manual com setas ↑↓, busca por tag.

### 2.2 Central de Fluxos (editor visual)
Substitui a árvore atual por **React Flow** (`@xyflow/react`):
- Canvas com zoom, pan, minimap, controles, fit-view.
- 5 tipos de bloco (`step`, `question`, `objection`, `script`, `end`) com cor e ícone próprios, todos editáveis pelo admin.
- Drag-and-drop de novos blocos a partir de uma palette lateral.
- Conexões livres entre blocos com label opcional ("SIM", "NÃO", "Vou pensar"…).
- Drawer lateral para editar bloco selecionado: nome, descrição, mensagem sugerida, observações internas, cor, ícone, botão copiar.
- Persistência em `flow_nodes` + `flow_edges` (debounce no auto-save).
- Modo "leitura" para funcionário (sem edição, mas com copiar mensagem e navegar).

### 2.3 Simulador de Atendimento
- Lista flows com `is_training = true` (cenários).
- Roda como chat guiado: parte do nó `start`, mostra mensagem sugerida, oferece botões com as labels das arestas de saída, navega para o próximo nó.
- Encerra em nó `end`; mostra resumo do caminho percorrido e grava em `simulator_sessions`.
- Suporta nós `objection` aparecendo no meio do fluxo conforme a aresta escolhida.

## 3. Base de Conhecimento IA (`/conhecimento` reformulada)

Nova UI com 6 abas (uma por tipo): **Regras / Procedimentos / Artigos / Conversas Modelo / Documentos / Treinamentos**.

- Listagem com busca, filtro por categoria/tag e ordenação.
- Editor (admin): título, categoria, tags, conteúdo markdown, upload de arquivo (quando aplicável), link externo, observações.
- Para "Documentos" e "Treinamentos": upload via Lovable Storage (PDF/DOCX/XLSX, imagens, vídeos); player de vídeo embutido e visualizador de PDF (iframe).
- "Conversas Modelo" tem editor estruturado: turnos Atendente/Cliente + resultado final.
- Botão "Reindexar IA" no admin reprocessa todos os tipos e gera embeddings.

## 4. Chat IA (RAG aprimorado)

- Mantém a interface atual; mensagem de sistema reforça que deve responder **apenas** com base no que está na Base de Conhecimento.
- Quando nenhum chunk relevante (similaridade < limiar): responde `"Não encontrei essa informação na base de conhecimento."`.
- Mostra fontes consultadas (título + tipo) abaixo da resposta.

## 5. Painel Admin

Novas abas em `/admin`:
- **Base de Conhecimento** (com sub-abas por tipo).
- **Fluxos** (lista; editor abre em modal/rota dedicada).
- **Cenários do Simulador** (toggle `is_training` nos fluxos).
- Aba **Reindexação** já existe — expande para mostrar contagem por tipo.

## 6. Detalhes técnicos

- Lib nova: `@xyflow/react` (React Flow v12). Tema customizado para casar com o design system.
- Upload: `supabase--storage_create_bucket` para `knowledge-files`; server fn assinada para gerar signed URLs.
- Migrações via `supabase--migration` com GRANTs e RLS.
- RAG reindex passa a quebrar conteúdo de `knowledge_entries.content` em chunks de ~800 chars com overlap, e indexar também `messages.content` e `flow_nodes.message`.
- Para DOCX/XLSX/PDF: o conteúdo bruto continua sendo o que o admin colar no campo `content` (não vamos extrair texto do binário nesta fase — fica para Fase B se você quiser).

## Fora do escopo desta rodada

- Histórico/versionamento de edições.
- Extração automática de texto de PDF/DOCX/XLSX para a IA (admin cola o texto por enquanto).
- Mapa Mental gigante separado (o editor de fluxos já cobre o caso de uso).
- Avatar/voz da MarcIAna e gamificação completa (Fase B).
- Conexão Google Sheets / CRM Gerencial (Fase C).

Confirma que posso seguir nessa direção?
