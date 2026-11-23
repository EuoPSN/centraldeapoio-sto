# Migrações da Fase D (rodar nesta ordem)

Cada arquivo é idempotente (pode rodar de novo sem duplicar nem perder dados) e está em `supabase/migrations/`.
Para aplicar pelo SQL editor do Lovable: abra o arquivo, copie o conteúdo inteiro, cole e execute, **um de cada vez, na ordem abaixo**.
Depois da última, o Lovable regenera `src/integrations/supabase/types.ts` (hoje as tabelas novas são lidas por `src/lib/db-novas-tabelas.ts`, sem tipos).

| # | Arquivo | O que faz |
|---|---------|-----------|
| 1 | `20261205090000_faseD_videos.sql` | `video_url` e `video_duracao` em `content_items`, `flows` e `categories` (esta é a tabela que alimenta os cartões de fluxo em Scripts), com trava de https + YouTube, Vimeo ou `.mp4/.webm`. |
| 2 | `20261205090100_faseD_excluir_lote.sql` | Função `amor_saude_excluir_lote(tipo, ids)`: uma transação, só admin, até 200 ids, apaga vínculos com unidades e clínicas e depois os itens. Qualquer erro desfaz tudo. |
| 3 | `20261205090200_faseD_telemedicina.sql` | Tabela `telemedicina_itens` (leitura autenticada, escrita admin), seed do PA digital (Clínico geral e Pediatra), coluna `app_settings.amor_saude_site_url` e `increment_amor_saude_use` com o tipo `telemedicina`. |
| 4 | `20261205090300_faseD_duvidas.sql` | Tabela `duvidas_frequentes` (atendente lê só as publicadas), função `increment_duvida_copias` e seed das 12 dúvidas de `docs/fase-d/base-duvidas.json` **como rascunho**. |
| 5 | `20261205090400_faseD_roteiros_audio.sql` | Tabela `roteiros_audio` (sem seed) e bucket privado `roteiros-audio` (5 MB; mp3, m4a, ogg, wav; leitura autenticada, escrita admin). |
| 6 | `20261205090500_faseD_scripts_ligacao.sql` | Tabelas `recursos_config` (chave `scripts_ligacao_liberado`, padrão desligada) e `roteiros_ligacao` (atendente só lê com a chave ligada) e 5 exemplos em rascunho. |
| 7 | `20261205090600_faseD_admin_sections.sql` | Seções do Admin: `telemedicina` (dentro de Amor Saúde, sem item próprio no menu), `duvidas`, `roteirosaudio` e `scriptsligacao` no grupo Atendimento. Só insere; não altera o que já existe. |

## Depois de rodar
1. Admin → Amor Saúde → **Teleconsulta e PA**: cadastre o link do site da Amor Saúde e use "Adicionar várias" para as 21 especialidades.
2. Admin → **Dúvidas frequentes**: revise as 12 respostas e publique. Depois, em Admin → IA e indexação, reindexe a Base IA para a MarcIAna usar as publicadas.
3. Admin → **Scripts de ligação**: reescreva os 5 exemplos e só então ligue "Liberar para a equipe".
