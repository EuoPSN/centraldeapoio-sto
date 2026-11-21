Fase C, prompt 1 de 2 da OMNIA Apoio: **extensão do Chrome para o WhatsApp Web** (painel lateral): login, "Ler esta conversa" → ticket (criar/atualizar), "O cliente disse…", aba Hoje, tela "O que a extensão faz", Pausar/Ignorar contato, e a página pública de privacidade. O cronômetro de resposta, a varredura da lista, o Admin e a planilha do CRM ficam no prompt 2.

Pré-requisitos: Fase A e Fase B (blocos 1, 2 e 3) na main. Se faltar algo (retomadas, função de criar ticket para a extensão do Fase A bloco 2, "O cliente disse…", Cérebro, ia_uso/ia_limites), pare e avise.

Esboços aprovados (siga fielmente; textos e nomes são ilustrativos): docs/fase-c/painel-ticket-novo.png, painel-ticket-atualiza.png, painel-cliente-disse.png, painel-hoje.png, painel-o-que-faz.png. A tela de WhatsApp nos esboços é só ilustração; não copie visual do WhatsApp.

REGRAS DE TRABALHO
- NÃO monte harness visual, não use Playwright nem tire capturas. Valide com build, typecheck e testes unitários.
- IA só pelo caminho existente: src/lib/cerebro.ts (montarInstrucoes) e src/lib/ai-models.ts, dentro de funções de servidor/edge existentes no padrão do projeto. A extensão NUNCA chama o Gemini direto e NUNCA guarda a chave.
- Banco é Lovable Cloud: migrações em ordem, com SQL pronto para o SQL editor do Lovable. Toda tabela com escrita precisa de política explícita de INSERT/UPDATE (não só SELECT). Admin: `private.has_role(auth.uid(), 'admin'::app_role)`. Funções SECURITY DEFINER com `set search_path`.
- Pagamento é só cartão de crédito ou débito. A equipe só atende por mensagem. Nunca escreva "não é plano de saúde" em nenhum texto.
- Marca OMNIA: dourado #B58A35, preto #0B0B0B, off-white, Cinzel + Montserrat, botão primário dourado com texto preto.

## 1. Estrutura da extensão
- Nova pasta `extension/` na raiz do repositório, separada do app. Manifest V3, TypeScript, Vite, painel em React. Tokens de marca copiados do design system da Omnia (sem depender de arquivos do app).
- Arquivos: `manifest.json`, `src/background.ts` (service worker), `src/content/whatsapp.ts` (content script), `src/panel/` (painel lateral, API `chrome.sidePanel`), `src/lib/` (supabase, sanitizar, grupos, config), `src/config.ts`.
- `src/config.ts` guarda em UM único lugar a URL do backend, a chave pública (anon) e o endereço da Omnia. A hospedagem pode mudar depois (oficialização); só esse arquivo deve mudar.
- Permissões mínimas, e nada além disto: `sidePanel`, `storage`. `host_permissions`: apenas `https://web.whatsapp.com/*` e o domínio do backend. Content script só em `https://web.whatsapp.com/*`. Sem `<all_urls>`, sem `tabs`, sem `scripting` amplo, sem código remoto, sem `eval`.
- Scripts npm: `build`, `typecheck`, `test`, `zip` (gera `extension/dist/omnia-extensao-<versao>.zip` pronto para a loja, só com os arquivos finais). Versão no manifest vinda do package.json.
- Ícones 16, 48 e 128 a partir do símbolo OMNIA do repositório (docs/redesign-omnia/ ou o pacote de logos).

## 2. Login
- Mesma conta da Omnia (e-mail e senha), via supabase-js, com a sessão guardada em `chrome.storage.local` e renovação automática. Tela de login simples no painel (marca OMNIA). Sem cadastro novo.
- Botão "Sair". Sessão expirada → volta ao login sem perder nada local.
- Cada atendente só enxerga os próprios tickets (as regras do banco já garantem; confira e não enfraqueça nenhuma).

## 3. Content script: ler só a conversa aberta
Arquivo único de seletores `src/content/selectors.ts` (documentado). O WhatsApp muda o layout com frequência, então:
- Prefira atributos estáveis (aria-label, data-*, role, estrutura) a nomes de classe; cada seletor com comentário e um fallback; se algo não for encontrado, falhe de forma segura (mensagem clara no painel "Não consegui ler esta conversa", nada enviado).
- Só lê quando o atendente clica em "Ler esta conversa". Lê apenas as mensagens que já estão carregadas na tela. NUNCA rola o histórico, NUNCA abre outras conversas, NUNCA clica em nada do WhatsApp, NUNCA escreve na caixa de texto, NUNCA envia.
- **Grupos, comunidades, listas de transmissão e Status: nunca lê.** Detecte por sinais da tela (nome do remetente em cada mensagem, ícone/rótulo de grupo, número de participantes no cabeçalho, etc.). Regra: **na dúvida, não lê**. Só lê se tiver certeza de que é conversa individual. Retorne ao painel o motivo ("Esta conversa parece ser um grupo; a Omnia não lê grupos").
- Extraia: nome exibido do contato, número (quando visível no cabeçalho ou no nome), e as últimas até 60 mensagens (direção cliente/atendente, texto, horário). Nada de mídia, nada de áudio, nada de arquivos: mídia vira o marcador "[mídia]".
- Se o nome exibido for um número, use-o como número e deixe o nome vazio.
- Testes unitários com fixtures de HTML simplificado para a leitura e para a detecção de grupo (inclua casos ambíguos que devem resultar em "não lê").

## 4. Sanitização (duas camadas)
- No navegador, ANTES de enviar qualquer coisa: remova telefone, CPF, CNPJ, e-mail, links com identificadores e sequências longas de dígitos; substitua o nome do cliente por [nome] e cite só o primeiro nome quando precisar. O telefone completo NUNCA vai para a IA; vai apenas para o ticket (item 6).
- No servidor, repita a mesma sanitização (nunca confie só no cliente).
- Testes unitários da sanitização (formatos de telefone BR com e sem 55, com e sem 9, com espaços e hifens, CPF com e sem pontuação, e-mails).

## 5. Função de servidor "Ler conversa" (IA)
- Nova função `extensaoLerConversa` (padrão de funções do projeto), autenticada. Recebe só o texto já sanitizado + direção + horário. NUNCA grava a conversa nem as falas.
- Usa `montarInstrucoes('extensao', ...)`: adicione a ferramenta `extensao` ao Cérebro (matriz "Quem usa o quê": ligada por padrão com Playbook CDT, Etapas do funil, Padrão de escrita, Regras fixas, Mudanças recentes, Mensagens que vendem) e em `ia_limites` (padrão 60 leituras por atendente por dia; admin sem limite; ao atingir, bloqueia só a extensão até a meia-noite, igual às outras ferramentas, mensagem clara no painel).
- Devolve JSON validado: `etapa_funil` (uma das 5 do CRM: Novo lead, Lead qualificado, Proposta enviada, Fechamento, Venda concluída; "Venda concluída" só se a conversa deixar isso explícito, caso contrário nunca proponha), `ponto_parada` (um dos 4: não respondeu a 1ª, parou na explicativa, recebeu a proposta, travou no fechamento), `plano` (Prata, Ouro, Diamante ou vazio), `dependentes` (número ou vazio), `observacao` (máx. 200 caracteres, sem dado pessoal), `quando_retomar` sugerido (respeitando a cadência existente) e `objecoes_detectadas`. Valide a resposta; se vier inválida, tente uma vez e depois devolva erro amigável.
- Registre em `ia_uso` só quem, ferramenta e quando (como as outras).

## 6. Ticket: criar ou atualizar
- Reutilize a função de criação de ticket para a extensão já existente (Fase A bloco 2: "Função pronta para a extensão criar tickets"). Se faltar algo, estenda a mesma função em vez de duplicar.
- Painel "Esta conversa" (painel-ticket-novo.png): estado inicial → botão "Ler esta conversa" → "Proposta da Omnia · confira antes de salvar" com os campos editáveis (etapa do funil, ponto de parada, plano, dependentes, observação, retomar) → "Salvar ticket" / "Corrigir". **Nada é salvo antes do clique em "Salvar ticket".**
- O ticket guarda primeiro nome, telefone (só o próprio atendente vê; apagado ao sair da fila ou em 30 dias, como já é), etapa do funil, ponto de parada, plano, dependentes, observação e prazo de retomada. Ao salvar entra no **Retomar hoje** com a cadência e as mensagens prontas já existentes.
- **Número que já tem ticket do mesmo atendente aberto → atualiza o existente**, sem duplicar (painel-ticket-atualiza.png): mostre "Já existe um ticket deste número", o que mudou (de → para) e o histórico. Casamento de número: compare por número normalizado (somente dígitos, últimos 9 dígitos, ignorando 55 e o 9 inicial quando houver ambiguidade) para não duplicar por formato.
- Nova tabela `ticket_historico` (ticket_id, user_id, campo, valor_anterior, valor_novo, origem 'extensao'|'omnia', created_at). RLS: o dono lê e insere; admin NÃO lê conteúdo (só contagens, no prompt 2). Grave uma linha por campo que mudou. Apague junto com o ticket (ON DELETE CASCADE).
- Se o ticket existir mas for de outro atendente, NÃO revele nada dele: trate como número novo para este atendente e avise "Este contato já está com outro atendente" (sem dizer quem).

## 7. "O cliente disse…" no painel
Painel `painel-cliente-disse.png`: usa a última fala do cliente da conversa aberta (já sanitizada) e a função existente de "O cliente disse…" (Fase A bloco 1), incluindo "Casos parecidos que fecharam" se existir. Botão "Copiar" copia o texto para a área de transferência; **nunca escreve na caixa do WhatsApp e nunca envia**. "Outro ângulo" gera uma alternativa.

## 8. Aba Hoje
Lista os tickets do dia do atendente (prazo hoje, atrasados e em follow-up), com contadores "Para hoje" e "Atualizados hoje", e o botão "Abrir o Retomar hoje na Omnia ↗" (abre o endereço da Omnia em `config.ts`). Só os tickets dele. O primeiro nome aparece; o telefone não aparece nesta lista.

## 9. Pausar, Ignorar e "O que a extensão faz"
- Botão **Pausar** (topo do painel): desliga toda leitura e qualquer chamada; o ícone mostra o estado; lembra entre sessões. Quando pausada, o content script não lê nada.
- **Ignorar este contato**: grava na tabela `extensao_ignorados` (user_id, numero_hash, created_at; hash do número normalizado, nunca o número em claro). Conversa ignorada nunca é lida, mesmo com clique, e aparece "Este contato está ignorado" com opção "Voltar a ler". RLS: só o dono lê, insere e apaga.
- Indicador visível "Lendo só esta conversa" sempre que lê, e "não é um grupo" quando confirmado.
- Tela **"O que a extensão faz"** (painel-o-que-faz.png), com o texto simples do esboço, acessível por um link no rodapé do painel. Mostrada automaticamente no primeiro uso, com um "Entendi" antes de liberar o botão "Ler esta conversa" (grave a confirmação local e em `extensao_aceites` (user_id, versao, aceito_em), RLS própria).
- Registro de eventos para o Admin (prompt 2): tabela `extensao_eventos` (user_id, tipo, created_at) com tipos 'ticket_criado', 'ticket_atualizado', 'conversa_ignorada', 'pausou', 'despausou', 'leitura'. NUNCA conteúdo, nome nem número. RLS: o dono insere e lê os próprios; admin lê todos. Grave aqui já para o prompt 2 só consumir.

## 10. Página pública de privacidade
- Rota pública (sem login) `/privacidade-extensao` no app da Omnia, com a política da extensão em português simples: o que lê, o que nunca lê, o que é enviado e para onde (Omnia e provedor de IA), o que é guardado (campos do ticket) e por quanto tempo, que a conversa não é guardada, que nunca envia mensagens, quem acessa (só o atendente; admin vê só números), como pausar/desinstalar e contato (e-mail do Paulo, deixe um campo de configuração `PRIVACIDADE_CONTATO` fácil de trocar). Use o texto de docs/fase-c/politica-privacidade-extensao.md como base e mantenha o mesmo conteúdo.

## 11. Documentos para a loja (não publique nada)
Garanta que estes arquivos existam em `docs/fase-c/` e estejam coerentes com o que foi implementado (corrija se a implementação divergiu e me avise): `politica-privacidade-extensao.md`, `justificativas-permissoes.md`, `textos-da-loja.md`, `guia-publicacao-loja.md`.

## Geral
- Temas claro/escuro do painel seguindo o tema do Chrome; estados vazios, de erro e de carregamento em todas as telas.
- Branch `fase-c-extensao-1`, **um commit por seção**, build + typecheck + testes passando, Pull Request para a main, sem merge. No PR: migrações em ordem com SQL pronto para o SQL editor do Lovable, lista de seletores do WhatsApp usados (para eu saber o que pode quebrar), como a detecção de grupo decide, e o que não foi possível validar sem abrir o WhatsApp Web (o teste real é meu, com a pasta carregada sem compactação).
