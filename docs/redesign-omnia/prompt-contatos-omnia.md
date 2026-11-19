Página 4 do redesign OMNIA Apoio: Contatos e Endereços (rota /contatos, tabela public.contatos_enderecos, Admin em src/components/admin/ContatosTab.tsx). Siga os tokens e regras da marca de docs/redesign-omnia/prompt-lovable-base-omnia.md e o padrão de lista + detalhe já usado em Amor Saúde.

Esboços aprovados (siga fielmente):
- docs/redesign-omnia/contatos-lista.png (lista com filtros + detalhe de uma unidade)
- docs/redesign-omnia/contatos-busca.png (busca por cidade sem unidade → mais próximas)
- docs/redesign-omnia/contatos-suporte.png (filtro Suporte e setores + detalhe de um suporte)

Nomes, endereços, telefones e contagens dos esboços são ilustrativos: tudo vem do banco.

IMPORTANTE SOBRE O MODO DE TRABALHO
- NÃO monte harness visual, servidor de preview com Playwright nem tire capturas de tela. Eu reviso as telas. Valide com build e typecheck.
- Parta do estado atual da main (o PR do Amor Saúde já foi aplicado: a aba "Clínica Amor Saúde" já pode ter saído desta página). Não mexa nas clínicas Amor Saúde nem nas rotas /amor-saude.

## Dados (migração + Admin)
Esta etapa inclui campos novos no banco (aprovado). Gere a migração em supabase/migrations/ e, no PR, diga exatamente o que preciso rodar no SQL Editor do Supabase e em que ordem. Não apague colunas antigas. Campo vazio = a linha correspondente não aparece no detalhe nem na mensagem copiada.

Tipos de contato: "cartao_de_todos" passa a se chamar na interface "Unidades CDT"; "outros" passa a se chamar "Suporte e setores". Mantenha os valores no banco (não renomeie o enum/texto), mude só os rótulos. Registros com tipo "clinica_amor_saude" não aparecem nesta página.

Campos novos em contatos_enderecos (todos opcionais):
1. bairro (texto) e cidade (texto) — usados no subtítulo da linha ("Centro · Ribeirão das Neves") e na busca. Migração de dados: se possível, preencha a partir de nome_regiao/endereco; o que não der fica vazio para eu completar.
2. horario (texto livre, ex.: "Seg a sex, 8h às 18h · Sáb, 8h às 12h").
3. maps_url (texto) — se estiver vazio numa unidade com endereço, o botão gera o link de busca do Google Maps a partir de endereço + número + bairro + cidade.
4. atende_tambem (lista de textos: cidades e bairros próximos atendidos pela unidade, ex.: Esmeraldas, Sevilha, Florença). Só para Unidades CDT.
5. Para Suporte e setores: subtitulo (linha curta, ex.: "Cursos online · acesso e certificados"), quando_indicar (texto), whatsapp, email, site (textos). Os campos contato1/2/3 continuam existindo e aparecem como "Telefones".
6. updated_at (timestamp, atualizado automaticamente a cada edição; preencha os existentes com a data atual).

Admin (ContatosTab):
- Duas abas: "Unidades CDT" e "Suporte e setores" (a de Amor Saúde não aparece aqui).
- Formulário de unidade: nome, bairro, cidade, endereço, número, ponto de referência, horário, telefones (1–3), link do Maps (com dica "deixe vazio para gerar pelo endereço"), "Atende também" (campo de etiquetas: digita e Enter), "Principal" (sim/não), ordem.
- Formulário de suporte: nome (produto/setor), subtítulo, quando indicar, WhatsApp, telefones, e-mail, site, horário, ordem.
- Atualize "Preencher com IA" e "Organizar com IA" para conhecer e preencher os campos novos (mantendo o modelo Gemini atual de src/lib/ai-models.ts).

## Página /contatos
### Cabeçalho
- Título "Contatos e Endereços" (24px) + linha de apoio "Unidades para o cliente ir e suportes para ele resolver."
- Filtros em pílulas, com contagem: Todos · Unidades CDT · Suporte e setores. Abre em "Todos". Sem abas, sem tela de entrada.
- Busca à direita: "Buscar cidade, bairro ou suporte…". Procura (sem acento e sem diferenciar maiúsculas) em nome, bairro, cidade, ponto de referência, atende_tambem, subtítulo e quando_indicar.

### Lista (coluna esquerda ≈600px) — contatos-lista.png
- Grupos com overline: "Unidades principais" (destaque = true), "Outras regiões" (Unidades CDT sem destaque), "Suporte e setores". Com um filtro ativo, mostra só os grupos dele.
- Cada contato é uma linha de 50px: nome (600) com subtítulo pequeno embaixo (bairro · cidade para unidades; subtitulo para suportes), telefone principal (números tabulares) e botão pequeno "Copiar" (copia a mensagem completa, igual ao botão principal do detalhe). Clique na linha abre o detalhe; linha ativa com fundo sidebar e linha dourada à esquerda.
- Ao abrir a página, o primeiro contato da lista já vem selecionado.

### Busca sem unidade na cidade — contatos-busca.png
- Se o termo buscado não corresponde a nome/bairro/cidade de nenhuma unidade, mas aparece em atende_tambem de alguma: mostre um aviso "Não há unidade em <termo>. Mais próximas, segundo o cadastro:" e, abaixo, essas unidades, com o subtítulo "Atende também <termo>".
- Se nada for encontrado: "Nada encontrado para <termo>." e um link "Limpar busca".

### Detalhe da unidade (coluna direita) — contatos-lista.png
- Overline "UNIDADE CARTÃO DE TODOS", nome (24px) + selo "PRINCIPAL" quando destaque, subtítulo bairro · cidade.
- Lista de campos (rótulo em overline à esquerda, valor à direita): Endereço, Referência, Horário, Telefones, Maps ("Abrir rota no Google Maps ↗", abre em nova aba), Atende também (pílulas).
- Bloco "Mensagem que vai ser copiada" (fundo surface-2) com a prévia exata.
- Botões: "Copiar mensagem" (dourado) e "Copiar só o endereço" (contorno).
- "Atualizado em dd/mm/aaaa" discreto no fim.
- Mensagem copiada da unidade:
```
Cartão de TODOS – <nome>
Endereço: <endereço>, nº <número> – <bairro>
Ponto de referência: <referência>
Horário: <horário>
Telefone: <telefones separados por " · ">
Como chegar: <link do Maps>
```

### Detalhe do suporte — contatos-suporte.png
- Overline "SUPORTE", nome (24px), subtítulo.
- Campos: Quando indicar (primeiro), WhatsApp, Telefones, E-mail, Site (link ↗), Horário.
- Prévia "Mensagem que vai ser copiada", botões "Copiar mensagem" (dourado) e "Copiar só o WhatsApp" (ou "Copiar só o telefone" se não houver WhatsApp), "Atualizado em".
- Mensagem copiada do suporte (sem o "Quando indicar", que é só para o atendente):
```
Para falar com o suporte <nome>, use:
WhatsApp: <whatsapp>
Telefone: <telefones>
E-mail: <email>
Site: <site>
Atendimento: <horário>.
```

## Geral
- Remova os cards grandes em 2 colunas, as abas antigas e a divisão "Principais / Outras regiões" em abas.
- Estados vazios simples. Respeite temas claro e escuro.
- Registre as cópias desta página na mesma estrutura de contagem de uso já usada (se existir), com o id do contato.

Trabalhe numa branch omnia-contatos, um commit por seção, rode build e typecheck, e abra um Pull Request para a main. Não faça merge sozinho. No PR: migrações a rodar (em ordem), campos novos, o que mudou no Admin e quantos contatos tiveram bairro/cidade preenchidos automaticamente e quantos ficaram para eu completar.
