Fase C, correção 1b da extensão OMNIA (pasta extension/): a leitura da conversa no WhatsApp Web está falhando no teste real. Mensagens vistas pelo Paulo: (1) "Não consegui ler esta conversa. Abra o WhatsApp Web nesta aba e tente de novo." (2) "Não li esta conversa. Não consegui confirmar que esta é uma conversa individual; por segurança a Omnia não lê." Os seletores foram escritos sem acesso ao WhatsApp real, então provavelmente não batem com o layout atual.

Regras de trabalho: sem harness visual nem capturas; build, typecheck e testes; branch `fase-c-extensao-1b`, um commit por seção, PR para a main sem merge. Não enfraqueça nenhuma regra de segurança (nunca ler grupos, "na dúvida, não lê", nunca enviar, nunca escrever na caixa, nunca rolar nem abrir conversas, sanitização). Não adicione permissões ao manifest.

## 1. Modo diagnóstico (sem dados pessoais)
- No painel, um item discreto "Diagnóstico" (menu "…" ou link no rodapé) que pede ao content script um relatório e mostra um botão "Copiar diagnóstico".
- O relatório é JSON e descreve SÓ ESTRUTURA, nunca conteúdo:
  - para cada seletor de `selectors.ts`: nome, se encontrou (sim/não), quantos elementos, e qual fallback bateu;
  - árvore resumida do cabeçalho da conversa e da área de mensagens (até 4 níveis): tag, `role`, nomes de atributos `aria-*`/`data-*` e seus valores APENAS se forem de um conjunto seguro (ex.: `data-testid`, `role`, `aria-label` genérico); NUNCA textos de nós, nomes de contato, números, mensagens, nem valores de atributos que contenham dígitos longos ou nomes (troque por "[omitido:<tamanho>]");
  - quais sinais de grupo foram avaliados e o resultado de cada um (ex.: "sinal_remetente_nas_mensagens: não", "sinal_lista_de_participantes: não"), e o motivo final da decisão (lê / não lê / por quê);
  - se o content script está presente na aba ativa, a URL da aba reduzida ao domínio e a versão da extensão.
- Teste unitário garantindo que o relatório NUNCA contém texto de nós de uma fixture com nome, telefone e mensagens.

## 2. Mensagens de erro distintas
Troque a mensagem genérica por três casos claros: (a) "A Omnia não está ativa nesta aba. Recarregue o WhatsApp Web (F5) e tente de novo." quando o content script não responde; (b) "Abra uma conversa no WhatsApp Web." quando não há conversa aberta; (c) a mensagem atual de segurança (não confirmou conversa individual), agora com um link "Ver diagnóstico". Cada caso grava no diagnóstico o motivo.

## 3. Detecção de conversa individual menos frágil (sem perder segurança)
Revise a detecção usando sinais positivos e negativos combinados, em vez de exigir um único seletor que pode não existir:
- Considere GRUPO (e portanto não lê) se QUALQUER sinal de grupo for encontrado: nome do remetente exibido nas mensagens recebidas, subtítulo do cabeçalho listando vários nomes, rótulo de grupo/comunidade, lista de participantes.
- Considere INDIVIDUAL somente se: encontrou o cabeçalho da conversa E encontrou mensagens E nenhum sinal de grupo foi encontrado E houve pelo menos uma verificação positiva de individual (ex.: subtítulo de presença como "online"/"visto por último" ou ausência de rótulo de remetente em todas as mensagens recebidas visíveis).
- Se o cabeçalho não for encontrado (seletor quebrado), NÃO leia e registre "cabeçalho não encontrado" no diagnóstico.
- Reutilize atributos estáveis (role, aria-label, data-testid, estrutura) antes de classes. Atualize `selectors.ts` com fallbacks adicionais e comente cada um.
- Atualize/estenda as fixtures de teste com variações de layout (conversa individual com e sem subtítulo de presença; grupo; conversa vazia) e mantenha os casos ambíguos resultando em "não lê".

## 4. Entrega
No PR: o que mudou nos seletores, o formato do diagnóstico, e instruções curtas para o Paulo: abrir uma conversa com ele mesmo (ou número de teste) no WhatsApp Web, clicar em Diagnóstico → Copiar diagnóstico e me enviar o texto colado. Gere também o pacote atualizado (`npm run build` e o zip da pasta dist para teste) e diga o caminho.
