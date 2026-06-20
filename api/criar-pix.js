// api/criar-pix.js

const QRCode = require('qrcode');

const PIX_KEY = process.env.PIX_KEY || '13871026-0aef-4a12-a405-1a42628144c5';
const MERCHANT_NAME = process.env.PIX_MERCHANT_NAME || 'VICIO DE UMA ESTUDANTE';
const MERCHANT_CITY = process.env.PIX_MERCHANT_CITY || 'FORTALEZA';

// Descrição fixa exibida no app do banco ao escanear o Pix (campo 02,
// dentro do Merchant Account Information). É travada manualmente aqui —
// nunca deve receber o nome do produto/curso, só este texto fixo.
const PIX_DESCRICAO = process.env.PIX_DESCRICAO || 'VICIO DE UMA ESTUDANTE';

// IMPORTANTE: o tamanho de cada campo EMV deve ser contado em BYTES (UTF-8),
// não em caracteres. Isso evita corromper o payload quando há qualquer
// caractere fora do ASCII puro escapando para esses campos.
function emvField(id, value) {
  value = String(value || '');
  const byteLength = Buffer.byteLength(value, 'utf8');
  const len = byteLength.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16(payload) {
  let crc = 0xffff;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;

    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Usado para nome do beneficiário, cidade (campos 59 e 60) e para a
// descrição fixa (campo 02), que exigem texto maiúsculo, sem acento e
// sem caracteres especiais. Esta função NUNCA deve receber o nome do
// produto/curso — apenas o texto fixo PIX_DESCRICAO definido acima.
// O BR Code não tem (e não deve ter) um campo de "descrição do produto"
// dinâmico; isso pertence aos metadados da nossa própria aplicação.
function limparTexto(str, max) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .substring(0, max);
}

function limparValor(valor) {
  const numero = Number(
    String(valor)
      .replace(',', '.')
      .replace(/[^\d.]/g, '')
  );

  if (!Number.isFinite(numero) || numero <= 0) {
    throw new Error('Valor Pix inválido.');
  }

  return numero.toFixed(2);
}

function gerarTxid() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let txid = '';

  for (let i = 0; i < 14; i++) {
    txid += chars[Math.floor(Math.random() * chars.length)];
  }

  return txid;
}

// Gera o payload Pix (BR Code) EMV puro: chave aleatória + descrição
// fixa + valor + txid. O campo de descrição (02) é sempre o texto fixo
// PIX_DESCRICAO — nunca o nome do produto/curso vindo da requisição.
function gerarPayloadPix({ valor }) {
  const valorFormatado = limparValor(valor);
  const txid = gerarTxid();

  const merchantAccountInfo = emvField(
    '26',
    emvField('00', 'br.gov.bcb.pix') +
    emvField('01', PIX_KEY) +
    emvField('02', limparTexto(PIX_DESCRICAO, 25))
  );

  const payloadSemCRC =
    emvField('00', '01') +
    emvField('01', '11') +
    merchantAccountInfo +
    emvField('52', '0000') +
    emvField('53', '986') +
    emvField('54', valorFormatado) +
    emvField('58', 'BR') +
    emvField('59', limparTexto(MERCHANT_NAME, 25)) +
    emvField('60', limparTexto(MERCHANT_CITY, 15)) +
    emvField('62', emvField('05', txid)) +
    '6304';

  return {
    txid,
    payload: payloadSemCRC + crc16(payloadSemCRC),
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: true,
      message: 'Método não permitido.',
    });
  }

  try {
    const {
      valor,
      email,
      primeiro_nome,
      ultimo_nome,
      cpf,
      materia,
      produto,
    } = req.body || {};

    if (!valor || !email) {
      return res.status(400).json({
        error: true,
        message: 'Dados obrigatórios faltando (valor, email).',
      });
    }

    // O campo "produto" (nome do curso/oferta) é usado SOMENTE como
    // metadado de negócio (para registro/CRM/WhatsApp). Ele nunca é
    // inserido no payload EMV do Pix.
    const { payload, txid } = gerarPayloadPix({ valor });

    const qrCodeBase64 = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 360,
    });

    return res.status(200).json({
      id: txid,
      status: 'pending',
      point_of_interaction: {
        transaction_data: {
          qr_code: payload,
          qr_code_base64: qrCodeBase64.replace(/^data:image\/png;base64,/, ''),
        },
      },
      metadata: {
        email,
        primeiro_nome: primeiro_nome || null,
        ultimo_nome: ultimo_nome || null,
        cpf: cpf || null,
        materia: materia || null,
        produto: produto || null,
        valor,
      },
    });
  } catch (err) {
    console.error('Erro ao gerar Pix:', err);

    return res.status(500).json({
      error: true,
      message: 'Erro interno ao gerar o Pix.',
    });
  }
};
