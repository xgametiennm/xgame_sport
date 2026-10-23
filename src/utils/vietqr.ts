// VietQR (NAPAS 247) transfer codes, built locally from the bank account details.
//
// The payload follows the EMVCo merchant-presented QR format that Vietnamese banking apps
// read: each field is ID (2 digits) + length (2 digits) + value, and the code ends with a
// CRC16-CCITT checksum. Scanning it opens a transfer with the account, amount and
// description already filled in.

export interface VietQrBank {
  bin: string; // 6-digit NAPAS bank identifier
  name: string;
}

// Most used banks first; any other bank can be entered by its BIN
export const VIETQR_BANKS: VietQrBank[] = [
  { bin: '970436', name: 'Vietcombank' },
  { bin: '970415', name: 'VietinBank' },
  { bin: '970418', name: 'BIDV' },
  { bin: '970405', name: 'Agribank' },
  { bin: '970407', name: 'Techcombank' },
  { bin: '970422', name: 'MB Bank' },
  { bin: '970416', name: 'ACB' },
  { bin: '970432', name: 'VPBank' },
  { bin: '970423', name: 'TPBank' },
  { bin: '970403', name: 'Sacombank' },
  { bin: '970441', name: 'VIB' },
  { bin: '970437', name: 'HDBank' },
  { bin: '970443', name: 'SHB' },
  { bin: '970426', name: 'MSB' },
  { bin: '970448', name: 'OCB' },
  { bin: '970440', name: 'SeABank' },
  { bin: '970431', name: 'Eximbank' },
  { bin: '970449', name: 'LPBank' },
  { bin: '970428', name: 'Nam A Bank' },
  { bin: '970409', name: 'Bac A Bank' },
  { bin: '970425', name: 'ABBANK' },
  { bin: '970427', name: 'VietABank' },
  { bin: '970438', name: 'BaoViet Bank' },
  { bin: '970412', name: 'PVcomBank' },
  { bin: '970452', name: 'KienlongBank' },
  { bin: '970429', name: 'SCB' },
  { bin: '970433', name: 'Vietbank' },
  { bin: '970419', name: 'NCB' },
  { bin: '970454', name: 'BVBank (Bản Việt)' },
  { bin: '546034', name: 'CAKE by VPBank' },
  { bin: '546035', name: 'Ubank by VPBank' },
  { bin: '963388', name: 'Timo' },
];

const field = (id: string, value: string): string => `${id}${String(value.length).padStart(2, '0')}${value}`;

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as the EMVCo spec requires
function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Banks only accept plain ASCII in the description: "Nguyễn Văn An – Quỹ T11" becomes
 * "Nguyen Van An Quy T11". Kept to 50 characters (some apps show fewer).
 */
export function transferDescription(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50)
    .trim();
}

export function buildVietQrPayload({ bin, accountNo, amount, description }: {
  bin: string;
  accountNo: string;
  amount?: number;
  description?: string;
}): string {
  const beneficiary = field('00', bin) + field('01', accountNo);
  const merchant = field('00', 'A000000727') + field('01', beneficiary) + field('02', 'QRIBFTTA');
  const info = description ? transferDescription(description) : '';
  let payload =
    field('00', '01') +
    field('01', amount ? '12' : '11') + // 12: one-off code with an amount
    field('38', merchant) +
    field('53', '704') + // VND
    (amount ? field('54', String(Math.round(amount))) : '') +
    field('58', 'VN') +
    (info ? field('62', field('08', info)) : '');
  payload += '6304';
  return payload + crc16(payload);
}

export const bankNameOf = (bin: string): string => VIETQR_BANKS.find((b) => b.bin === bin)?.name || '';
