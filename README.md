# Revisão Nocaute OAB 46 — Landing + Checkouts

Projeto para a Vercel com:
- `public/index.html` → landing de seleção das 6 disciplinas
- `public/checkout-*.html` → 1 checkout por disciplina (Trabalho, Constitucional, Penal, Civil, Tributário, Administrativo)
- `api/criar-pix.js` → função serverless que gera o Pix (QR Code + copia-e-cola) via chave aleatória, sem gateway

## ✅ Chave Pix já configurada

A chave Pix aleatória (`13871026-0aef-4a12-a405-1a42628144c5` — mesma do Black Namastê) já está como valor padrão em `api/criar-pix.js`. Não precisa configurar nada antes do primeiro deploy.

Se quiser trocar a chave sem editar código, configure como variável de ambiente na Vercel:

1. No painel da Vercel → seu projeto → **Settings → Environment Variables**
2. Adicione:
   - `PIX_KEY` = nova chave (substitui a padrão)
   - `PIX_MERCHANT_NAME` = `VICIO DE UMA ESTUDANTE` (opcional, já é o padrão)
   - `PIX_MERCHANT_CITY` = `FORTALEZA` (opcional, já é o padrão)
3. Re-deploy o projeto para a variável entrar em vigor

## Como funciona o pagamento (sem gateway)

Como a chave Pix é aleatória e direta (sem Mercado Pago/gateway), **não existe confirmação automática de pagamento**. O fluxo é:

1. Cliente preenche os dados e clica em "Comprar agora"
2. O sistema gera o QR Code + código copia-e-cola na hora (localmente, via EMV/CRC16)
3. Cliente paga pelo app do banco
4. Cliente clica em **"✅ Já paguei, confirmar no WhatsApp"** — abre o WhatsApp já com nome/email preenchidos, para a equipe confirmar manualmente e liberar o acesso

## Deploy na Vercel

```bash
# Dentro da pasta do projeto:
npm install
vercel --prod
```

Ou conecte o repositório GitHub diretamente no painel da Vercel (recomendado): a Vercel detecta `vercel.json` e `api/` automaticamente.

## Estrutura de URLs após o deploy

- `seudominio.com/` → landing de seleção
- `seudominio.com/checkout-trabalho.html` → checkout Direito do Trabalho
- `seudominio.com/checkout-constitucional.html` → checkout Direito Constitucional
- `seudominio.com/checkout-penal.html` → checkout Direito Penal
- `seudominio.com/checkout-civil.html` → checkout Direito Civil
- `seudominio.com/checkout-tributario.html` → checkout Direito Tributário
- `seudominio.com/checkout-administrativo.html` → checkout Direito Administrativo

Cada botão "Comprar agora" da landing já aponta para o checkout correto.

## Preço

Todas as disciplinas: de R$ 1.297,00 por **R$ 297,00** (à vista, Pix).

## WhatsApp de suporte

Configurado para: `5511920096589` (mesmo número usado no Black Namastê). Se for outro número, troque a constante `WHATSAPP_NUM` em cada `checkout-*.html` e o link `href="https://wa.me/..."` no `index.html`.
