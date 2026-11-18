# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Atendentes / vendedores da Venda Interna (~26 pessoas)** do Cartão de TODOS (CDT), unidade Ribeirão das Neves. Vendem e atendem clientes B2C **só por mensagem (WhatsApp)**; a equipe não faz ligações.
- **Paulo (gerente/treinador, admin):** cadastra todo o conteúdo no Painel Admin, alimenta a IA, acompanha a equipe (check-list, ranking, painel P1–P4).

## Product Purpose

Central de Apoio é a ferramenta interna que deixa ao alcance do atendente, durante a conversa com o cliente, a mensagem certa e a informação certa. Sucesso = o atendente responde rápido, com a informação correta, sem procurar.

## Operating Context

- Uso no **PC, com a Central numa janela lado a lado com o WhatsApp Web** no mesmo monitor. A largura útil típica é meia tela (~640–960 px).
- Durante o atendimento, as duas tarefas dominantes são:
  1. **Copiar script/mensagem** da etapa do Fluxo de Atendimento e colar no WhatsApp;
  2. **Consultar preço/cobertura** (tabela de preços Amor Saúde, exames, procedimentos odontológicos, unidades/contatos).
- Todo o resto (simuladores, MarcIAna, check-list, ranking, treinamentos, biblioteca, criar script) é **periódico** ou ainda não está 100% funcional.
- O admin trabalha em tela cheia no Painel Admin.

## Capabilities and Constraints

- Stack: React + TanStack Start/Router, Tailwind v4, shadcn/ui, Supabase (Postgres, Auth, Storage, RLS), hospedado no Lovable; repositório github.com/EuoPSN/centraldeapoio-sto (branch `main`, sincroniza com o Lovable).
- Menu lateral vem da tabela `nav_items`; abas do admin da tabela `admin_sections`.
- Conteúdo é todo cadastrado pelo admin (mensagens, preços, conhecimento, cenários, planos em promoção, mensagens da home com cores/fontes escolhidas pelo admin).
- Existe um seletor de temas (`src/lib/themes.ts`, aba Aparência). Destino no redesign: em aberto.
- Linguagem: português do Brasil. Termos da casa: Fluxo de Atendimento, etapas, caminhos, MarcIAna, Check-list, KYC, Refuturiza, Energia de Todos, Amor Saúde, planos Prata/Ouro/Diamante.

## Brand Commitments

- Obrigatório manter apenas o **logo** do Cartão de TODOS. As cores podem mudar, contanto que pareça CDT.
- Em mensagens para clientes, não dizer "não é plano de saúde".
- Direção visual escolhida (18/11/2026): padrão limpo de software de trabalho, com a etiqueta de preço de gôndola (amarela; vermelha para promoção) como único elemento chamativo. Régua de acabamento: Nubank / apps de banco (limpo, direto, cor forte da marca).
- Seletor de temas: removido nesta fase; volta numa atualização futura.

## Evidence on Hand

- Logo: `src/assets/logo.png.asset.json`; avatar da MarcIAna: `src/assets/marciana-avatar.png`.
- Resumo do conteúdo da Central (PDF de 16/11/2026) fora do repositório.

## Product Principles

1. **Duas tarefas primeiro.** Copiar a mensagem e achar o preço precisam ser as ações mais rápidas do site, em meia tela.
2. **Ferramenta de trabalho, não vitrine.** A tela serve ao atendimento em andamento; treino e gamificação ficam acessíveis, mas não competem com o trabalho.
3. **Menos procura, mais resposta.** Busca e atalhos levam direto ao conteúdo, não a páginas intermediárias.
4. **Dois públicos.** Novatos precisam aprender; veteranos precisam de velocidade e profundidade.
