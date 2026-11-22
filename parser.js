/* 日照語音紀錄 v3 — 自然語言解析引擎（瀏覽器與 Node 共用） */
(function (G) {
'use strict';

const CASES = ['王美玉', '林阿土', '陳秀英', '張金水'];
const HONOR = '(?:老先生|老太太|老太|阿嬤|阿媽|阿公|奶奶|爺爺|伯伯|阿伯|伯|阿姨|姨|婆婆|先生|小姐|太太|叔叔|叔|媽媽|爸爸|姐姐|姐|姊姊|姊|大哥|大姐|哥)';

/* ---------- 簡繁 ---------- */
const PAIRS = '体體温溫压壓药藥厕廁没沒点點课課参參协協饭飯陈陳张張伤傷呛嗆无無换換两兩时時后後动動发發烧燒缩縮个個给給头頭晕暈气氣说說觉覺记記录錄运運门門诊診医醫护護这這们們过過乐樂么麼间間还還报報吗嗎钟鐘脚腳顿頓泻瀉肿腫剂劑针針测測复復习習画畫戏戲讲講话話听聽读讀写寫团團级級视視检檢转轉帮幫厅廳边邊坠墜状狀况況绪緒稳穩应應该該鸡雞鱼魚汤湯饮飲进進净淨几幾仅僅尽盡处處车車来來买買东東问問题題亲親属屬联聯络絡疗療识識认認练練节節数數计計乱亂闹鬧顺順惯慣扫掃尝嘗摄攝对對错錯刚剛搀攙带帶脉脈饱飽盘盤绝絕准準与與游遊怀懷旧舊园園艺藝绘繪龄齡独獨经經着著干乾实實际際现現嬷嬤爷爺妈媽鸭鴨让讓请請谁誰样樣会會儿兒从從为為里裡异異常常厂廠场場桌桌开開关關红紅纸紙织織带帶齐齊胆膽脏髒';
const S2T = {}, T2S = {};
for (let i = 0; i + 1 < PAIRS.length; i += 2) { if (PAIRS[i] !== PAIRS[i + 1]) { S2T[PAIRS[i]] = PAIRS[i + 1]; if (!T2S[PAIRS[i + 1]]) T2S[PAIRS[i + 1]] = PAIRS[i]; } }
const toTrad = s => s.replace(/[一-鿿]/g, c => S2T[c] || c);
const toSimp = s => s.replace(/[一-鿿]/g, c => T2S[c] || c);

/* ---------- 中文數字 ---------- */
const CN = { '零': 0, '〇': 0, '一': 1, '二': 2, '兩': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
const isD = c => c !== undefined && CN[c] !== undefined;
function parseRun(m) {
  const parts = m.split('點'), ip = parts[0], dp = parts[1], out = []; let i = 0;
  while (i < ip.length) {
    let v = 0, got = false;
    if (isD(ip[i]) && ip[i + 1] === '百') {
      v += CN[ip[i]] * 100; i += 2; got = true;
      if (ip[i] === '零' || ip[i] === '〇') { i++; if (isD(ip[i]) && ip[i + 1] !== '十') { v += CN[ip[i]]; i++; out.push(v); continue; } }
      else if (isD(ip[i]) && (i + 1 >= ip.length || isD(ip[i + 1]))) { v += CN[ip[i]] * 10; i++; out.push(v); continue; } // 一百三＝130
    }
    if (isD(ip[i]) && ip[i + 1] === '十') { v += CN[ip[i]] * 10; i += 2; got = true; }
    else if (ip[i] === '十') { v += 10; i++; got = true; }
    if (isD(ip[i]) && ip[i + 1] !== '十' && ip[i + 1] !== '百') { v += CN[ip[i]]; i++; got = true; }
    if (!got) { i++; continue; }
    out.push(v);
  }
  if (dp !== undefined && out.length) out[out.length - 1] = out[out.length - 1] + '.' + [...dp].map(c => CN[c]).join('');
  return out;
}
function cnNums(s) {
  s = s.replace(/兩(?=[個位人次碗趟口天成杯包片顆隻三])/g, '\u0001');
  return s.replace(/[零〇一二兩三四五六七八九十百]+(?:點[零〇一二三四五六七八九]+)?/g, m => {
    if (!/[十百]/.test(m) && !/點[零〇一二三四五六七八九]/.test(m)) return m; // 一半、兩次 不轉
    const n = parseRun(m); return n.length ? n.join(' ') : m;
  }).replace(/\u0001/g, '兩');
}
const cnDigit = s => (/^\d+$/.test(s) ? +s : (s === '十' ? 10 : (CN[s] !== undefined ? CN[s] : NaN)));

/* ---------- 正規化 ---------- */
function normalize(t) {
  t = toTrad(String(t || ''));
  t = t.replace(/[○◯Ｏ]/g, '〇');
  t = t.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 65248)).replace(/．/g, '.').replace(/／/g, '/');
  t = t.replace(/[嗯呃欸]+/g, '');
  // 護理速記：T 37.3、BP 166/98、P 92、HR 64、×3
  t = t.replace(/(?<![A-Za-z])BP\s*[:：]?\s*/g, '血壓').replace(/(?<![A-Za-z])HR\s*[:：]?\s*/g, '心跳')
       .replace(/(?<![A-Za-z])T\s*[:：]?\s*(?=[\d一二三四五六七八九十])/g, '體溫').replace(/(?<![A-Za-z])P\s*[:：]?\s*(?=[\d一二三四五六七八九十])/g, '脈搏')
       .replace(/[×xX]\s*(\d+)/g, '$1次');
  // 台語用字
  t = t.replace(/攏無/g, '都沒').replace(/攏/g, '都').replace(/呷/g, '吃').replace(/家己/g, '自己').replace(/跋(?:倒|落)/g, '跌倒')
       .replace(/落去/g, '下去').replace(/便所/g, '廁所').replace(/([一兩二三四五六七八九十\d])擺/g, '$1次');
  // 語音辨識常見同音錯字（只在照護情境中修正）
  t = t.replace(/(吃|服|給|用|餵)要/g, '$1藥')
       .replace(/要(?=(?:也|都|還|就)?(?:有|都有|已經|已|還沒|沒有|沒)(?:吃|服|吞)|吃(?:了|過|完)|服)/g, '藥')
       .replace(/跌到/g, '跌倒').replace(/滑到/g, '滑倒').replace(/摔到(?![頭手腳])/g, '摔倒')
       .replace(/(?:雪|血|穴|謝)(?:壓|鴨|押)/g, '血壓')
       .replace(/(?:題|提|體|替)(?:溫|文|聞)/g, '體溫')
       .replace(/如(?:測|側|策)/g, '如廁').replace(/(?:脈|麥|賣|脉)(?:博|膊|播|搏)/g, '脈搏')
       .replace(/(藥[^，,。\s]{0,4})持(?=了|過|完)/g, '$1吃').replace(/鞋助|協住/g, '協助').replace(/餐加/g, '參加')
       .replace(/爹倒|爹到/g, '跌倒').replace(/五餐/g, '午餐').replace(/大部份/g, '大部分')
       .replace(/槍到/g, '嗆到').replace(/尿步/g, '尿布');
  t = t.replace(/卡拉\s*ok/gi, '卡拉OK').replace(/℃/g, '度');
  // 血壓逐字連念：「血壓一四八九二」→ 148 92
  t = t.replace(/(血壓|上壓|高壓|收縮壓)([^零〇一二三四五六七八九\d]{0,3})([零〇一二三四五六七八九]{4,6})(?![零〇一二三四五六七八九十百])/g, (m, k, g, d) => { const n = [...d].map(c => CN[c]).join(''), cut = n.length === 4 ? 2 : 3; return k + g + n.slice(0, cut) + ' ' + n.slice(cut); });
  // 逐字念的數字：三六點七、一四二 八八、一二八、七八
  t = t.replace(/(^|[^第零〇一二三四五六七八九十百兩])([零〇一二三四五六七八九]{2,3})(?![零〇一二三四五六七八九十百兩成分次口個天趟位碗號樓])/g, (m, p, d) => p + [...d].map(c => CN[c]).join(''));
  t = cnNums(t);
  t = t.replace(/(\d)\s*點\s*([零〇一二三四五六七八九])(?![零〇一二三四五六七八九十點分])/g, (m, a, b) => a + '.' + CN[b]);
  t = t.replace(/(\d{2})\s*度\s*半/g, '$1.5');
  t = t.replace(/(\d{2})\s*度\s*([0-9零〇一二三四五六七八九])(?![\d十點分次])/g, (m, a, b) => a + '.' + (isD(b) ? CN[b] : b));
  t = t.replace(/(\d)\s*點\s*(\d)(?![\d點分])/g, '$1.$2').replace(/(\d)\s*\.\s*(\d)/g, '$1.$2');
  return t;
}

/* ---------- 欄位錨點 ---------- */
const TIME = '(?:(?:早上|上午|中午|下午|傍晚|晚上|剛剛|剛才)?(?:[\\d一二兩三四五六七八九十]{1,3}點(?:半|\\d{1,2}分?)?)?)';
const NEG = '(?:都沒有|並沒有|沒有|沒|無|未|不)';
const INC = '(?:跌倒|摔倒|摔跤|跌跤|跌坐|滑倒|絆倒|絆到|嗆到|嗆咳|噎到|噎住|受傷|撞到|撞傷|碰到(?:頭|手|腳|桌|牆|門|膝)|碰傷|擦傷|割傷|燙傷|滑下來|滑落|跌落|摔落|坐到地上|摔下來|掉下來|腫(?:了|一個包|包)|瘀青|破皮|流血|意外|嗆|跌|摔)';
const ANCH = {
  temp: '(?:量體溫|體溫|溫度|額溫|耳溫|發燒|燒到)',
  bp: '(?:量血壓|血壓|收縮壓|舒張壓|高壓|低壓|上壓|下壓)',
  pulse: '(?:脈搏|心跳|心率|心臟跳|心搏|脈動|心律|脈)',
  meal: TIME + '(?:的)?(?:(?:沒有?|未)(?:吃)?)?(?:早餐|午餐|中餐|晚餐|點心|早飯|午飯|中飯|晚飯|吃飯|用餐|進食|食量|胃口|飯量|便當|吃了?[半一兩三幾\\d]*碗|(?:就|只|有|才)?(?:扒|吃|喝)了?(?:[幾一兩三半]+(?:口|湯匙|匙)|一點點?|一些|半碗|一碗|兩碗)飯?|(?:扒|吃)了?(?:一半|大部分|大半|[七八九]成|幾口|很少|一點)|中午(?=[^，,。]{0,3}(?:吃|飯|扒|喝|一口|整|碗|只|就))|午間|午膳|膳食|食慾|吃東西|進餐|飯菜|粥|飯)',
  med: TIME + '(?:的)?(?:都|也|還)?(?:有|已經|已|沒有|沒|還沒)?(?:吃藥|服藥|給藥|用藥|吃過藥|餵藥|藥(?:物)?(?:早上|中午|下午|晚上|飯後|\\d{1,2}點半?)?(?:就|都|也|有|已經|還沒|沒有?)?(?:吃|服|吞)|藥)',
  toilet: TIME + '(?:可|能)?(?:協助|幫忙|扶著?|自行|自己|有|沒有|都)?(?:去|上了?|跑了?|走去|換了?|幫他換了?|幫她換了?)?(?:[\\d一兩二三四五六七八九十]+(?:次|趟|回))?(?:如廁|上廁所|去廁所|廁所|大便|小便|排便|排尿|尿尿|尿布|尿褲|解便|便便|大號|小號|小解|大解|解手)',
  act: TIME + '(?:都|也|還|今天)?(?:有|沒有|沒|未參|未|缺席|不想|不肯|不願意|不要|不)?(?:下去|去|來)?(?:做|玩|跳|唱|看|上|跟)?(?:參加|參與|活動(?![室區廳中空])|課程|上課|手工|手作|黏土|唱歌|卡拉OK|運動|復健(?![室區中])|體操|健康操|手指操|早操|桌遊|團體|做操|律動|畫畫|繪畫|美術|書法|烹飪|陶藝|音樂|下棋|團康|懷舊|園藝|讀報|繪本|電影|欣賞|慶生|烘焙|體適能|遊戲|賓果|畫圖|課(?![本業]))(?!時|的時候)',
  incident: '(?:(?:早上|上午|中午|下午|傍晚|晚上)?(?:吃飯|吃東西|喝水|喝湯|走路|上廁所|洗澡|起身|坐下|站起來)?(?:的時候|時)?)' + NEG + '?(?:任何|什麼)?' + INC,
  safe: '(?:一切平安|很平安|平安|沒事|一切正常|沒有異狀)'
};
const ANCH_RE = Object.keys(ANCH).map(k => [k, new RegExp(ANCH[k], 'g')]);
const POSTNEG = /^(?:[：:]\s*)?(?:無|沒有|沒|否|零)(?=[，,。；;、\s（(）)]|$)|^(?:[：:]\s*)?[（(]?(?:一切平安|平安)/;
const CORR = /(?:[啊喔噢哦]\s*不是|(?:^|[，,\s])不是(?=[，,\s])|不對|更正|糾正|講錯|說錯|口誤|看錯|搞錯|錯了|修正|重講|重來|刪掉|我是說|應該是|其實是|其實|等一下|等等|抱歉|念錯|唸錯|拿錯|弄錯|再確認|確認一下|重量|再量|重新量|複量|[啊喔]有啦|所以是|所以)/;

/* ---------- 各欄位擷取 ---------- */
function exTemp(s) {
  const m = s.match(/(?:^|[^\d.])((?:3[3-9]|4[0-3])(?:\.\d)?)(?![\d])/);
  return m ? m[1] : '';
}
function okBP(a, b) { a = +a; b = +b; return a >= 70 && a <= 260 && b >= 35 && b <= 160 && a > b; }
function exBP(s) {
  let m = s.match(/(?:高壓|收縮壓|上面)\D{0,4}(\d{2,3}).{0,10}?(?:低壓|舒張壓|下面)\D{0,4}(\d{2,3})/);
  if (m && okBP(m[1], m[2])) return m[1] + '/' + m[2];
  m = s.match(/(?:低壓|舒張壓|下面)\D{0,4}(\d{2,3}).{0,10}?(?:高壓|收縮壓|上面)\D{0,4}(\d{2,3})/);
  if (m && okBP(m[2], m[1])) return m[2] + '/' + m[1];
  m = s.match(/(\d{2,3})\s*(?:\/|對|比|-|～|~|,|，|、|的)?\s*(\d{2,3})(?!\d)/);
  if (m && okBP(m[1], m[2])) return m[1] + '/' + m[2];
  m = s.match(/(\d{2,3})\D{1,6}(\d{2,3})(?!\d)/);
  if (m && okBP(m[1], m[2])) return m[1] + '/' + m[2];
  return '';
}
function exPulse(s) { const m = s.match(/(?:^|\D)(\d{2,3})(?!\d|\.)/); return m && +m[1] >= 35 && +m[1] <= 180 ? m[1] : ''; }
function exMeal(s) {
  if (/一半|半碗|幾口|兩口|湯匙|[一二兩三四五六七八九]成|大部分|大半|一點|很少|吃完|全部|碗/.test(s)) s = s.replace(/(?:就|後來|然後|之後)?(?:不(?:想|肯|要)?吃了|不要了|沒(?:有)?再吃了?|吃不下了)/g, '');
  if (/百分之百/.test(s)) return '全部';
  const pct = s.match(/百分之\s*(\d{1,3})/);
  if (pct) { const n = +pct[1]; return n >= 90 ? '全部' : n >= 60 ? '大部分' : n >= 40 ? '一半' : n > 0 ? '少量' : '未進食'; }
  if (/剩(?:了|下)?(?:約)?(?:一點|一些|一口|兩口|一兩口|一二口|兩三口|一小|幾口|少許|[一二兩]成|一點菜)|吃得差不多|差不多吃光|大半碗|大半|[七八九]分(?!鐘)/.test(s)) return '大部分';
  if (/(?:一粒米|一點|一口)?都?不剩|吃光|精光|掃光|見底|碗底|乾乾淨淨|吃得?(?:很)?乾淨|續了?一碗|兩大碗|一整碗|全量|全數|用畢|用完|膳全|餐全|(?<![完安健])全(?=[。；;，,\s]|$)/.test(s) && !/沒(?:有)?吃光/.test(s)) return '全部';
  if (/差不多吃完|快吃完|幾乎吃完|剩沒多少|沒(?:有)?吃完/.test(s)) return '大部分';
  if (/一口都(?:沒|不)|一口(?:未|沒)|完全(?:沒|不|未)|根本(?:沒|不)|都沒(?:有)?吃|未進食|沒(?:有)?進食|拒(?:絕)?(?:吃|食|進食)|未動|沒碰|不碰|完全吃不下|都吃不下|空腹|禁食|整天沒|沒(?:有)?吃(?:午餐|早餐|晚餐|飯|中飯|午飯)/.test(s)) return '未進食';
  if (/剩(?:了|下)?一半|一半沒吃|一半|半碗|半份|半盤|半個|五成|二分之一/.test(s)) return '一半';
  if (/小半|很少|幾口|兩口|一口|幾湯匙|湯匙|幾下筷子|動了幾下|僅喝|一點點|一點|一些|不太吃|吃不太下|吃不下|吃不多|沒什麼吃|三分之一|兩三口|一兩口|少少|少量|只吃了?一點|(?<!差)不多|[一二兩]成|兩三成/.test(s)) return '少量';
  if (/大部分|大半|[七八九]成|七八成|八九成|三分之二|四分之三/.test(s)) return '大部分';
  if (/吃完|全部|吃光|光光|吃乾淨|整碗|整份|整盤|整個|都吃了|都有吃完|[兩三\d]碗|再添|添飯|吃很多|吃得很好|胃口很好|全吃|清盤|一碗/.test(s)) return '全部';
  if (/(?:完全|都|根本)(?:沒|不)|沒(?:有)?(?:吃|動)|不(?:肯|願意|想)?吃|拒吃|拒食|拒絕/.test(s)) return '未進食';
  return '';
}
function exMed(s) {
  if (/沒(?:有)?(?:吃|服|給|吞)|還沒|尚未|未服|沒服|拒(?:絕)?(?:吃|服)|拒服|不(?:肯|願意|想|要)?(?:吃|服|吞)|推開|無法服|無法吃|忘(?:了|記)|吐(?:掉|出|了)|漏(?:吃|服|掉)?/.test(s)) return '未服';
  if (/有吃|吃了|吃過|吃完|已(?:經)?(?:吃|服|給)|服(?:藥)?完|服用|有服|給(?:過|了)|吃藥|服藥|給藥|餵藥|用藥|按時|吃掉|服下|服畢|完畢|醫囑|給予|吃好了|吃下|藥\s*服(?![用藥])|^\s*服\s*[。，,]?$/.test(s)) return '已服';
  if (/吞(?:了|下|掉)|有吞/.test(s) || (/藥/.test(s) && /吃|服|吞/.test(s))) return '已服';
  return '';
}
function exToiletCount(s) {
  const m = s.match(/(\d+|[一兩二三四五六七八九十])\s*(?:次|趟|回)/) || s.match(/(?:如廁|廁所|尿布|小便|大便)\s*(?:自行|自己)?\s*(\d+|[一二兩三四五六七八九十])(?![\d.次])/);
  if (!m) return '';
  const n = cnDigit(m[1]); return isNaN(n) ? '' : String(n);
}
function exToiletAssist(s) {
  if (/自己|獨立|自行|不用(?:人)?(?:幫|扶|協助|陪)|不需要?(?:人)?(?:幫|扶|協助|陪|攙)|沒有?(?:人)?協助|不用人/.test(s)) return '自行';
  if (/協助|幫忙|幫他|幫她|扶|攙|牽|陪|帶他|帶她|帶去|推他|推她|需要人|要人|尿布|尿褲|幫.{0,2}換/.test(s)) return '需協助';
  return '';
}
function exAct(s) {
  if (/(?:也|都|就|說)不(?:要|想|肯|願意)(?!緊)|不(?:想|肯|要)(?:跳|玩|唱|畫|看)|沒(?:有)?(?:去|參加|參與|上|做|跟|動)|不(?:想|肯|願意|要)?(?:去|參加|參與|上|做|動)|未(?:參加|參與|參|出席|到)|沒(?:有)?下去|沒來|沒到|沒出現|不做|沒做|沒跟|在休息|休息沒|請假|在睡|睡覺沒|拒絕|缺席|沒興趣|沒參/.test(s)) return '未參加';
  if (new RegExp(ANCH.act).test(s) || /玩|做了/.test(s)) return '參加';
  return '';
}

/* ---------- 個案辨識（含敬稱、同音誤字） ---------- */
function findMentions(t) {
  const out = [];
  const add = (c, i, len, fuzzy) => { if (out.some(o => i < o.i + o.len && o.i < i + len)) return; out.push({ c, i, len, fuzzy }); };
  for (const c of CASES) { let i = -1; while ((i = t.indexOf(c, i + 1)) >= 0) add(c, i, 3, false); }
  for (const c of CASES) { const re = new RegExp(c.slice(1) + HONOR + '?', 'g'); let m; while ((m = re.exec(t))) add(c, m.index, m[0].length, false); }
  for (const c of CASES) { const re = new RegExp(c[0] + HONOR, 'g'); let m; while ((m = re.exec(t))) add(c, m.index, m[0].length, false); }
  // 土伯、水伯、阿玉姨、阿英：名字最後一字＋稱呼，或「阿」＋最後一字
  for (const c of CASES) { const re = new RegExp('(?:阿' + c[2] + HONOR + '?|' + c[2] + HONOR + ')', 'g'); let m; while ((m = re.exec(t))) add(c, m.index, m[0].length, false); }
  for (let i = 0; i + 3 <= t.length; i++) for (const c of CASES) {
    let s = 0; for (let j = 0; j < 3; j++) if (t[i + j] === c[j]) s++;
    if (s >= 2 && t[i] === c[0] && !/[\d\s，,。]/.test(t.substr(i, 3))) add(c, i, 3, true);
  }
  return out.sort((a, b) => a.i - b.i);
}

/* ---------- 切段 ---------- */
function segments(t) {
  const ms = [];
  for (const [k, re] of ANCH_RE) { re.lastIndex = 0; let m; while ((m = re.exec(t))) { if (!m[0]) { re.lastIndex++; continue; } ms.push({ f: k, s: m.index, e: m.index + m[0].length }); } }
  ms.sort((a, b) => a.s - b.s || (b.e - b.s) - (a.e - a.s));
  const kept = []; let lastEnd = -1;
  for (const m of ms) if (m.s >= lastEnd) { kept.push(m); lastEnd = m.e; }
  const segs = [];
  kept.forEach((m, i) => {
    const end = i + 1 < kept.length ? kept[i + 1].s : t.length;
    const text = t.slice(m.s, end);
    const prev = segs[segs.length - 1];
    if (prev && prev.f === m.f) prev.text += text; else segs.push({ f: m.f, text });
  });
  // 「午餐沒吃藥吐掉了」：沒有份量的餐段後面緊接「沒吃藥…」時，把「沒吃」還給飲食
  for (let i = 0; i + 1 < segs.length; i++) {
    const a = segs[i], b = segs[i + 1];
    if (a.f === 'meal' && b.f === 'med' && !exMeal(a.text)) {
      const m = b.text.match(/^(?:都|也|就|完全|根本)?(?:還沒有|還沒|沒有|沒)吃(?=藥)/);
      if (m && exMed(b.text.slice(m[0].length))) { a.text += m[0]; b.text = b.text.slice(m[0].length); }
    }
  }
  return segs;
}
const display = s => {
  const parts = s.split(CORR); let p = parts[parts.length - 1];
  if (!p.replace(/[，,。\s]/g, '')) p = parts[0];
  p = p.split(/[，。,、；;！!？?\n]/).filter(x => x.trim())[0] || '';
  return p.replace(/^(?:然後|還有|另外|而且|接著|再來|也|是)+/, '').replace(/(?:今天|然後|還有|另外|而且|那個|就是|接著|再來|的話|啦|喔|哦|啊|呢|吧)+$/, '').trim();
};
const NUMF = { temp: 1, bp: 1, pulse: 1, toilet: 1 };
function pick(segs, f, fn) {
  for (let i = segs.length - 1; i >= 0; i--) {
    if (segs[i].f !== f) continue;
    const parts = segs[i].text.split(CORR);
    for (let j = parts.length - 1; j >= 0; j--) {
      let cands = [parts[j]];
      if (parts.length > 1) {
        if (NUMF[f] && parts[j].includes('是')) cands = [parts[j].slice(parts[j].lastIndexOf('是') + 1), parts[j]];
        else if (!NUMF[f]) cands = parts[j].split(/[，,。；;]/).concat([parts[j]]);
      }
      for (const c of cands) { const v = fn(c); if (v) return { v, text: display(segs[i].text) }; }
    }
  }
  const any = segs.filter(x => x.f === f).pop();
  return { v: '', text: any ? display(any.text) : '' };
}
function incident(segs, full) {
  const ev = []; let m;
  const re = new RegExp(INC, 'g');
  while ((m = re.exec(full))) {
    const pre = full.slice(Math.max(0, m.index - 8), m.index).replace(/不小心|不慎|不注意|不留神/g, '').split(/[，,。；;、\s]|但|可是|不過|後來/).pop();
    ev.push({ i: m.index, neg: /沒|無|未|不/.test(pre) || POSTNEG.test(full.slice(m.index + m[0].length)), text: display(full.slice(Math.max(0, m.index - 12))) });
  }
  const cr = new RegExp(CORR.source, 'g'); while ((m = cr.exec(full))) ev.push({ i: m.index, corr: true });
  ev.sort((a, b) => a.i - b.i);
  let pos = null, neg = new RegExp(ANCH.safe).test(full);
  ev.forEach(e => { if (e.corr) pos = null; else if (e.neg) neg = true; else if (!pos) pos = e; });
  if (pos) return { v: '有', text: pos.text };
  return { v: neg ? '無' : '', text: neg ? '無' : '' };
}

/* ---------- 單一個案 ---------- */
function parseOne(t, mention) {
  const segs = segments(t);
  const r = { case: mention ? mention.c : '', caseFuzzy: !!(mention && mention.fuzzy) };
  let x;
  x = pick(segs, 'temp', exTemp); r.temp = x.v;
  const without = fs => segs.filter(g => !fs.includes(g.f)).map(g => g.text).join('，') + '，' + t.slice(0, Math.max(0, t.indexOf((segs[0] || {}).text || '\u0000')));
  if (!r.temp) { const u = without(['bp', 'pulse']); const m = u.match(/(?:^|[^\d.])((?:3[4-9]|4[0-2])\.\d)(?!\d)/) || u.match(/(?:^|[^\d.])((?:3[4-9]|4[0-2]))\s*度/); if (m) r.temp = m[1]; }
  x = pick(segs, 'bp', exBP); r.bp = x.v;
  if (!r.bp) { const u = without(['temp', 'pulse']); const m = u.match(/(?:^|[^\d.])(\d{2,3})\s*[\/對比、，,\s]\s*(\d{2,3})(?![\d.])/); if (m && okBP(m[1], m[2])) r.bp = m[1] + '/' + m[2]; }
  if (r.bp) {
    const bs = segs.filter(g => g.f === 'bp').pop(), parts = bs ? bs.text.split(CORR) : [];
    if (parts.length > 1) { const last = parts[parts.length - 1], nums = last.match(/\d{2,3}/g);
      if (!exBP(last) && nums && nums.length === 1) { const [a, b] = r.bp.split('/');
        if (/舒張|低壓|下壓|下面/.test(bs.text.slice(-last.length - 12)) && okBP(a, nums[0])) r.bp = a + '/' + nums[0];
        else if (/收縮|高壓|上壓|上面/.test(bs.text.slice(-last.length - 12)) && okBP(nums[0], b)) r.bp = nums[0] + '/' + b; } }
  }
  x = pick(segs, 'pulse', exPulse); r.pulse = x.v;
  x = pick(segs, 'meal', exMeal); r.meal = x.v; r.mealText = x.text;
  x = pick(segs, 'med', exMed); r.med = x.v; r.medText = x.text;
  x = pick(segs, 'toilet', exToiletCount); r.toilet_count = x.v; r.toiletText = x.text;
  r.toilet_assist = '';
  for (let i = segs.length - 1; i >= 0 && !r.toilet_assist; i--) if (segs[i].f === 'toilet') { const p = segs[i].text.split(CORR); r.toilet_assist = exToiletAssist(p[p.length - 1]) || exToiletAssist(segs[i].text); }
  x = pick(segs, 'act', exAct); r.act = x.v; r.actText = x.text;
  x = incident(segs, t); r.incident = x.v; r.incidentText = x.text;
  return r;
}

/* ---------- 主函式：可一次講多位 ---------- */
const GROUP = /兩個人|兩位|兩人|他們|她們|大家|二位|兩個(?![月天小禮星])/;
function parseAll(raw) {
  let t = normalize(raw);
  let shared = '';
  const allMs = findMentions(t);
  if (new Set(allMs.map(m => m.c)).size >= 2) {
    const clauses = t.split(/(?<=[。；;，,、！!？?\n])/);
    const strip = (x, cm) => { let b = x; cm.slice().sort((p, q) => q.i - p.i).forEach(m => { b = b.slice(0, m.i) + b.slice(m.i + m.len); }); return b.replace(/^[\s和跟與、還有]+/, ''); };
    let inGroup = false;
    t = clauses.map(cl => {
      const cm = findMentions(cl), n = new Set(cm.map(m => m.c)).size;
      if (n === 0) { if (GROUP.test(cl) || (inGroup && /^[^，,]*(?:也都|都有|都沒|也沒|也有|各)/.test(cl))) { inGroup = true; shared += '，' + cl; return '，'; } inGroup = false; return cl; }
      inGroup = false;
      // 「A和B都…」：名字並列開頭，共用到下一個名字出現為止
      const names = cm.map(m => cl.substr(m.i, m.len)).join('|');
      const jm = n >= 2 ? cl.match(new RegExp('^\\s*(?:那個|就是|然後|今天)?\\s*(?:' + names + ')(?:\\s*(?:和|跟|與|、|還有)\\s*(?:' + names + '))+')) : null;
      if (jm) {
        const after = cm.find(m => m.i >= jm[0].length), cut = after ? after.i : cl.length, head = cl.slice(0, cut);
        if (/都|也|一起|兩/.test(head)) { inGroup = true; shared += '，' + strip(head, cm.filter(m => m.i < cut)); return jm[0] + '，' + cl.slice(cut); }
      }
      // 「…兩個人都…」出現在最後一個名字之後：從那裡起共用
      const last = cm[cm.length - 1], g = cl.slice(last.i + last.len).search(GROUP);
      if (new Set(findMentions(t).map(m => m.c)).size >= 2 && g >= 0) { const at = last.i + last.len + g; shared += '，' + cl.slice(at); return cl.slice(0, at) + '，'; }
      return cl;
    }).join('');
  }
  {
    const names = [...new Set(findMentions(t).map(m => t.substr(m.i, m.len)))];
    if (names.length >= 2) {
      const N = names.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      const re = new RegExp('(體溫|血壓|心率|心跳|脈搏)(?:的話|呢|部分|都是|分別是?)?[，,\\s]*((?:(?:' + N + ')\\s*(?:是|為)?\\s*\\d[\\d.\\/\\s]*度?[，,、；;和跟]?\\s*){2,})', 'g');
      t = t.replace(re, (all, f, list) => list.replace(new RegExp('(' + N + ')\\s*(?:是|為)?\\s*(?=\\d)', 'g'), '$1' + f));
    }
  }
  // 「…這組是林阿土的」：前面整段改歸那一位
  {
    const names = [...new Set(findMentions(t).map(m => t.substr(m.i, m.len)))];
    if (names.length >= 2) {
      const N = names.join('|');
      const ra = t.match(new RegExp('(?:這|以上|剛剛|前面)(?:組|段|些|份|筆|張)?(?:資料|數據|紀錄|單子)?(?:全部|都)?(?:是|屬於)(' + N + ')的'));
      if (ra) {
        const head = t.slice(0, ra.index), cr = new RegExp(CORR.source, 'g'); let m, cut = ra.index;
        while ((m = cr.exec(head))) cut = m.index;
        const target = findMentions(ra[1])[0];
        const old = findMentions(head.slice(0, cut)).filter(x => x.c !== (target && target.c));
        if (target && old.length) {
          let body = head.slice(0, cut); old.slice().sort((a, b) => b.i - a.i).forEach(x => { body = body.slice(0, x.i) + ra[1] + body.slice(x.i + x.len); });
          const rest = t.slice(ra.index + ra[0].length).split(/(?<=[。；;，,！!？?\n])/).filter(cl => !findMentions(cl).length).join('');
          t = body + '，' + rest;
        }
      }
    }
  }
  // 省略項目的平行句：「陳秀英上了三次廁所，林阿土上了四次」→ 林阿土也是如廁
  {
    const CANON = { temp: '體溫', bp: '血壓', pulse: '脈搏', meal: '午餐', med: '藥', toilet: '如廁', act: '活動' };
    const cls = t.split(/(?<=[。；;，,、！!？?\n])/); let prev = null;
    t = cls.map(cl => {
      const cm = findMentions(cl), anc = segments(cl).filter(g => CANON[g.f]);
      let out = cl;
      if (cm.length && cm[0].i <= 2 && !anc.length && prev && prev.c !== cm[0].c && cl.slice(cm[0].i + cm[0].len).replace(/[，,。；;、\s]/g, '').length >= 2)
        out = cl.slice(0, cm[0].i + cm[0].len) + CANON[prev.f] + cl.slice(cm[0].i + cm[0].len);
      if (cm.length) { const a2 = segments(out).filter(g => CANON[g.f]); prev = a2.length ? { c: cm[0].c, f: a2[0].f } : null; }
      return out;
    }).join('');
  }
  let ms = findMentions(t);
  // 名字講錯更正：「林阿土，講錯了，是張金水」→ 只留後者
  ms = ms.filter((m, k) => { const n = ms[k + 1]; if (!n || n.c === m.c) return true; const gap = t.slice(m.i + m.len, n.i); return !(gap.length <= 12 && CORR.test(gap) && !ANCH_RE.some(([, re]) => new RegExp(re.source).test(gap))); });
  if (!ms.length) return { text: t, records: [parseOne(t, null)] };
  const order = [], parts = {};
  ms.forEach((m, k) => {
    const prev = k ? ms[k - 1] : null;
    if (prev && prev.c === m.c) return;
    let nextIdx = ms.findIndex((n, j) => j > k && n.c !== m.c);
    const start = k === 0 || !order.length ? 0 : m.i;
    const end = nextIdx < 0 ? t.length : ms[nextIdx].i;
    if (!parts[m.c]) { parts[m.c] = { text: '', mention: m }; order.push(m.c); }
    else if (!m.fuzzy) parts[m.c].mention = parts[m.c].mention.fuzzy ? m : parts[m.c].mention;
    parts[m.c].text += (parts[m.c].text ? '，' : '') + t.slice(start, end);
  });
  const recs = order.map(c => parseOne(parts[c].text + shared, parts[c].mention));
  if (recs.length > 1 && recs.some(r => r.act)) recs.forEach((r, k) => {
    if (r.act) return; const tx = parts[order[k]].text;
    if (/也(?:都)?(?:沒有?|未|不)(?:來|去|參加|參與|跟|做)/.test(tx)) r.act = '未參加';
    else if (/也(?:都)?(?:有)?(?:來|去|參加|參與|跟|做)/.test(tx)) r.act = '參加';
  });
  return { text: normalize(raw), records: recs };
}

/* ---------- 單一欄位補講 ---------- */
const FIELD_PREFIX = { temp: '體溫', bp: '血壓', pulse: '脈搏', meal: '午餐', med: '藥', toilet: '如廁', act: '活動', incident: '' };
function parseField(k, raw) {
  const t = normalize(raw);
  if (k === 'case') { const m = findMentions(t)[0]; return m ? { case: m.c, caseFuzzy: m.fuzzy } : { case: '' }; }
  if (k === 'incident') {
    if (/^(?:都沒有|沒有|沒|無|沒事|平安|正常|一切正常|一切平安)/.test(t) && !new RegExp('^(?:沒有|沒)?' + INC).test(t.replace(/^(?:都沒有|沒有|沒)/, '')) ) return { incident: '無', incidentText: '無' };
  }
  if (k === 'note') return { note: t };
  const r = parseOne((FIELD_PREFIX[k] || '') + t, null);
  if (k === 'incident' && !r.incident && t) { r.incident = '有'; r.incidentText = t; }
  return r;
}
const FIELD_KEYS = ['case', 'temp', 'bp', 'pulse', 'meal', 'med', 'toilet_count', 'toilet_assist', 'act', 'incident'];
const API = { CASES, FIELD_KEYS, normalize, parseAll, parseField, toSimp, toTrad, findMentions };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else G.DayParser = API;
})(typeof window !== 'undefined' ? window : this);
