const path    = require('path');
const fs      = require('fs');
const vm      = require('vm');
const https   = require('https');
const KEIRIN_DIR = __dirname;

// ── HTTP GET helper ──────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

// ── DOM/browser stubs ────────────────────────────────────────
const logs = [];
const consoleSpy = {
  log:   (...a) => logs.push(a.join(' ')),
  error: (...a) => logs.push('[ERROR] ' + a.join(' ')),
  warn:  (...a) => logs.push('[WARN] '  + a.join(' ')),
};
const elStub = {
  value: '', innerHTML: '', innerText: '', checked: false, style: {},
  getAttribute: () => null, querySelector: () => elStub,
  querySelectorAll: () => [], dispatchEvent: () => {},
  insertAdjacentHTML: () => {}, remove: () => {}, forEach: () => {},
};
const documentStub = {
  getElementById: () => elStub,
  querySelector: () => null,
  querySelectorAll: () => ({ forEach: () => {} }),
  addEventListener: () => {},
};
const windowStub = { scrollBy: () => {}, scrollTo: () => {}, open: () => {} };
const appStub = { logMessage: () => {}, sendLog: () => {} };

// ── keirin_logic.js をvm内にロード ───────────────────────────
let src = fs.readFileSync(path.join(KEIRIN_DIR, 'keirin_logic.js'), 'utf8');
src = src
  .replace(/^\(function\(app\)\s*\{/, '')
  .replace(/\}\)\(App\);\s*$/, '')
  .replace(/app\.logMessage\(/g, 'console.log(');

// BANK_DATA・関数をコンテキスト経由で取得するため事前にグローバルとして確保
const sharedState = { BANK_DATA: {}, getPlayerData: null, parseLineInput: null, runScenarioSimulation: null };
const ctx = vm.createContext({
  app: appStub, App: appStub,
  require,
  __dirname: KEIRIN_DIR,
  document: documentStub,
  window: windowStub,
  alert: () => {},
  console: consoleSpy,
  setTimeout: () => {},
  clearTimeout: () => {},
  module: {},
  __shared: sharedState,
});

// let変数はctxに露出しないため、ロード後にexportスニペットで取り出す
vm.runInContext(src, ctx);
vm.runInContext(`
  __shared.BANK_DATA             = BANK_DATA;
  __shared.getPlayerData         = getPlayerData;
  __shared.parseLineInput        = parseLineInput;
  __shared.runScenarioSimulation = runScenarioSimulation;
`, ctx);

// ── メインテスト ─────────────────────────────────────────────
(async () => {
  console.log('\n=== TEST 1: loadBANK_DATA ===');
  const loadLog = logs.find(l => l.includes('SUCCESS'));
  console.log(loadLog ? `  PASS: ${loadLog}` : '  FAIL: SUCCESSログなし');

  console.log('\n=== TEST 2: /race + /weather → runScenarioSimulation ===');

  const [raceData, weatherData] = await Promise.all([
    httpGet('https://keirin-proxy-ii.onrender.com/race?raceId=2420260401010001'),
    httpGet('https://keirin-proxy-ii.onrender.com/weather?venue=%F0%9F%A5%9F%E5%AE%87%E9%83%BD%E5%AE%AE'),
  ]);

  console.log(`  venue  : ${raceData.venue}`);
  console.log(`  series : ${raceData.series}`);
  console.log(`  riders : ${raceData.riders.length}人`);
  console.log(`  wind   : ${weatherData.windDirection} ${weatherData.windSpeed}m`);

  // riders → getPlayerData 引数形式に変換
  const playerDataArray = raceData.riders
    .filter(r => !r.isScratched)
    .map((r, i) => ({
      id:         r.number,
      score:      r.score,
      style:      r.styleRaw,
      wmark:      '',
      recent:     r.recent || '',
      is_s1:      i === 0,
      is_b1:      false,
      is_scratch: r.isScratched,
    }));

  // lineFormation → lineInput文字列に変換
  const lineInput = raceData.lineFormation.lines
    .map(l => l.members.join(''))
    .join(',');

  const bankName    = raceData.venue;
  const windSpeed   = weatherData.windSpeed;
  const windDir     = weatherData.windDirection;
  const BANK_DATA    = sharedState.BANK_DATA;
  const selectedBank = BANK_DATA[bankName];

  if (!selectedBank) {
    console.log(`  WARN: BANK_DATA に "${bankName}" が見つかりません`);
    console.log('  利用可能なバンク例:', Object.keys(BANK_DATA).slice(0, 3).join(', '));
    return;
  }

  const getPlayerData         = sharedState.getPlayerData;
  const parseLineInput        = sharedState.parseLineInput;
  const runScenarioSimulation = sharedState.runScenarioSimulation;

  const basePlayers = getPlayerData(playerDataArray);
  const { lines, orderedPlayerIds, allSeriInfos, displayLineSegments } =
    parseLineInput(lineInput, basePlayers);

  const settings = { IS_GIRLS: raceData.series === 'ガールズ' };

  console.log(`\n  lineInput : ${lineInput}`);
  console.log(`  players   : ${basePlayers.map(p => `#${p.id}(${p.style}${p.score})`).join(' ')}`);

  const seitenResult = runScenarioSimulation(
    basePlayers, allSeriInfos, settings, selectedBank,
    false, lineInput, windSpeed, windDir, lines
  );
  const koutenResult = runScenarioSimulation(
    basePlayers, allSeriInfos, settings, selectedBank,
    true, lineInput, windSpeed, windDir, lines
  );

  console.log('\n  ── 晴天令スコア（降順）──');
  const seitenRanking = Object.entries(seitenResult.integratedScores)
    .sort((a, b) => b[1] - a[1]);
  seitenRanking.forEach(([id, score], i) => {
    const p = basePlayers.find(p => p.id === Number(id));
    console.log(`  ${i+1}位 #${id}(${p ? p.style : '?'}) score=${score.toFixed(2)}`);
  });

  console.log('\n  ── 荒天令スコア（降順）──');
  const koutenRanking = Object.entries(koutenResult.integratedScores)
    .sort((a, b) => b[1] - a[1]);
  koutenRanking.forEach(([id, score], i) => {
    const p = basePlayers.find(p => p.id === Number(id));
    console.log(`  ${i+1}位 #${id}(${p ? p.style : '?'}) score=${score.toFixed(2)}`);
  });

  console.log('\n=== ALL TESTS DONE ===');
})();
