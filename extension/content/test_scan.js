// test_scan.js — self-check cho PHONE_RE trong content.js (run: node test_scan.js)
// Mirror của regex + logic normalize ở api/src/routes/check.ts

const PHONE_RE = /(?<!\d)(?:\+84|0)[35789]\d{8}\b/g;

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('84')) return '0' + digits.slice(2).replace(/^0/, '');
  return digits;
}

const cases = [
  ['Gọi 0359998887 ngay', ['0359998887'], '0359998887'],
  ['+84901234567 hotline', ['+84901234567'], '0901234567'],
  ['840359998887', [], null],            // 84 without + → not scanned (VN mobile written without + is always 0-prefix)
  ['id 10359998887', [], null],          // preceded by digit → skip
  ['landline 0241234567', [], null],     // 02xx → skip
  ['order #0901234567 ok', ['0901234567'], '0901234567'],
  ['hai số 0901234567 và 0988777666', ['0901234567', '0988777666'], '0901234567'],
  ['số quá ngắn 090123456', [], null],
];

let failed = 0;
for (const [text, wantScan, wantNorm] of cases) {
  PHONE_RE.lastIndex = 0;
  const got = [...text.matchAll(PHONE_RE)].map(m => m[0]);
  if (JSON.stringify(got) !== JSON.stringify(wantScan)) {
    console.error('SCAN FAIL:', text, '→ got', got, 'want', wantScan);
    failed++;
  }
  if (got.length && normalizePhone(got[0]) !== wantNorm) {
    console.error('NORM FAIL:', got[0], '→', normalizePhone(got[0]), 'want', wantNorm);
    failed++;
  }
}

if (failed) { console.error(`${failed} FAILURES`); process.exit(1); }
console.log('ALL PASS');
