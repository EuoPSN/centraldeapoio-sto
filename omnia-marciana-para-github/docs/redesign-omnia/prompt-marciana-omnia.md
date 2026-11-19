Página 5 do redesign OMNIA Apoio: MarcIAna (rota /assistente, funções em src/lib/chat.functions.ts). Siga os tokens e regras da marca de docs/redesign-omnia/prompt-lovable-base-omnia.md.

Esboços aprovados (siga fielmente):
- docs/redesign-omnia/marciana-inicio.png (sem conversa aberta)
- docs/redesign-omnia/marciana-conversa.png (conversa, mensagem para o cliente, estado "pensando")
- docs/redesign-omnia/marciana-feedback.png (porquê do 👎 / 👍)
- docs/redesign-omnia/marciana-olho.png (símbolo da MarcIAna: olho orbital)
- docs/redesign-omnia/marciana-olho.svg (desenho do símbolo)
- docs/redesign-omnia/marciana-animacoes.html (referência exata das animações: abra o arquivo e copie os keyframes)

Perguntas, respostas e histórico dos esboços são ilustrativos.

IMPORTANTE SOBRE O MODO DE TRABALHO
- NÃO monte harness visual, servidor de preview com Playwright nem tire capturas de tela. Eu reviso as telas. Valide com build e typecheck.
- Parta do estado atual da main. Não altere o modelo de IA (Gemini, constantes de src/lib/ai-models.ts) nem a lógica de busca na base de conhecimento, exceto o que está pedido abaixo.

## 1. Símbolo da MarcIAna (olho orbital)
- Crie um componente `MarcianaEye` (ex.: src/components/marciana/MarcianaEye.tsx) em SVG inline, a partir de marciana-olho.svg: duas pálpebras em crescente (as órbitas do símbolo OMNIA), anel da íris e pupila. Cor = currentColor (gold no claro, gold do tema escuro no escuro). Prop `size` e prop `state`.
- Estados (`state`), com as animações de marciana-animacoes.html:
  - `idle`: pisca devagar a cada ~5 s.
  - `listening`: com o campo de pergunta em foco, a pupila acompanha o mouse (deslocamento máx. ~7px na horizontal e ~3,5px na vertical no viewBox 100).
  - `thinking`: pupila dilata e pulsa + ponto orbitando o anel (enquanto espera a resposta da IA). Substitui os "três pontinhos".
  - `writing`: pupila vai de um lado ao outro enquanto o texto da resposta aparece (se a resposta não for em streaming, use `thinking` até chegar e pule este estado).
  - `done`: uma piscada + pupila volta ao normal ao terminar; depois volta para `idle`.
  - `miss`: semicerra e olha para baixo quando a IA não encontrou a resposta na base (use o sinal que já existe de "sem fontes"/resposta sem base; se não existir, crie um campo booleano na resposta do servidor).
- Respeite `prefers-reduced-motion` (olho parado).
- Use o olho: grande (96px) na tela inicial, como avatar (22–24px dentro de um círculo de 34px com borda line) em cada resposta, no indicador "MarcIAna está pensando…", e como ícone do item MarcIAna no menu lateral (estático, `idle`).

## 2. Layout
- Duas colunas: histórico (≈280px) e conversa.
- Histórico: botão dourado "+ Nova conversa", busca "Buscar conversas…" (filtra pelo título e pelo texto das mensagens), grupos com overline: Hoje · Ontem · Últimos 7 dias · Mais antigas. Item ativo com fundo hover e texto 600. Excluir conversa continua (ícone ao passar o mouse).
- Coluna da conversa com largura de leitura de ~780px centralizada; campo de pergunta fixo embaixo.

## 3. Tela inicial — marciana-inicio.png
- Sem conversa aberta: olho 96px, título "PERGUNTE À MARCIANA" (Cinzel, caixa alta), linha "Produtos, regras e valores do Cartão de TODOS. Ela responde a partir da base da Central.", campo grande de pergunta e, abaixo, as sugestões em pílulas (clicar envia a pergunta e cria a conversa).
- Sugestões: nova tabela `marciana_sugestoes` (texto, ordem, ativo) com edição no Admin (dentro da área de configurações da IA/MarcIAna que já existe). Mostre de 4 a 6 ativas. Já cadastre 5 iniciais: "Qual a diferença do Prata para o Ouro?", "Quem pode ser dependente?", "Como funciona a carência?", "O que o Energia de TODOS oferece?", "Cliente negativado pode aderir?".

## 4. Campo de pergunta
- Placeholder "Pergunte para a MarcIAna… (Ctrl+V cola um print)". Clipe para anexar imagens (mantém o limite de 4 e o bucket chat-images atual) e **colar imagem com Ctrl+V** direto no campo (mesmo fluxo de upload). Miniaturas dos anexos acima do campo, com X para remover.
- Enter envia, Shift+Enter quebra linha. Botão de enviar dourado.

## 5. Respostas — marciana-conversa.png
- Mensagem do atendente: balão à direita em surface-2. Resposta da MarcIAna: avatar do olho + texto em markdown, sem balão.
- Fontes: **remova a seção "Fontes consultadas" para atendentes.** Para admin, mostre um link discreto "Ver fontes · só admin" que abre as fontes da resposta. Guarde as fontes separadas do texto (coluna própria na mensagem, ex.: `sources jsonb`) em vez de concatenar no conteúdo; mantenha a leitura do formato antigo para mensagens já salvas.
- Ações sob cada resposta: "Copiar" (contorno), "Mensagem para o cliente" (contorno dourado), 👍 e 👎 (ícones de linha, sem emoji colorido; o marcado fica com fundo surface-2).
- "Mensagem para o cliente": chama a IA (mesmo modelo) para reescrever a resposta como uma mensagem curta de WhatsApp para o cliente: tom acolhedor da Cartão de TODOS, no máximo ~3 frases, pode usar 1 emoji, termina com uma pergunta que avança a conversa, sem jargão interno, **nunca dizer "não é plano de saúde"**, sem inventar valores que não estejam na resposta. O resultado aparece logo abaixo da resposta num bloco surface-2 com borda dourada à esquerda, overline "MENSAGEM PARA O CLIENTE" e "Copiar" à direita. Salve esse texto junto da mensagem para não gerar de novo ao reabrir a conversa.

## 6. Útil / Não útil — marciana-feedback.png
- Ao clicar em 👎: popover "O que faltou nessa resposta?" com pílulas de múltipla escolha: Informação errada · Incompleta · Desatualizada · Não entendeu minha pergunta · Não serviu para o cliente; campo opcional "Quer explicar? (opcional)"; botões Cancelar / Enviar. Exige pelo menos uma opção.
- Ao clicar em 👍: mesmo popover com "O que ajudou?" e as opções Usei com o cliente · Me ensinou algo · Resposta rápida e certa; escolher é opcional (Enviar funciona sem opção).
- Nova tabela `marciana_feedback` (message_id, conversation_id, user_id, tipo util/nao_util, motivos text[], comentario, created_at). RLS: cada usuário cria e vê o próprio; admin vê todos. Um feedback por usuário por mensagem (editar substitui).
- Admin: nova seção "Perguntas sem boa resposta" listando os 👎 (mais recentes primeiro): pergunta do atendente, resposta da MarcIAna, motivos, comentário, quem marcou e data, com filtro por motivo e um botão "Marcar como resolvida" (campo resolvido_em). Mostre também um contador simples de 👍 e 👎 dos últimos 30 dias.

## 7. Ligação com a busca da Início
- Na busca central da Início, quando não houver resultados (ou como último item da lista), mostre "Perguntar à MarcIAna: <texto digitado>". Ao clicar, abre /assistente com uma nova conversa já enviando essa pergunta (ex.: /assistente?pergunta=...).

## Geral
- Remova o visual antigo (título grande "MarcIAna" com ícone genérico, cards de boas-vindas, ícones de brilho).
- Estados vazios simples; mensagens de erro em texto discreto com "Tentar de novo".
- Respeite temas claro e escuro.

Trabalhe numa branch omnia-marciana, um commit por seção, rode build e typecheck, e abra um Pull Request para a main. Não faça merge sozinho. No PR: migrações a rodar no SQL Editor do Supabase (em ordem), tabelas/colunas novas, o que mudou no Admin e como ficou a compatibilidade com mensagens antigas (fontes concatenadas no texto).
