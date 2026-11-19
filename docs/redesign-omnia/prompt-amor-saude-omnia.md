Página 3 do redesign OMNIA Apoio: Amor Saúde (hoje a rota de preços, "Tabela de Preços", com Consultas, Exames e Procedimentos Odontológicos; e a aba "Clínica Amor Saúde" de Contatos e Endereços). Siga os tokens e regras da marca de docs/redesign-omnia/prompt-lovable-base-omnia.md.

Esboços aprovados (siga fielmente):
- docs/redesign-omnia/amor-hub.png (entrada)
- docs/redesign-omnia/amor-consultas.png (Consultas: lista + detalhe + orçamento)
- docs/redesign-omnia/amor-exame.png (Exames; Odontologia segue o mesmo modelo)
- docs/redesign-omnia/card-especialidades.png (imagem "Todas as especialidades" para o cliente)

Textos, valores, endereços e contagens dos esboços são ilustrativos: tudo vem do banco.

Diferente das páginas anteriores, ESTA etapa inclui campos novos no banco (aprovado). Campo vazio = o bloco correspondente não aparece. Gere as migrações em supabase/migrations/ e, no PR, me diga exatamente quais preciso rodar no SQL Editor do Supabase e em que ordem. Não apague colunas antigas nesta etapa.

## Dados (migrações + Admin)
1. Clínicas Amor Saúde: use os registros que hoje alimentam a aba "Clínica Amor Saúde" de Contatos e Endereços. Garanta que cada clínica tenha: nome, região (ex.: Ribeirão das Neves, Justinópolis, Veneza, Venda Nova, Belo Horizonte), endereço, telefone/WhatsApp, link do Google Maps (se não houver, gere a partir do endereço), e "principal" (sim/não).
2. Especialidades (consultas): relação muitos-para-muitos especialidade ↔ clínica (substitui o texto livre "Principais: … / Outras regiões: …"). Migração de dados: tente casar os nomes de região do texto antigo com as clínicas; o que não casar fica para eu marcar no Admin, e mantenha o texto antigo visível no Admin como referência até eu conferir. Novos campos: "Área" (texto curto com sugestões: Clínica e família, Coração e circulação, Ossos e movimento, Mente, Pele e visão, Outras), "Para quem indicar" (texto) e "Como agendar" (texto).
3. Exames: relação exame ↔ clínica (mesma lógica); "Média de referência" (valor, opcional) com a observação fixa "varia conforme o pedido médico"; preparo como lista de itens (aproveite jejum, material/método e a observação que já existem, e permita itens extras).
4. Odontologia: relação procedimento ↔ clínica; e um valor geral "Avaliação odontológica (Cartão de TODOS)" configurável no Admin.
5. Uso: registre cada cópia feita nesta página (especialidade, exame ou procedimento) para alimentar "Mais procuradas" (reaproveite a estrutura de contagem de uso das mensagens se servir).
6. Admin: adicione esses campos nas telas de cadastro de preços/exames/procedimentos/clínicas que já existem, com seleção múltipla de clínicas por item.

## Rotas
- /amor-saude → entrada (hub). /precos e links antigos redirecionam para cá (mantendo a aba, se vier na URL).
- /amor-saude/consultas, /amor-saude/exames, /amor-saude/odontologia, /amor-saude/clinicas (aceitam ?item= para abrir um item direto; a busca global abre o item certo).
- Contatos e Endereços: remova a aba "Clínica Amor Saúde" e coloque no lugar dela um link "As clínicas Amor Saúde agora ficam em Amor Saúde → Clínicas".

## 1. Entrada — amor-hub.png
- Overline "AMOR SAÚDE", título "COMO POSSO AJUDAR O CLIENTE?" (Cinzel, caixa alta), subtítulo "Preços, clínicas e serviços para os clientes do Cartão de TODOS."
- 6 cards (3 por linha, mesmo componente do hub de Scripts): Consultas, Exames, Odontologia, Clínicas (com contagens reais), Teleconsulta e PA digital (EM BREVE, sem link), Dúvidas frequentes (EM BREVE, sem link).
- Busca "Ou busque uma especialidade, exame ou clínica…" (abre a busca global filtrada).

## 2. Cabeçalho comum das subpáginas
- Título da subpágina (24px), abas de texto Início · Consultas · Exames · Odontologia · Clínicas, busca da aba à direita.
- Seletor "Região do cliente" no canto superior direito, com as regiões das clínicas. A escolha vale para todas as subpáginas enquanto a pessoa estiver no Amor Saúde (guarde em sessionStorage). Sem escolha: ordena por clínicas principais.

## 3. Consultas — amor-consultas.png
- Coluna da lista (≈500px): linha "Mais procuradas" com as 5 especialidades mais copiadas (pílulas clicáveis); cabeçalho de colunas; uma linha de 52px por especialidade: caixa de seleção do orçamento, nome, preço Cartão de TODOS (gold-text, 600), particular riscado (ink-muted), desconto "−67%". Linha selecionada com fundo sidebar e linha dourada à esquerda.
- No topo da lista, botão "Todas as especialidades" (ver seção 7).
- Detalhe: overline CONSULTA, nome, descrição (só para o atendente), bloco de preços (Cartão de TODOS grande em gold-text, Particular riscado, "Economia de R$ X · Y%"), "Para quem indicar", "Onde atende · perto do cliente primeiro" (clínicas que oferecem a especialidade: primeiro as da região escolhida com selo "MAIS PRÓXIMA", depois as principais com selo "PRINCIPAL", depois as demais com selo "OUTRA REGIÃO"; cada uma com nome, bairro/endereço), "Como agendar".
- Botões: "Copiar sobre a especialidade" (gold), "Copiar clínicas próximas" (contorno) e "+ Orçamento" / "✓ No orçamento" (link dourado).

### Texto de "Copiar sobre a especialidade" (sem a descrição):
```
*<Especialidade> pelo Cartão de TODOS* 🩺
💚 Cartão de TODOS: *R$ <valor>*
Particular: R$ <particular> (você economiza R$ <economia>)
📍 Mais perto de você: <clínica mais próxima> – <endereço>
Também atende em: <outras clínicas, por região>.
```
Sem região escolhida: troque a linha 📍 por "📍 Atende em: <principais>". Linhas sem dado somem.

### Texto de "Copiar clínicas próximas":
```
📍 *Clínicas Amor Saúde para <especialidade>*
*<Clínica>* – <endereço>
📞 <telefone> · Rota: <link do Maps>
(repete para cada clínica, a mais próxima primeiro, no máximo 4)
```

## 4. Exames — amor-exame.png
- Mesmo layout. Lista com caixa do orçamento, nome e tipo (Laboratorial/Imagem); filtro por tipo como pílulas acima da lista; "Mais procurados" no topo.
- Detalhe: overline "EXAME DE <TIPO> · <categoria>", nome, descrição, bloco "Valor: Consulte a clínica" + "Média de referência: R$ X" (se houver) + "Varia conforme o pedido médico"; "Preparo" como lista com marcador dourado; "Onde faz · perto do cliente primeiro".
- Botões: "Copiar sobre o exame" (gold), "Copiar preparo", "Copiar clínicas", "+ Orçamento".
- Copiar sobre o exame: nome do exame, "Valor: consulte a clínica (média de R$ X, varia conforme o pedido médico)" quando houver média, e as clínicas como na consulta. Copiar preparo: "*Preparo para <exame>*" + itens com "•".

## 5. Odontologia
- Igual a Exames, mas o bloco de valor mostra "Valor após avaliação" e "Avaliação odontológica pelo Cartão de TODOS: R$ X" (valor do Admin). Sem preparo. Botões: "Copiar sobre o procedimento", "Copiar clínicas", "+ Orçamento".

## 6. Clínicas
- Lista de clínicas agrupada por região (a região do cliente primeiro): nome, endereço, telefone, especialidades oferecidas (resumo "N especialidades"), botões "Abrir no Maps" e "Copiar endereço" (endereço + telefone + link do Maps). Sem mapa embutido.

## 7. Todas as especialidades — card-especialidades.png
- Botão "Todas as especialidades" no topo de Consultas abre um painel com duas ações:
  - "Copiar texto": "No Cartão de TODOS você tem consultas a partir de *R$ <menor valor>* nestas especialidades:" + uma linha por Área ("🩺 *Clínica e família:* clínico geral, pediatria…") + "Quer saber o valor de alguma delas? 😊". Especialidades sem área entram em "Outras". Ordem das áreas: a da lista de sugestões; dentro da área, alfabética.
  - "Baixar imagem": gera no navegador um PNG 1080×1350 igual ao esboço, com as especialidades reais agrupadas por área. Esta imagem é para o CLIENTE: usa a identidade do Cartão de TODOS (o logo que já existe em src/assets e o verde/amarelo do antigo tema "Verde Cartão de Todos"), não a marca OMNIA. Se a lista for grande, reduza a fonte em vez de cortar itens.

## 8. Orçamento (carrinho)
- Itens marcados (consultas, exames, procedimentos) aparecem numa barra escura fixa no rodapé: "Orçamento · N itens", nomes resumidos, "Total Cartão R$ X · economia de R$ Y" (só soma itens com preço fixo; exames/odonto entram como "consulte a clínica") e botão dourado "Copiar orçamento". Botão discreto "Limpar".
- Texto copiado:
```
*Seu orçamento pelo Cartão de TODOS* 💚
• <Especialidade>: *R$ <valor>* (particular R$ <particular>)
• <Exame>: consulte a clínica (média de R$ X)
*Total no Cartão de TODOS: R$ <soma>*
No particular: R$ <soma particular> · você economiza *R$ <economia>*
```
- O orçamento fica salvo em sessionStorage enquanto a pessoa navega pelo Amor Saúde.

## Geral
- Remova os 3 cards de resumo antigos e os cards grandes por item. A dica "o particular custa cerca de 3× o valor do Cartão de TODOS" vira uma linha discreta acima da lista de Consultas.
- Nada de etiqueta de gôndola: preço é texto da marca.
- Estados vazios simples. Teste nos temas claro e escuro, em 1280px e 1920px.

Trabalhe numa branch omnia-amor-saude, um commit por seção, rode build e typecheck, e abra um Pull Request para a main. Não faça merge sozinho. No PR: lista das migrações a rodar (em ordem), rotas novas, o que mudou no Admin e o resultado da migração de dados (quantas especialidades/exames ficaram com clínicas casadas e quantas precisam de revisão manual).
