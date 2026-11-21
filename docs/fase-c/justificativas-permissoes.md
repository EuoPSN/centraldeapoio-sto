# Justificativas para a loja (aba "Privacy practices")

**Finalidade única (single purpose):** ajudar o atendente a criar e atualizar tickets de clientes e preparar respostas a partir da conversa individual aberta no WhatsApp Web, dentro da plataforma OMNIA Apoio.

**Permissão `sidePanel`:** exibe o painel da OMNIA ao lado do WhatsApp Web, onde o atendente confere e salva o ticket.

**Permissão `storage`:** guarda localmente a sessão de login, o estado de Pausar e a confirmação do aviso "O que a extensão faz".

**Acesso ao host `https://web.whatsapp.com/*`:** necessário para ler a conversa individual aberta quando o atendente clica em "Ler esta conversa" e a lista de conversas para medir o tempo de primeira resposta. Não lê grupos, não envia mensagens.

**Acesso aos hosts do servidor da OMNIA Apoio (dois endereços: o do banco de dados/login e o do aplicativo da Omnia):** necessário para entrar com a conta do atendente, enviar o texto já sem dados pessoais, receber a sugestão de ticket, salvar o ticket e listar os tickets do dia. Nenhum outro site é acessado.

**Código remoto:** não usa. Todo o código (inclusive as fontes) está dentro do pacote enviado. Sem `eval`, sem `<all_urls>`, sem as permissões `tabs` e `scripting`.

**Uso de dados (declarações):** coleta "conteúdo de comunicações" apenas para a funcionalidade, sem venda a terceiros, sem uso para publicidade, sem uso para avaliação de crédito. Dados enviados com criptografia (HTTPS).
