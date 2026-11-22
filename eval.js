// 用法：node eval.js <data.jsonl> [--noise] [--fails] [--json out.json]
const fs = require('fs');
const P = require('./parser.js');
const args = process.argv.slice(2);
const file = args[0], NOISE = args.includes('--noise'), FAILS = args.includes('--fails');
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const items = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
const KEYS = P.FIELD_KEYS;

// 模擬語音辨識雜訊：去標點、簡體、數字改中文、插入語助詞。答案不變。
const CNUM = '零一二三四五六七八九';
function numToCn(n) {
  n = +n; if (n < 10) return CNUM[n];
  if (n < 100) return (Math.floor(n / 10) === 1 ? '' : CNUM[Math.floor(n / 10)]) + '十' + (n % 10 ? CNUM[n % 10] : '');
  const h = Math.floor(n / 100), r = n % 100;
  return CNUM[h] + '百' + (r === 0 ? '' : r < 10 ? '零' + CNUM[r] : numToCn(r).replace(/^十/, '一十'));
}
function noisy(t, seed) {
  let s = t;
  if (seed % 2 === 0) s = s.replace(/[，。,、；;！!？?]/g, '');
  if (seed % 3 === 0) s = P.toSimp(s);
  s = s.replace(/(\d+)\.(\d)/g, (m, a, b) => numToCn(a) + '點' + CNUM[+b]).replace(/(\d{2,3})\s*\/\s*(\d{2,3})/g, (m, a, b) => numToCn(a) + numToCn(b)).replace(/\d{2,3}/g, m => numToCn(m));
  if (seed % 4 === 1) s = s.replace(/，/g, '，嗯').replace(/^/, '那個');
  return s;
}

const per = {}; KEYS.forEach(k => per[k] = { n: 0, ok: 0, nM: 0, okM: 0, fp: 0 });
let recN = 0, recOk = 0, itemOk = 0; const fails = []; const byStyle = {};
items.forEach((it, idx) => {
  const text = NOISE ? noisy(it.text, idx) : it.text;
  const out = P.parseAll(text).records;
  let allOk = out.length === it.records.length;
  const st = byStyle[it.style] = byStyle[it.style] || { n: 0, ok: 0 };
  it.records.forEach(g => {
    recN++;
    const p = out.find(r => r.case === g.case) || {};
    let rOk = true;
    KEYS.forEach(k => {
      const gv = String(g[k] ?? ''), pv = String(p[k] ?? '');
      const eq = k === 'temp' || k === 'pulse' ? (gv === '' ? pv === '' : +gv === +pv) : gv === pv;
      per[k].n++; if (eq) per[k].ok++;
      if (gv !== '') { per[k].nM++; if (eq) per[k].okM++; } else if (pv !== '') per[k].fp++;
      st.n++; if (eq) st.ok++;
      if (!eq) { rOk = false; fails.push({ id: it.id, style: it.style, field: k, gold: gv, pred: pv, text }); }
    });
    if (rOk) recOk++; else allOk = false;
  });
  if (allOk) itemOk++;
});
const tot = KEYS.reduce((a, k) => a + per[k].n, 0), totOk = KEYS.reduce((a, k) => a + per[k].ok, 0);
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '-';
console.log(`檔案 ${file}${NOISE ? '（加語音雜訊）' : ''}：${items.length} 句、${recN} 筆個案紀錄`);
console.log(`欄位整體正確率 ${pct(totOk, tot)}（錯誤率 ${pct(tot - totOk, tot)}）；整筆全對 ${pct(recOk, recN)}；整句全對 ${pct(itemOk, items.length)}`);
console.log('欄位            全部正確率  有講到時正確率  無中生有');
KEYS.forEach(k => console.log(`${k.padEnd(15)} ${pct(per[k].ok, per[k].n).padStart(8)}   ${pct(per[k].okM, per[k].nM).padStart(8)} (${per[k].nM})   ${per[k].fp}`));
console.log('依句型：' + Object.entries(byStyle).map(([s, v]) => `${s} ${pct(v.ok, v.n)}`).join('、'));
if (FAILS) fails.forEach(f => console.log(`✗ ${f.id} [${f.style}] ${f.field}: 答案「${f.gold}」 解析「${f.pred}」  ${f.text}`));
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ file, noise: NOISE, items: items.length, records: recN, fieldAcc: totOk / tot, recordAcc: recOk / recN, itemAcc: itemOk / items.length, per, byStyle }, null, 1));
