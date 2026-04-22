const path = require('path');
const fs   = require('fs');
const vm   = require('vm');

const { scrapeRace } = require('./scraper');
const { getWeather } = require('./weather');

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
  BANK_DATA: {},
  getPlayerData: null,
  parseLineInput: null,
  runScenarioSimulation: null,
  generateSeitenreiBets: null,
  generateKoutenreiBets: null,
  calculateTenunIndex: null,
  currentWindSpeed: 0,
};

function loadSrc(filename) {
  return fs.readFileSync(path.join(KEIRIN_DIR, filename), 'utf8')
    .replace(/^\(function\(app\)\s*\{/, '')
    .replace(/\}\)\(App\);\s*$/, '')
    .replace(/app\.logMessage\(/g, '(() => {}) (');
}

const ctx = vm.createContext({
  app: appStub, App: appStub,
  require,
  __dirname: KEIRIN_DIR,
  document: documentStub,
  window:   windowStub,
  alert:    () => {},
  console:  { log: () => {}, error: () => {}, warn: () => {} },
  setTimeout, clearTimeout, setInterval, clearInterval,
  Promise,
  module: {},
  __shared: sharedState,
});

vm.runInContext(loadSrc('keirin_logic.js'), ctx);
vm.runInContext(loadSrc('tamaki_speech.js'), ctx);
vm.runInContext(loadSrc('shakkou_donperi_core.js'), ctx);

vm.runInContext(`
  __shared.BANK_DATA             = BANK_DATA;
  __shared.getPlayerData         = getPlayerData;
  __shared.parseLineInput        = parseLineInput;
  __shared.runScenarioSimulation = runScenarioSimulation;
  __shared.generateSeitenreiBets = generateSeitenreiBets;
  __shared.generateKoutenreiBets = generateKoutenreiBets;
  __shared.calculateTenunIndex   = calculateTenunIndex;
`, ctx);

const SERIES_TO_GRADE = {
  'ガールズ': 'girls',
  'S級':      's-kyu',
  'A級':      'a-kyu',
  'A級チャレンジ': 'a-challenge',
};

async function predict(raceId) {
  const raceData = await scrapeRace(raceId);
  const { venue, series, riders, lineFormation } = raceData;

  const weather = await getWeather(venue);
  const windSpeed     = weather.windSpeed     ?? 0;
  const windDirection = weather.windDirection ?? '北';

  const {
    BANK_DATA, getPlayerData, parseLineInput, runScenarioSimulation,
    generateSeitenreiBets, generateKoutenreiBets, calculateTenunIndex,
  } = sharedState;

  sharedState.currentWindSpeed = windSpeed;

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

  const lineInput = (lineFormation.lines || []).map(l => (l.members || []).join('')).join(',');
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

  const toRankingRich = (integratedScores) =>
    Object.entries(integratedScores)
      .sort((a, b) => b[1] - a[1])
      .map(([id, score], rank) => {
        const p = basePlayers.find(p => p.id === Number(id));
        return {
          rank:        rank + 1,
          id:          Number(id),
          style:       p ? p.style : '',
          score:       Math.round(score * 100) / 100,
          final_score: score,
          is_b1:       p ? (p.is_b1 || false) : false,
          is_s1:       p ? (p.is_s1 || false) : false,
          wmark:       p ? (p.wmark || '')    : '',
        };
      });

  const seitenRanking = toRankingRich(seitenResult.integratedScores);
  const koutenRanking = toRankingRich(koutenResult.integratedScores);

  const tenunData = calculateTenunIndex(
    seitenResult.integratedScores,
    koutenResult.integratedScores,
    seitenResult.allScenarioResults,
    basePlayers
  );

  const seitenTop3Ids = new Set((tenunData.rankingWithData || []).slice(0, 3).map(p => p.id));
  const seitenBets = generateSeitenreiBets(tenunData.rankingWithData);
  const koutenBets = generateKoutenreiBets(tenunData.koutenRankingWithData, seitenTop3Ids);

  let shakkouResult = null;
  if (typeof appStub.invokeShakkouDonperi === 'function') {
    const gradeKey = SERIES_TO_GRADE[series] || 'a-kyu';
    const shakkouContext = {
      grade:         gradeKey,
      seriInfos:     allSeriInfos,
      lineInput,
      windSpeed,
      windDirection,
      isGirls:       settings.IS_GIRLS || false,
      BANK_DATA:     selectedBank,
    };
    shakkouResult = await appStub.invokeShakkouDonperi(basePlayers, shakkouContext);
  }

  return {
    raceId,
    venue,
    series,
    lineFormation,
    windSpeed,
    windDirection,
    bankFound: !!selectedBank,
    results: {
      seiten:     seitenRanking.map(({ rank, id, style, score }) => ({ rank, id, style, score })),
      kouten:     koutenRanking.map(({ rank, id, style, score }) => ({ rank, id, style, score })),
      seitenBets,
      koutenBets,
      tenun: {
        index:   tenunData.tenunIndex,
        message: tenunData.message,
        ichiyo: {
          activated: tenunData.targetPlayerId !== null && tenunData.targetPlayerId !== undefined,
          playerId:  tenunData.targetPlayerId ?? null,
        },
      },
      shakkou: shakkouResult,
    },
  };
}

module.exports = { predict };
