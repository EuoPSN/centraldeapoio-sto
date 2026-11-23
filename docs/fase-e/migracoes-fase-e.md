# Migrações da Fase E (Painel Admin organizado)

**Passo obrigatório: rodar no SQL editor do Lovable antes do merge.**

Arquivo: `supabase/migrations/20261206090000_faseE_admin_reorganizacao.sql` (idempotente, pode rodar mais de uma vez).

O que faz:
1. `DELETE` em `nav_items` das rotas `/dashboard`, `/funcionarios`, `/crm-leads`, `/crm-prospeccao` e `/motor-decisao` (páginas apagadas).
2. `UPDATE` em `admin_sections` por `tab_key`: novo grupo, rótulo (onde o prompt define) e posição (10, 20, 30…) para os 7 grupos novos.
3. `DELETE` das linhas `content` (Conteúdo legado) e `appearance` (Identidade) de `admin_sections`.

Não apaga tabelas nem dados de negócio. Continuam escondidas, sem mudança: `scriptreview`, `telemedicina`, `organizacao`, `promoplans`.

Sem rodar a migração, o código novo funciona, mas o Admin mostra os grupos e nomes antigos (o seletor agrupa pelo `group_name` do banco).
