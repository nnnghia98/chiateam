const QRCode = require('qrcode');

const VIETQR_GUID = 'A000000727';
const VIETQR_SERVICE = 'QRIBFTTA';
const TRANSFER_NOTE_LIMIT = 25;

function normalizeText(value, limit = TRANSFER_NOTE_LIMIT) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Đđ]/g, match => (match === 'đ' ? 'd' : 'D'))
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)
    .trim();
}

function createTlv(id, value) {
  const text = String(value);
  const length = Buffer.byteLength(text, 'ascii');

  if (!/^\d{2}$/.test(id) || length > 99) {
    throw new TypeError('VietQR field is invalid.');
  }

  return `${id}${String(length).padStart(2, '0')}${text}`;
}

function createCrc16(text) {
  let crc = 0xffff;

  for (const character of text) {
    crc ^= character.charCodeAt(0) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function getVietQrSettings(env = process.env) {
  const bankBin = String(env.PAYMENT_BANK_BIN ?? '').trim();
  const accountNumber = String(env.PAYMENT_ACCOUNT_NUMBER ?? '').trim();
  const accountName = normalizeText(env.PAYMENT_ACCOUNT_NAME, 25);
  const bankName = normalizeText(env.PAYMENT_BANK_NAME, 40);

  if (!accountNumber) {
    return { ok: false, reason: 'missing' };
  }

  if (!/^\d{6}$/.test(bankBin) || !/^[A-Za-z0-9]{1,19}$/.test(accountNumber)) {
    return { ok: false, reason: 'invalid' };
  }

  return {
    ok: true,
    bankBin,
    bankName,
    accountNumber,
    accountName,
  };
}

function createTransferNote(playerName, playerIndex, date = new Date()) {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = type => dateParts.find(item => item.type === type)?.value || '';
  const dateCode = `${part('year')}${part('month')}${part('day')}`;
  const playerCode = normalizeText(playerName, 13).replace(/ /g, '');
  const sequence = String(playerIndex + 1).padStart(2, '0');
  const prefix = `CT${dateCode}${sequence}`;

  return normalizeText(`${prefix} ${playerCode}`, TRANSFER_NOTE_LIMIT);
}

function createVietQrPayload({
  bankBin,
  accountNumber,
  accountName,
  amount,
  transferNote,
}) {
  const cleanBankBin = String(bankBin ?? '').trim();
  const cleanAccountNumber = String(accountNumber ?? '').trim();
  const cleanAmount = Number(amount);
  const cleanNote = normalizeText(transferNote);
  const cleanAccountName = normalizeText(accountName, 25);

  if (!/^\d{6}$/.test(cleanBankBin)) {
    throw new TypeError('PAYMENT_BANK_BIN must contain six digits.');
  }

  if (!/^[A-Za-z0-9]{1,19}$/.test(cleanAccountNumber)) {
    throw new TypeError(
      'PAYMENT_ACCOUNT_NUMBER must contain 1 to 19 letters or digits.'
    );
  }

  if (
    !Number.isSafeInteger(cleanAmount) ||
    cleanAmount <= 0 ||
    String(cleanAmount).length > 13
  ) {
    throw new TypeError('VietQR amount must be a positive integer.');
  }

  if (!cleanNote || cleanNote.length > TRANSFER_NOTE_LIMIT) {
    throw new TypeError(
      'VietQR transfer note must contain 1 to 25 basic letters or digits.'
    );
  }

  const beneficiary =
    createTlv('00', cleanBankBin) + createTlv('01', cleanAccountNumber);
  const merchantAccount =
    createTlv('00', VIETQR_GUID) +
    createTlv('01', beneficiary) +
    createTlv('02', VIETQR_SERVICE);
  const additionalData = createTlv('08', cleanNote);
  const fields = [
    createTlv('00', '01'),
    createTlv('01', '12'),
    createTlv('38', merchantAccount),
    createTlv('52', '0000'),
    createTlv('53', '704'),
    createTlv('54', cleanAmount),
    createTlv('58', 'VN'),
    ...(cleanAccountName ? [createTlv('59', cleanAccountName)] : []),
    createTlv('62', additionalData),
  ];
  const payloadWithoutCrc = `${fields.join('')}6304`;

  return `${payloadWithoutCrc}${createCrc16(payloadWithoutCrc)}`;
}

async function createVietQrPng({ settings, amount, transferNote }) {
  const payload = createVietQrPayload({
    ...settings,
    amount,
    transferNote,
  });

  return QRCode.toBuffer(payload, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 420,
  });
}

module.exports = {
  createTransferNote,
  createVietQrPayload,
  createVietQrPng,
  getVietQrSettings,
  normalizeText,
};
