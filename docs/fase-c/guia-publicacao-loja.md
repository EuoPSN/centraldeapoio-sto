# Guia: publicar a extensão na Chrome Web Store (visibilidade não listada)

Antes, confirme que testou a extensão no seu Chrome e que a CDT autorizou o uso (P21: autorizado).

## 1. Conta
1. Crie uma conta Google nova só para isso. Ative a verificação em duas etapas com chave de segurança (ou passkey) e guarde os códigos de recuperação.
2. Acesse o Painel do Desenvolvedor da Chrome Web Store com essa conta.
3. Aceite os termos e pague a taxa única de registro (cerca de US$ 5). Confirme o e-mail de contato (ele aparece publicamente na página da extensão).

## 2. Gerar o pacote
No repositório: `cd extension && npm run build && npm run zip`. O arquivo sai em `extension/dist/omnia-extensao-<versao>.zip`.

## 3. Enviar
1. No painel, "Novo item" e envie o .zip.
2. **Listagem:** cole os textos de `textos-da-loja.md`, envie o ícone e as capturas (dados fictícios).
3. **Práticas de privacidade:** cole as justificativas de `justificativas-permissoes.md`, declare os dados tratados e informe o endereço público da política: `<endereço da Omnia>/privacidade-extensao`.
4. **Distribuição:** escolha **Não listada** (só quem tem o link instala). Se preferir mais controle, use "Testadores confiáveis" com a lista de e-mails da equipe.
5. Envie para revisão.

## 4. Depois do envio
- A primeira revisão pode levar de alguns dias a algumas semanas. Cada atualização passa por nova revisão.
- Se o Google pedir ajustes, copie a mensagem para mim e eu corrijo.
- Aprovada, copie o link da extensão e envie à equipe. Cada atendente clica "Usar no Chrome", fixa o ícone e entra com a conta da Omnia.

## 5. Atualizações
Aumente a versão, gere novo zip, envie como atualização do mesmo item. Se mudar o endereço do servidor (oficialização), é preciso publicar nova versão com a nova URL de `config.ts`.

## Cuidados
- Só você acessa essa conta. Nunca compartilhe a senha.
- Não publique antes do dia de teste geral e da confirmação de que as telas funcionam com o WhatsApp Web real.
