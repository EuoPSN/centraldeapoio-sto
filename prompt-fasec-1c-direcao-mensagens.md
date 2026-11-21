Fase C, correção 1c da extensão OMNIA (pasta extension/): a leitura continua recusando ("sem_mensagens") no WhatsApp Web real. O diagnóstico do Paulo (versão 0.1.0, após o PR #61) mostrou: painel, cabeçalho e 37 elementos `[data-id]` ENCONTRADOS; `.message-in`/`.message-out` = 0; 20 blocos `[data-pre-plain-text]` e 20 `[data-testid="selectable-text"]`; 2 `[data-testid="author"]` (provavelmente dentro de uma mensagem citada, há 1 `quoted-message`); nenhum sinal de grupo; sem subtítulo de presença; mas `area_de_mensagens.total = 0`. Causa: `lerDataId` (ler.ts) exige o formato `true|false_<chat>_...` e o data-id atual não bate; o fallback por classe também não existe mais. Resultado: nenhuma mensagem é classificada, e a regra "na dúvida, não lê" recusa.

Regras de trabalho: sem harness visual nem capturas; build, typecheck e testes; branch `fase-c-extensao-1c`, um commit por seção, PR para a main sem merge. NÃO enfraqueça nenhuma regra de segurança (nunca ler grupos, "na dúvida, não lê", nunca enviar, nunca escrever na caixa, nunca rolar nem abrir conversas, sanitização) e NÃO adicione permissões ao manifest.

## 1. Diagnóstico: forma dos identificadores (sem dados pessoais)
Acrescente ao relatório de diagnóstico, para até 5 elementos `[data-id]` e 5 blocos `[data-pre-plain-text]`, apenas a **forma mascarada** do valor: troque cada dígito por `9`, cada letra por `a`, preserve `_`, `@`, `.`, `[`, `]`, `,`, `:`, `/` e espaços, e troque QUALQUER trecho que seja nome por `[nome]` (no data-pre-plain-text, o que vem depois de `] ` até `: ` é nome). Conte as formas distintas ("forma → quantidade"). Liste também os NOMES dos atributos (não os valores) de um elemento de mensagem de texto. Nunca inclua texto de nó, nomes nem números. Teste unitário com fixture contendo nome, telefone e mensagem garantindo que nada disso aparece.

## 2. Direção da mensagem (recebida × enviada) sem depender do formato do data-id
Reescreva `elementosDeMensagem` para classificar cada mensagem por esta ordem, parando no primeiro sinal confiável e registrando no diagnóstico qual método decidiu:
1. data-id no formato antigo `(true|false)_...` (mantido, se ainda existir).
2. **Remetente do `data-pre-plain-text`** (formato "[hh:mm, dd/mm/aaaa] Nome: "): se o nome for IGUAL ao título da conversa no cabeçalho (normalize espaços, caixa e dígitos de telefone), a mensagem é RECEBIDA; se for diferente, é ENVIADA pelo atendente. Só use este método em conversas em que TODOS os remetentes diferentes do atendente sejam iguais ao título (ver item 3).
3. **Ícones de status** dentro de `[data-testid="msg-meta"]` (ticks "enviada/entregue/lida", `data-icon` começando com `msg-` ou `aria-label` correspondente em pt/en): presença indica ENVIADA; ausência, RECEBIDA.
4. **Alinhamento horizontal** (último recurso): centro do balão em relação ao centro do painel (`getBoundingClientRect`): direita = enviada, esquerda = recebida. Só use se os métodos 2 e 3 não decidirem.
Considere mensagem apenas elementos que tenham texto (`selectable-text` ou `data-pre-plain-text`); ignore separadores de data, avisos do sistema e elementos de mídia sem texto (mídia continua virando "[mídia]").

## 3. Verificação positiva de conversa individual (e proteção contra grupo)
Substitua a dependência do id do chat por uma regra baseada em remetentes, mantendo a segurança:
- Conversa INDIVIDUAL somente se: cabeçalho encontrado E título do cabeçalho não vazio E há mensagens E **todas as mensagens recebidas têm o mesmo remetente**, igual ao título do cabeçalho E nenhum sinal de grupo foi encontrado (rótulo, subtítulo com vários nomes, lista de participantes etc.).
- Se houver DOIS ou mais remetentes diferentes entre as recebidas (ou diferentes do título), é grupo: NÃO lê.
- Se o remetente não puder ser lido (formato novo/desconhecido), NÃO lê e registre o motivo.
- `[data-testid="author"]`/`remetenteNaMensagem`: IGNORE elementos que estejam dentro de uma mensagem citada (`quoted-message` ou ancestral com `aria-label` de citada). Só conta como sinal de grupo se estiver no corpo da mensagem principal. Registre no diagnóstico quantos foram ignorados por estarem em citação.
- Conversa com poucas mensagens e só ENVIADAS (nenhuma recebida): não dá para confirmar o contato; NÃO lê e mostre a mensagem "Ainda não há mensagem do cliente nesta conversa."
- Conversa do atendente consigo mesmo ("Você"/mensagens para mim mesmo): trate como individual apenas se o título e todos os remetentes baterem.
Mantenha os sinais de grupo atuais e a regra "na dúvida, não lê".

## 4. Testes
Atualize/estenda as fixtures (HTML simplificado) com: (a) conversa individual com data-id em formato desconhecido + data-pre-plain-text, mensagem citada com author dentro da citação; (b) grupo com dois remetentes; (c) só mensagens enviadas; (d) formato do data-id antigo; (e) conversa com mídia e texto. Casos ambíguos devem resultar em "não lê". Atualize a mensagem de erro para dizer qual regra impediu a leitura (ex.: "Há mais de um remetente nas mensagens recebidas: parece um grupo").

## 5. Entrega
PR descrevendo os métodos de direção e a regra individual. Gere `npm run build` e o zip de teste da pasta dist e diga o caminho. Peça ao Paulo: abrir uma conversa individual de teste (com mensagens de ambos os lados), clicar em "Ler esta conversa"; se falhar, "Diagnóstico → Copiar diagnóstico".
