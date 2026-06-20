// api/criar-pix.js
// Gera o payload Pix (BR Code) EMV no padrão Banco Central, usando chave Pix aleatória.
// Sem gateway — geração local do "copia e cola" + QR Code.

const QRCode = require('qrcode');

// ── Configuração do beneficiário ──────────────────────────────
const PIX_KEY        = process.env.PIX_KEY || '13871026-0aef-4a12-a405-1a42628144c5';
const MERCHANT_NAME  = (process.env.PIX_MERCHANT_NAME || 'VICIO DE UMA ESTUDANTE').substring(0, 25);
const MERCHANT_CITY  = (process.env.PIX_MERCHANT_CITY || 'FORTALEZA').substring(0, 15);
// ────────────────────────────────────────────────────────────────

function emvField(id, value) {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function gerarTxid() {
  // txid alfanumérico de até 25 caracteres (sem acentos/símbolos), aqui usamos 14
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let txid = '';
  for (let i = 0; i < 14; i++) {
    txid += chars[Math.floor(Math.random() * chars.length)];
  }
  return txid;
}

function removerAcentos(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toUpperCase();
}

function gerarPayloadPix({ chave, nome, cidade, valor, txid, descricao }) {
  const valorFormatado = Number(valor).toFixed(2);

  const gui   = emvField('00', 'br.gov.bcb.pix');
  const key   = emvField('01', chave);
  const desc  = descricao ? emvField('02', descricao.substring(0, 25)) : '';
  const merchantAccountInfo = emvField('26', gui + key + desc);

  const merchantCategoryCode = emvField('52', '0000');
  const transactionCurrency  = emvField('53', '986'); // BRL
  const transactionAmount    = emvField('54', valorFormatado);
  const countryCode          = emvField('58', 'BR');
  const merchantNameField    = emvField('59', removerAcentos(nome));
  const merchantCityField    = emvField('60', removerAcentos(cidade));

  const additionalDataField = emvField('05', txid);
  const additionalData      = emvField('62', additionalDataField);

  let payload =
    emvField('00', '01') +
    emvField('01', '12') + // Pix estático com valor definido
    merchantAccountInfo +
    merchantCategoryCode +
    transactionCurrency +
    transactionAmount +
    countryCode +
    merchantNameField +
    merchantCityField +
    additionalData +
    '6304';

  const crc = crc16(payload);
  return payload + crc;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'Método não permitido.' });
  }

  try {
    const { valor, email, primeiro_nome, ultimo_nome, cpf, materia, produto } = req.body || {};

    if (!valor || !email) {
      return res.status(400).json({ error: true, message: 'Dados obrigatórios faltando (valor, email).' });
    }

    const txid = gerarTxid();
    const descricaoCurta = (produto || materia || 'OAB 2 FASE').toString();

    const payload = gerarPayloadPix({
      chave: PIX_KEY,
      nome: MERCHANT_NAME,
      cidade: MERCHANT_CITY,
      valor: valor,
      txid: txid,
      descricao: descricaoCurta,
    });

    const qrCodeBase64 = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 360,
    });
    // Remover o prefixo "data:image/png;base64," pois o frontend já adiciona
    const qrCodeBase64Clean = qrCodeBase64.replace(/^data:image\/png;base64,/, '');

    return res.status(200).json({
      id: txid,
      status: 'pending',
      point_of_interaction: {
        transaction_data: {
          qr_code: payload,
          qr_code_base64: qrCodeBase64Clean,
        },
      },
      metadata: {
        email,
        primeiro_nome,
        ultimo_nome,
        cpf,
        materia: materia || null,
        valor,
      },
    });
  } catch (err) {
    console.error('Erro ao gerar Pix:', err);
    return res.status(500).json({ error: true, message: 'Erro interno ao gerar o Pix.' });
  }
};
