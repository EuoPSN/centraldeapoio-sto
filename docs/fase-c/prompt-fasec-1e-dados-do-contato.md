# Fase C · 1e — Detecção da aba "Dados do contato"

Contexto: no WhatsApp Web real a aba "Dados do contato" não usa aside/aria/data-testid, então o botão "Usar o número de Dados do contato" não aparecia. Já testado em Chrome pelo Paulo (funciona).

## O que fazer
1. Crie a branch `fase-c-extensao-1e` a partir do main atualizado.
2. Aplique o patch `docs/fase-c/1e-dados-do-contato.patch` (`git apply`). Ele altera só:
   - `extension/src/content/contato.ts`: fallback `abaPorCabecalho` (acha o cabeçalho "Dados do contato"/"Contact info" fora do painel da conversa e sobe até a região que também mostra o título da conversa; só então lê o telefone).
   - `extension/tests/telefone-e-contato.test.ts`: teste com DOM só de divs.
3. Rode `cd extension && npx vitest run tests/telefone-e-contato.test.ts` e `npm run build`. (Dois arquivos de teste de servidor podem falhar por `zod` não resolver no sandbox; ignore se for só isso.)
4. Commit, push e abra PR. Não faça merge.

Nenhuma migration. Não mexa em mais nada.
