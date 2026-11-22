/* 日照語音紀錄 v3 — 介面 */
(function () {
'use strict';
const P = window.DayParser, $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const LS = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('這台裝置無法儲存資料'); } }
};
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2000); }
function status(id, m, err) { const s = $(id); s.textContent = m || ''; s.classList.toggle('err', !!err); }
// 需要按兩次才執行（避免誤刪，也不跳出系統對話框）
function twoTap(btn, fn) { btn.onclick = () => { if (btn._armed) { btn._armed = false; btn.textContent = btn._txt; fn(); return; } btn._txt = btn.textContent; btn._armed = true; btn.textContent = '再按一次確認'; setTimeout(() => { if (btn._armed) { btn._armed = false; btn.textContent = btn._txt; } }, 3000); }; }

/* ---------- 分頁 ---------- */
document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + b.dataset.tab));
  if (b.dataset.tab === 'list') renderList();
  window.scrollTo(0, 0);
});

/* ---------- 語音 ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function pickAlt(r) {
  let best = r[0].transcript, bs = -1;
  for (let i = 0; i < r.length; i++) {
    const t = r[i].transcript; let s = 0;
    P.parseAll(t).records.forEach(x => { s += x.case ? 3 : 0; P.FIELD_KEYS.forEach(k => { if (k !== 'case' && x[k]) s++; }); });
    if (s > bs) { bs = s; best = t; }
  }
  return best;
}
const Speech = {
  active: null,
  start(opt) {
    if (!SR) { opt.onStatus('這個瀏覽器不支援語音辨識，請改用手機 Chrome／Safari，或直接打字', true); return; }
    if (this.active) { if (this.active.opt.btn === opt.btn) this.stop(); else opt.onStatus('請先結束目前的錄音', true); return; }
    const st = { opt, keep: !!opt.continuous, quiet: 0, rec: null }; this.active = st;
    opt.onBegin && opt.onBegin();
    const go = () => {
      const r = new SR(); st.rec = r; r.lang = 'zh-TW'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 3;
      r.onresult = e => {
        let im = '';
        for (let i = e.resultIndex; i < e.results.length; i++) { const x = e.results[i]; if (x.isFinal) { st.quiet = 0; opt.onFinal(pickAlt(x)); } else im += x[0].transcript; }
        opt.onInterim(im ? '聽到：' + P.toTrad(im) : '');
      };
      r.onerror = ev => {
        const er = ev.error;
        if (er === 'not-allowed' || er === 'service-not-allowed') { st.keep = false; opt.onStatus('麥克風被封鎖：請點網址列左側圖示 → 麥克風改成「允許」，再重新整理', true); }
        else if (er === 'network') { st.keep = false; opt.onStatus('網路不穩：語音辨識需要連網', true); }
        else if (er === 'audio-capture') { st.keep = false; opt.onStatus('找不到麥克風', true); }
        else if (er === 'no-speech') { st.quiet++; if (st.quiet >= 3) { st.keep = false; opt.onStatus('一段時間沒聽到聲音，已自動停止'); } }
      };
      r.onend = () => { st.rec = null; if (st.keep && this.active === st) { try { go(); } catch (e) { this.finish(st); } } else this.finish(st); };
      try { r.start(); } catch (e) { this.finish(st); opt.onStatus('無法啟動錄音：' + e.message, true); }
    };
    go();
  },
  stop() { const st = this.active; if (!st) return; st.keep = false; try { if (st.rec) st.rec.stop(); else this.finish(st); } catch (e) { this.finish(st); } },
  finish(st) { if (this.active !== st) return; this.active = null; st.opt.onInterim(''); st.opt.onEnd(); }
};
function micBtn(btn, on, idle) { btn.classList.toggle('rec', on); btn.textContent = on ? (btn.classList.contains('fm') ? '⏹' : '⏹ 講完了，停止') : idle; }
function appendTxt(ta, t) { t = P.normalize(t).trim(); if (!t) return; ta.value += (ta.value && !/[，。,\s]$/.test(ta.value) ? '，' : '') + t; }

/* ---------- 欄位定義與檢查 ---------- */
const FIELDS = [
  { k: 'temp', l: '體溫', type: 'num', ph: '例 36.8' },
  { k: 'bp', l: '血壓', type: 'text', ph: '例 130/80' },
  { k: 'pulse', l: '脈搏', type: 'num', ph: '次／分' },
  { k: 'meal', l: '飲食', type: 'cat', opts: ['全部', '大部分', '一半', '少量', '未進食'], tk: 'mealText' },
  { k: 'med', l: '服藥', type: 'cat', opts: ['已服', '未服'], tk: 'medText' },
  { k: 'toilet', l: '如廁', type: 'toilet', tk: 'toiletText' },
  { k: 'act', l: '活動', type: 'cat', opts: ['參加', '未參加'], tk: 'actText' },
  { k: 'incident', l: '跌倒意外', type: 'cat', opts: ['無', '有'], tk: 'incidentText' },
  { k: 'note', l: '備註', type: 'text', ph: '' }
];
function warns(r) {
  const w = {};
  if (!r.case) w.case = ['必填：請選擇個案', 'bad']; else if (r.caseFuzzy) w.case = ['依讀音推測，請確認是不是這位', 'soft'];
  if (!r.temp) w.temp = ['必填', 'bad']; else if (isNaN(r.temp) || +r.temp < 34 || +r.temp > 42) w.temp = ['數值不合理', 'bad']; else if (+r.temp >= 37.5) w.temp = ['發燒，請通報護理人員', 'soft'];
  if (r.bp) { const [a, b] = String(r.bp).split('/').map(Number); if (!b || a > 260 || a < 70 || b > 160 || b < 35 || a <= b) w.bp = ['格式請用 130/80', 'bad']; else if (a >= 160 || b >= 100) w.bp = ['血壓偏高，請通報', 'soft']; }
  if (r.pulse && (isNaN(r.pulse) || +r.pulse < 35 || +r.pulse > 180)) w.pulse = ['數值不合理', 'bad'];
  if (!r.meal) w.meal = ['必填', 'bad'];
  if (!r.med) w.med = ['必填', 'bad']; else if (r.med === '未服') w.med = ['未服藥，請交班', 'soft'];
  if (!r.incident) w.incident = ['必填', 'bad']; else if (r.incident === '有') w.incident = ['需另填意外事件紀錄表', 'soft'];
  return w;
}
const hasBad = r => Object.values(warns(r)).some(x => x[1] === 'bad');

/* ---------- 日常紀錄 ---------- */
let recs = [], seq = 1;
const blank = () => ({ id: seq++, case: '', caseFuzzy: false, temp: '', bp: '', pulse: '', meal: '', mealText: '', med: '', medText: '', toilet_count: '', toilet_assist: '', toiletText: '', act: '', actText: '', incident: '', incidentText: '', note: '' });
function sel(k, opts, v) { return `<select data-k="${k}"><option value="">—</option>${opts.map(o => `<option${o === v ? ' selected' : ''}>${o}</option>`).join('')}</select>`; }
function cardHTML(r) {
  const w = warns(r);
  const wl = k => w[k] ? `<div class="w ${w[k][1] === 'soft' ? 'soft' : ''}" data-w="${k}">${w[k][1] === 'soft' ? '⚠ ' : ''}${esc(w[k][0])}</div>` : `<div class="w" data-w="${k}"></div>`;
  let h = `<div class="rec-card${Object.keys(w).length ? ' warn' : ''}" data-id="${r.id}">
    <div class="rec-head">${sel('case', P.CASES, r.case)}<button class="fm" data-mic="case" style="flex:0 0 46px">🎤</button><button class="gray" data-del style="flex:0 0 auto;padding:10px 12px">✕</button></div>${wl('case').replace('class="w', 'style="margin-bottom:4px" class="w')}`;
  FIELDS.forEach(f => {
    let ctl;
    if (f.type === 'cat') ctl = sel(f.k, f.opts, r[f.k]) + `<input data-k="${f.tk}" value="${esc(r[f.tk])}" placeholder="說明（可不填）">`;
    else if (f.type === 'toilet') ctl = `<input data-k="toilet_count" inputmode="numeric" value="${esc(r.toilet_count)}" placeholder="次數">` + sel('toilet_assist', ['需協助', '自行'], r.toilet_assist);
    else ctl = `<input data-k="${f.k}" value="${esc(r[f.k])}" placeholder="${f.ph}"${f.type === 'num' ? ' inputmode="decimal"' : ''}>`;
    const bad = w[f.k] && w[f.k][1] === 'bad';
    h += `<div class="f${bad ? ' bad' : ''}" data-f="${f.k}"><label>${f.l}</label><div class="ctl">${ctl}</div><button class="fm" data-mic="${f.k}">🎤</button>${wl(f.k)}</div>`;
  });
  return h + `<div class="row" style="margin-top:8px"><button data-save>✅ 存檔這位</button></div></div>`;
}
function renderCards() {
  if (!recs.length) recs.push(blank());
  $('recCards').innerHTML = recs.map(cardHTML).join('');
}
function refreshWarn(card, r) {
  const w = warns(r);
  card.classList.toggle('warn', Object.keys(w).length > 0);
  card.querySelectorAll('[data-w]').forEach(el => {
    const k = el.dataset.w, x = w[k];
    el.className = 'w' + (x && x[1] === 'soft' ? ' soft' : ''); el.textContent = x ? (x[1] === 'soft' ? '⚠ ' : '') + x[0] : '';
    const row = card.querySelector(`[data-f="${k}"]`); if (row) row.classList.toggle('bad', !!(x && x[1] === 'bad'));
  });
}
const recOf = el => { const card = el.closest('.rec-card'); return card ? [card, recs.find(r => r.id === +card.dataset.id)] : [null, null]; };
$('recCards').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; const [card, r] = recOf(e.target); r[k] = e.target.value; if (k === 'case') r.caseFuzzy = false; refreshWarn(card, r); });
$('recCards').addEventListener('change', e => { const k = e.target.dataset.k; if (!k) return; const [card, r] = recOf(e.target); r[k] = e.target.value; if (k === 'case') r.caseFuzzy = false; refreshWarn(card, r); });
$('recCards').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const [card, r] = recOf(b); if (!r) return;
  if (b.hasAttribute('data-del')) { recs = recs.filter(x => x !== r); renderCards(); return; }
  if (b.hasAttribute('data-save')) { saveRecs([r]); return; }
  const k = b.dataset.mic; if (!k) return;
  let buf = '';
  const label = k === 'case' ? '個案' : FIELDS.find(f => f.k === k).l;
  Speech.start({
    btn: b, continuous: false,
    onBegin: () => { micBtn(b, true, '🎤'); status('recStatus', `請說「${label}」`); },
    onFinal: t => { buf += t; }, onInterim: t => $('recInterim').textContent = t,
    onStatus: (m, err) => status('recStatus', m, err),
    onEnd: () => {
      micBtn(b, false, '🎤');
      if (!buf) { status('recStatus', '沒聽到內容，請再按一次 🎤'); return; }
      const got = P.parseField(k, buf); let filled = [];
      Object.keys(got).forEach(key => { if (got[key] !== '' && got[key] !== undefined && key in r) { r[key] = got[key]; if (!/Text$|Fuzzy$/.test(key)) filled.push(got[key]); } });
      if (k === 'case') r.caseFuzzy = !!got.caseFuzzy;
      card.outerHTML = cardHTML(r);
      status('recStatus', filled.length ? `「${label}」已補上：${filled.join('、')}（聽到：${P.normalize(buf)}）` : `「${label}」沒聽懂：${P.normalize(buf)}，請再講一次或直接改`, !filled.length);
    }
  });
});
function doParse() {
  const txt = $('recTxt').value; if (!txt.trim()) { status('recStatus', '請先錄音或打字', true); return; }
  const out = P.parseAll(txt); $('recTxt').value = out.text;
  recs = out.records.map(x => Object.assign(blank(), x));
  renderCards();
  const n = recs.length, bad = recs.filter(hasBad).length;
  status('recStatus', `解析出 ${n} 位長輩` + (bad ? `，有 ${bad} 位還缺必填項目（紅色）` : '，請確認後存檔'));
  if (window.innerWidth < 900) $('recCards').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$('recParse').onclick = doParse;
$('recClear').onclick = () => { $('recTxt').value = ''; recs = []; renderCards(); status('recStatus', ''); };
$('recMic').onclick = function () {
  const b = this;
  Speech.start({
    btn: b, continuous: true,
    onBegin: () => { micBtn(b, true, '🎤 開始錄音'); status('recStatus', '錄音中…可以分段講，講完按「停止」'); },
    onFinal: t => appendTxt($('recTxt'), t), onInterim: t => $('recInterim').textContent = t,
    onStatus: (m, err) => status('recStatus', m, err),
    onEnd: () => { micBtn(b, false, '🎤 開始錄音'); if ($('recTxt').value.trim()) doParse(); }
  });
};
function saveRecs(list) {
  const ok = list.filter(r => !hasBad(r)), bad = list.length - ok.length;
  if (!ok.length) { toast('還有紅色必填項目，請補齊後再存'); renderCards(); return; }
  const all = LS.get('dv3_records', []), now = new Date().toISOString();
  ok.forEach(r => { const o = { time: now }; ['case', 'temp', 'bp', 'pulse', 'meal', 'mealText', 'med', 'medText', 'toilet_count', 'toilet_assist', 'toiletText', 'act', 'actText', 'incident', 'incidentText', 'note'].forEach(k => o[k] = r[k] || ''); all.push(o); });
  LS.set('dv3_records', all);
  recs = recs.filter(r => !ok.includes(r));
  if (!recs.length) $('recTxt').value = '';
  renderCards();
  toast(`已存 ${ok.length} 筆` + (bad ? `，${bad} 筆還缺資料` : ''));
}
$('recSaveAll').onclick = () => saveRecs(recs.slice());

/* ---------- 已存紀錄 ---------- */
const COLS = [['time', '時間'], ['case', '個案'], ['temp', '體溫'], ['bp', '血壓'], ['pulse', '脈搏'], ['meal', '飲食'], ['med', '服藥'], ['toilet_count', '如廁次數'], ['toilet_assist', '如廁協助'], ['act', '活動'], ['incident', '意外'], ['incidentText', '意外說明'], ['note', '備註']];
const fmtTime = iso => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function renderList() {
  const all = LS.get('dv3_records', []), today = new Date().toDateString();
  $('todayChips').innerHTML = P.CASES.map(c => { const done = all.some(r => r.case === c && new Date(r.time).toDateString() === today); return `<span class="chip${done ? '' : ' r'}">${done ? '✓' : '❗'} ${c}</span>`; }).join('');
  $('listTable').innerHTML = `<tr>${COLS.map(c => `<th>${c[1]}</th>`).join('')}</tr>` + (all.length ? all.slice().reverse().map(r => `<tr>${COLS.map(([k]) => `<td>${esc(k === 'time' ? fmtTime(r.time) : r[k] || '-')}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${COLS.length}">還沒有紀錄</td></tr>`);
}
function downloadCSV(name, rows) {
  const csv = '﻿' + rows.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
$('listExport').onclick = () => { const all = LS.get('dv3_records', []); if (!all.length) return toast('沒有紀錄可匯出'); downloadCSV('日照紀錄.csv', [COLS.map(c => c[1])].concat(all.map(r => COLS.map(([k]) => k === 'time' ? fmtTime(r.time) : r[k])))); };
twoTap($('listClear'), () => { LS.set('dv3_records', []); renderList(); toast('已清空'); });

/* ---------- 操演練習 ---------- */
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[rnd(0, a.length - 1)];
const pickW = a => { let s = a.reduce((x, y) => x + y[1], 0), r = Math.random() * s; for (const [v, w] of a) { if ((r -= w) < 0) return v; } return a[0][0]; };
let level = 'basic', scn = null;
const KEYS_BASIC = ['case', 'temp', 'meal', 'med', 'incident'];
const LABEL = { case: '個案', temp: '體溫', bp: '血壓', pulse: '脈搏', meal: '飲食', med: '服藥', toilet_count: '如廁次數', toilet_assist: '如廁協助', act: '活動', incident: '跌倒意外' };
const MEAL_SHOW = { '全部': '全部吃完', '大部分': '約八成', '一半': '約一半', '少量': '只吃幾口', '未進食': '沒有吃' };
function newScenario() {
  const fever = Math.random() < 0.15, hi = Math.random() < 0.15;
  const s = {
    case: pick(P.CASES),
    temp: (fever ? 37.5 + rnd(0, 12) / 10 : 36 + rnd(0, 12) / 10).toFixed(1),
    bp: (hi ? rnd(160, 180) : rnd(105, 145)) + '/' + (hi ? rnd(90, 100) : rnd(62, 88)),
    pulse: String(rnd(60, 98)),
    meal: pickW([['全部', 3], ['大部分', 2], ['一半', 2], ['少量', 2], ['未進食', 1]]),
    med: Math.random() < 0.8 ? '已服' : '未服',
    toilet_count: String(rnd(1, 4)), toilet_assist: Math.random() < 0.5 ? '需協助' : '自行',
    act: Math.random() < 0.75 ? '參加' : '未參加',
    incident: Math.random() < 0.85 ? '無' : '有'
  };
  s.mealName = pick(['早餐', '午餐', '點心']); s.medTime = pick(['8 點', '10 點', '12 點半', '下午 2 點']);
  s.actName = pick(['手工課', '唱歌', '健康操', '桌遊', '懷舊課', '復健運動']); s.actWhy = pick(['在休息', '不想參加', '在睡覺']);
  s.incName = pick(['吃飯時嗆到', '走路時滑倒', '起身時跌坐地上', '手臂撞到桌角']);
  s.medWhy = pick(['拒絕服藥', '藥吐出來', '還沒吃']);
  s.keys = level === 'basic' ? KEYS_BASIC : P.FIELD_KEYS.slice();
  return s;
}
function showScenario() {
  const s = scn, K = s.keys, L = [];
  L.push(`<div class="who">👵 ${s.case}</div>`);
  if (K.includes('temp')) L.push(`<b>體溫</b>${s.temp} °C${+s.temp >= 37.5 ? '（偏高）' : ''}`);
  if (K.includes('bp')) L.push(`<b>血壓</b>${s.bp}`);
  if (K.includes('pulse')) L.push(`<b>脈搏</b>${s.pulse} 下／分`);
  if (K.includes('meal')) L.push(`<b>${s.mealName}</b>${MEAL_SHOW[s.meal]}`);
  if (K.includes('med')) L.push(`<b>服藥</b>${s.med === '已服' ? s.medTime + ' 已服' : '未服（' + s.medWhy + '）'}`);
  if (K.includes('toilet_count')) L.push(`<b>如廁</b>${s.toilet_count} 次，${s.toilet_assist === '需協助' ? '需要協助' : '自己去'}`);
  if (K.includes('act')) L.push(`<b>活動</b>${s.act === '參加' ? '有參加' + s.actName : '沒參加（' + s.actWhy + '）'}`);
  if (K.includes('incident')) L.push(`<b>意外</b>${s.incident === '無' ? '無（今天平安）' : s.incName}`);
  $('drillScn').innerHTML = L[0] + L.slice(1).join('<br>');
  $('drillTxt').value = ''; $('drillResultCard').style.display = 'none'; status('drillStatus', '');
}
function same(k, a, b) { a = String(a || ''); b = String(b || ''); return (k === 'temp' || k === 'pulse') && a && b ? +a === +b : a === b; }
function grade() {
  const txt = $('drillTxt').value; if (!txt.trim()) { status('drillStatus', '請先作答（講或打字）', true); return; }
  const out = P.parseAll(txt); const got = out.records.find(r => r.case === scn.case) || out.records[0] || {};
  const ok = {}; let n = 0;
  scn.keys.forEach(k => { ok[k] = same(k, scn[k], got[k]); if (ok[k]) n++; });
  const score = Math.round(100 * n / scn.keys.length);
  $('drillScore').textContent = score + ' 分';
  $('drillTable').innerHTML = `<tr><th>項目</th><th>正確答案</th><th>系統聽成</th><th></th></tr>` +
    scn.keys.map(k => `<tr><td>${LABEL[k]}</td><td>${esc(scn[k])}</td><td>${esc(got[k] || '（沒抓到）')}</td><td class="${ok[k] ? 'ok' : 'ng'}">${ok[k] ? '✓' : '✗'}</td></tr>`).join('') +
    `<tr><td>辨識文字</td><td colspan="3" style="color:#5b6b67">${esc(out.text)}</td></tr>`;
  $('drillResultCard').style.display = '';
  const log = LS.get('dv3_drill', []);
  const exp = {}, par = {}; scn.keys.forEach(k => { exp[k] = scn[k]; par[k] = got[k] || ''; });
  log.push({ time: new Date().toISOString(), level, score, text: out.text, exp, par, ok });
  LS.set('dv3_drill', log.slice(-500)); renderStats();
  status('drillStatus', score === 100 ? '全對！按「下一題」繼續' : '看看哪一項沒抓到，可以換個說法再講一次，或按「下一題」');
  if (window.innerWidth < 900) $('drillResultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderStats() {
  const log = LS.get('dv3_drill', []);
  if (!log.length) { $('drillStats').textContent = '還沒有作答紀錄。'; return; }
  const avg = Math.round(log.reduce((a, x) => a + x.score, 0) / log.length);
  const per = {}; log.forEach(x => Object.keys(x.ok).forEach(k => { per[k] = per[k] || [0, 0]; per[k][1]++; if (x.ok[k]) per[k][0]++; }));
  const tot = Object.values(per).reduce((a, v) => [a[0] + v[0], a[1] + v[1]], [0, 0]);
  $('drillStats').innerHTML = `已練習 <b>${log.length}</b> 題，平均 <b>${avg}</b> 分；欄位正確率 <b>${(100 * tot[0] / tot[1]).toFixed(1)}%</b>` +
    `<div class="chips">${Object.keys(LABEL).filter(k => per[k]).map(k => { const p = 100 * per[k][0] / per[k][1]; return `<span class="chip${p < 90 ? ' r' : ''}">${LABEL[k]} ${p.toFixed(0)}%</span>`; }).join('')}</div>`;
}
$('drillLevel').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; level = b.dataset.v; $('drillLevel').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); scn = newScenario(); showScenario(); });
$('drillNext').onclick = () => { scn = newScenario(); showScenario(); window.scrollTo(0, 0); };
$('drillGrade').onclick = grade;
$('drillMic').onclick = function () {
  const b = this;
  Speech.start({
    btn: b, continuous: true,
    onBegin: () => { micBtn(b, true, '🎤 開始作答'); $('drillTxt').value = ''; status('drillStatus', '作答中…講完按「停止」'); },
    onFinal: t => appendTxt($('drillTxt'), t), onInterim: t => $('drillInterim').textContent = t,
    onStatus: (m, err) => status('drillStatus', m, err),
    onEnd: () => { micBtn(b, false, '🎤 開始作答'); if ($('drillTxt').value.trim()) grade(); }
  });
};
$('drillExport').onclick = () => {
  const log = LS.get('dv3_drill', []); if (!log.length) return toast('沒有練習結果可匯出');
  const K = P.FIELD_KEYS;
  downloadCSV('操演結果.csv', [['時間', '難度', '分數', '辨識文字'].concat(K.flatMap(k => [LABEL[k] + '答案', LABEL[k] + '解析']))]
    .concat(log.map(x => [fmtTime(x.time), x.level === 'basic' ? '基本' : '完整', x.score, x.text].concat(K.flatMap(k => [x.exp[k] || '', x.par[k] || ''])))));
};
twoTap($('drillReset'), () => { LS.set('dv3_drill', []); renderStats(); toast('已清空統計'); });

/* ---------- 啟動 ---------- */
if (!SR) ['recMic', 'drillMic'].forEach(id => { $(id).textContent = '⚠ 此瀏覽器不支援語音，請直接打字'; $(id).disabled = true; });
renderCards(); scn = newScenario(); showScenario(); renderStats();
})();
