const path = require('path');
const fs   = require('fs');
const vm   = require('vm');

const { scrapeRace } = require('./scraper');
const { getWeather } = require('./weather');

// ── keirin_logic.js をvm内にロード（モジュール起動時に1回だけ実行）─────
const KEIRIN_DIR = __dirname;

const elStub = {
  value: '', innerHTML: '', innerText: '', checked: false, style: {},
  getAttribute: () => null, querySelector: () => elStub,
  querySelectorAll: () => [], dispatchEvent: () => {},
  insertAdjacentHTML: () => {}, remove: () => {}, forEach: () => {},
};
const documentStub = {
  getElementById: () => elStub,
  querySelector:  () => null,
  querySelectorAll: () => ({ forEach: () => {} }),
  addEventListener: () => {},
};
const windowStub = { scrollBy: () => {}, scrollTo: () => {}, open: () => {} };
const appStub    = { logMessage: () => {}, sendLog: () => {} };

const sharedState = {
  BANK_DATA: {}, getPlayerData: null, parseLineInput: null, runScenarioSimulation: null,
};

const logicSrc = fs.readFileSync(path.join(KEIRIN_DIR, 'keirin_logic.js'), 'utf8')
  .replace(/^\(function\(app\)\s*\{/, '')
  .replace(/\}\)\(App\);\s*$/, '')
  .replace(/app\.logMessage\(/g, '(() => {}) (');  // ログ抑制

const ctx = vm.createContext({
  app: appStub, App: appStub,
  require,
  __dirname: KEIRIN_DIR,
  document: documentStub,
  window:   windowStub,
  alert:    () => {},
  console:  { log: () => {}, error: () => {}, warn: () => {} },
  setTimeout: () => {}, clearTimeout: () => {},
  module: {},
  __shared: sharedState,
});

vm.runInContext(logicSrc, ctx);
vm.runInContext(`
  __shared.BANK_DATA             = BANK_DATA;
  __shared.getPlayerData         = getPlayerData;
  __shared.parseLineInput        = parseLineInput;
  __shared.runScenarioSimulation = runScenarioSimulation;
`, ctx);

// ── predict(raceId) ──────────────────────────────────────────────────────────
async function predict(raceId) {
  // ① レースデータ取得
  const raceData = await scrapeRace(raceId);
  const { venue, series, riders, lineFormation } = raceData;

  // ② 気象データ取得（null時フォールバック）
  const weather = await getWeather(venue);
  const windSpeed     = weather.windSpeed     ?? 0;
  const windDirection = weather.windDirection ?? '北';

  // ③ ロジック呼び出し
  const { BANK_DATA, getPlayerData, parseLineInput, runScenarioSimulation } = sharedState;
  const selectedBank = BANK_DATA[venue];

  const playerDataArray = riders
    .filter(r => !r.isScratched)
    .map((r, i) => ({
      id:         r.number,
      score:      r.score,
      style:      r.styleRaw,
      wmark:      '',
      recent:     r.recent || '',
      is_s1:      i === 0,
      is_b1:      false,
      is_scratch: false,
    }));

  const lineInput = lineFormation.lines.map(l => l.members.join('')).join(',');
  const basePlayers = getPlayerData(playerDataArray);
  const { lines, allSeriInfos } = parseLineInput(lineInput, basePlayers);
  const settings = { IS_GIRLS: series === 'ガールズ' };

  const seitenResult = runScenarioSimulation(
    basePlayers, allSeriInfos, settings, selectedBank,
    false, lineInput, windSpeed, windDirection, lines
  );
  const koutenResult = runScenarioSimulation(
    basePlayers, allSeriInfos, settings, selectedBank,
    true, lineInput, windSpeed, windDirection, lines
  );

  const toRanking = (integratedScores) =>
    Object.entries(integratedScores)
      .sort((a, b) => b[1] - a[1])
      .map(([id, score], rank) => {
        const p = basePlayers.find(p => p.id === Number(id));
        return { rank: rank + 1, id: Number(id), style: p ? p.style : '', score: Math.round(score * 100) / 100 };
      });

  // ④ 返却
  return {
    raceId,
    venue,
    series,
    lineFormation,
    windSpeed,
    windDirection,
    bankFound: !!selectedBank,
    results: {
      seiten: toRanking(seitenResult.integratedScores),
      kouten: toRanking(koutenResult.integratedScores),
    },
  };
}

module.exports = { predict };
