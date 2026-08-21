# Central de Apoio — Cartão de Todos

Plataforma interna de apoio ao time de atendimento do **Cartão de Todos** (cartão de descontos em saúde). Reúne treinamento com IA, biblioteca de scripts de atendimento, tabela de preços, base de conhecimento, gestão de leads e ferramentas administrativas — tudo em um único painel.

## Stack

- **Frontend:** React + [TanStack Start / Router](https://tanstack.com/start) (`createServerFn` como camada de servidor)
- **Backend:** [Supabase](https://supabase.com) (Postgres + Auth + Storage), acessado via server functions
- **Hospedagem:** [Lovable](https://lovable.dev), sincronizado com este repositório
- **IA:** modelos via API (Gemini), usados no simulador, na busca semântica da base de conhecimento e nos assistentes de preenchimento automático espalhados pelo painel Admin

## Funcionalidades principais

### Simulador de Atendimento (IA)
- Perfis de cliente configuráveis (personalidade, objeções, dificuldade, dados fictícios de cadastro)
- Dois modos de comportamento: **Filiação** (cliente fornecendo dados pela primeira vez) e **Reativação/Refiliação/Migração** (cliente já cadastrado, a IA confirma ou corrige dados divergentes)
- Atalhos de mensagem no estilo WhatsApp Business (`/palavra`) puxando da biblioteca de scripts
- Avaliação automática ao fim de cada atendimento, com notas de clareza, empatia e fechamento
- Teste automático de estabilidade: a IA joga cliente **e** atendente para verificar se um perfil consegue completar o atendimento do início ao fim sem travar

### Mensagens / Scripts de Atendimento
- Biblioteca pesquisável de mensagens prontas, organizadas por categoria e subcategoria
- **Fluxo de Atendimento**: etapas ordenadas por tipo de atendimento (Filiação, Refiliação, Migração...), com mensagens podendo pertencer a vários fluxos ao mesmo tempo
- Geração de novos scripts por IA a partir de uma descrição livre
- Organizador automático de fluxo por IA

### Tabela de Preços
- Preenchimento automático por IA a partir de texto colado
- Regiões de disponibilidade por especialidade (principais / outras)
- Geração de descrições de busca por IA (sinônimos e termos leigos)

### Base de Conhecimento & Assistente IA (MarcIAna)
- Conteúdo organizado por tipo (regras, procedimentos, artigos, conversas-modelo, documentos, treinamentos)
- Assistente com busca semântica (RAG) sobre esse conteúdo

### Painel Administrativo
- Navegação lateral organizável em grupos (arraste itens entre categorias)
- Gestão de usuários, categorias, mensagens, preços, base de conhecimento e aparência do site
- Central de Novidades: cole um resumo do que mudou e a IA publica como changelog, com painel flutuante visível em todo o site

### Outras áreas
- Funil de leads e prospecção (CRM)
- Painel de funcionários com classificação de maturidade (P1–P4)
- Motor de decisão e dashboard operacional
- Ranking e gamificação da equipe

## Estrutura do projeto

```
src/
  routes/_authenticated/   # páginas (uma por rota — ex: simulador-ia.tsx, precos.tsx, admin.tsx)
  components/               # componentes React reutilizáveis
  components/admin/         # abas do Painel Administrativo
  components/ui/            # componentes de base (shadcn/ui)
  lib/                      # server functions (*.functions.ts) — a ponte com o Supabase
  integrations/supabase/    # cliente Supabase e middlewares de autenticação
supabase/
  migrations/               # todo o histórico de mudanças no banco, em SQL puro
```

## Como as mudanças são aplicadas

Este projeto **não usa um ambiente de desenvolvimento local**. O fluxo de trabalho é:

1. Alterações de código são coladas diretamente no editor web do GitHub e commitadas na branch `main`.
2. Alterações de banco de dados vêm como um arquivo `.sql` em `supabase/migrations/` (versionado aqui, por histórico) **e** precisam ser rodadas manualmente no **Supabase → SQL Editor** — commitar o arquivo sozinho não aplica a mudança no banco.
3. O Lovable sincroniza automaticamente com a branch `main` e publica o site.

Por isso, ao revisar um Pull Request ou histórico de commits, tenha em mente que cada commit tende a substituir arquivos inteiros (não são diffs incrementais no sentido tradicional de um fluxo com múltiplos desenvolvedores).

## Convenções

- Categorias com `scope = 'message'` representam os **tipos de atendimento** (Filiação, Refiliação, Migração, EDT...) — usadas tanto na Biblioteca de mensagens quanto no Fluxo de Atendimento.
- Uma mensagem pode pertencer a várias etapas de fluxo diferentes ao mesmo tempo (tabela `message_flow_links`), permitindo reaproveitar o mesmo script em mais de um tipo de atendimento.
- Ícones em painéis configuráveis (Admin, nav lateral) são referenciados por nome de string e resolvidos via `src/lib/icon-map.ts`.
