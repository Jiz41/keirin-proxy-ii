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
const raceTypeHolder = { value: 'a-kyu' };
const documentStub = {
  getElementById: (id) => id === 'race-type' ? raceTypeHolder : elStub,
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
  'A級チャレンジ': 'a-chal',
};

const STYLE_TO_BIAS_KEY = { '自': '先行', '逃': '先行', '両': '捲り', '追': '差し', '差': '差し' };

// styleRaw（スクレイパー生値）→ 内部短縮コードへの正規化マップ
const STYLE_NORM = {
  '逃':   '逃', '先行': '逃', '押え先': '逃',
  '自在': '自', '捲り': '自', 'まくり': '自', '捲': '自',
  '両':   '両',
  '追込': '追', '追':   '追', 'マーク': '追', 'マ': '追',
  '差':   '差', '差し': '差',
};

const COEFFICIENT_SETTINGS = {
  's-kyu':  { R_BIAS: 1.15, RECENT_WEIGHT: 0.90, COOP_WEIGHT: 1.20, IS_GIRLS: false, SUICIDE_LIMIT: 0.97 },
  'a-kyu':  { R_BIAS: 1.00, RECENT_WEIGHT: 1.00, COOP_WEIGHT: 1.00, IS_GIRLS: false, SUICIDE_LIMIT: 0.93 },
  'a-chal': { R_BIAS: 0.90, RECENT_WEIGHT: 1.20, COOP_WEIGHT: 0.80, IS_GIRLS: false, SUICIDE_LIMIT: 0.90 },
  'girls':  { R_BIAS: 1.00, RECENT_WEIGHT: 1.10, COOP_WEIGHT: 1.00, IS_GIRLS: true,  SUICIDE_LIMIT: 1.00 },
};

function applyLineCountBonus(integratedScores, lines) {
  const LINE_BONUS = { 4: 1.08, 3: 1.04 };
  const bonusMap = {};
  (lines || []).forEach(line => {
    const bonus = LINE_BONUS[line.length] || 1.00;
    line.forEach(id => { bonusMap[id] = bonus; });
  });
  const result = {};
  Object.keys(integratedScores).forEach(id => {
    result[id] = integratedScores[id] * (bonusMap[Number(id)] || 1.00);
  });
  return result;
}

async function predict(raceId) {
  const raceData = await scrapeRace(raceId);
  const { venue, series, riders, lineFormation, raceName } = raceData;

  if (raceName && /新人|ルーキー|新鋭|[Rr]ookie|[Jj]unior|[Nn]ewbie/.test(raceName)) {
    const err = new Error(`ROOKIE_SKIP:${raceName}`);
    err.isRookieSkip = true;
    throw err;
  }

  const lowScoreRiders = riders.filter(r => !r.isScratched && r.score !== null && r.score <= 67);
  if (lowScoreRiders.length >= 2) {
    const detail = lowScoreRiders.map(r => `${r.number}番(${r.score})`).join(', ');
    const err = new Error(`LOW_SCORE_SKIP:${lowScoreRiders.length}人が67点以下 [${detail}]`);
    err.isLowScoreSkip = true;
    throw err;
  }

  const weather = await getWeather(venue);
  const windSpeed     = weather.windSpeed     ?? 0;
  const windDirection = weather.windDirection ?? '北';

  const {
    BANK_DATA, getPlayerData, parseLineInput, runScenarioSimulation,
    generateSeitenreiBets, generateKoutenreiBets, calculateTenunIndex,
  } = sharedState;

  sharedState.currentWindSpeed = windSpeed;

  const gradeKey = SERIES_TO_GRADE[series] || 'a-kyu';
  raceTypeHolder.value = gradeKey;

  const selectedBank = BANK_DATA[venue];
  if (!selectedBank) {
    throw new Error(`バンクデータが見つかりません: "${venue}"`);
  }

  const activeRiders = riders.filter(r => !r.isScratched);
  const playerDataArray = activeRiders.map(r => ({
    id:         r.number,
    score:      r.score,
    style:      STYLE_NORM[r.styleRaw] ?? r.styleRaw ?? '',
    wmark:      r.wmark  ?? '',
    recent:     r.recent ?? null,
    is_s1:      r.is_s1  ?? false,
    is_b1:      r.is_b1  ?? false,
    is_scratch: false,
  }));

  // GC自動補正（129期以降 かつ recent に "1" が3回以上）
  const gcActivated = [];
  playerDataArray.forEach((p, i) => {
    const r = activeRiders[i];
    if (r.term >= 129 && r.age <= 25 && r.score < 80 && ((r.recent || '').match(/1/g) || []).length >= 3) {
      p.score = Math.max(p.score ?? 0, 90);
      gcActivated.push({ id: r.number, name: r.name, term: r.term });
    }
  });

  if (!lineFormation) {
    throw new Error('並び予想の取得に失敗しました（winticket・kdreams両方未取得）');
  }
  const lineInput = (lineFormation.lines || [])
    .map(l => (Array.isArray(l) ? l : (l.members || [])).join(''))
    .join(',');
  const basePlayers = getPlayerData(playerDataArray);
  const { lines, allSeriInfos } = parseLineInput(lineInput, basePlayers);
  const settings = COEFFICIENT_SETTINGS[gradeKey];

  // c_l（ライン結束係数）計算
  // calculateLineCoeffs は DOM 依存のため A.L.L. から直接呼べない。同等ロジックをここで実行。
  {
    const seriLoserSet = new Set(allSeriInfos.map(s => s.loser));
    const coop = settings.COOP_WEIGHT || 1.0;

    if (settings.IS_GIRLS) {
      lines.forEach(line => {
        if (line.length < 2) return;
        const leader = basePlayers.find(p => p.id === line[0]);
        for (let i = 1; i < line.length; i++) {
          const p = basePlayers.find(pp => pp.id === line[i]);
          if (!p || seriLoserSet.has(p.id)) continue;
          let markVal = 1.03;
          if (leader && leader.wmark === '◎')      markVal = 1.12;
          else if (leader && leader.wmark === '〇') markVal = 1.08;
          p.c_l = (i === 1) ? markVal : 1.0 + (markVal - 1.0) * 0.5;
        }
      });
    } else {
      const mainLine = lines.length > 0
        ? lines.reduce((mx, l) => {
            const s = l.reduce((t, id) => {
              const p = basePlayers.find(p => p.id === id);
              return t + (p ? (p.score || 0) : 0);
            }, 0);
            return s > mx.s ? { line: l, s } : mx;
          }, { line: [], s: -1 }).line
        : [];

      lines.forEach(line => {
        if (line.length < 2) return;
        line.forEach((id, i) => {
          if (seriLoserSet.has(id)) return;
          const p = basePlayers.find(pp => pp.id === id);
          if (!p) return;
          if (i === 1) {
            p.c_l = 1.0 + coop * 0.05;
          } else if (i === 2 && mainLine.join() === line.join()) {
            p.c_l = 1.0 + coop * 0.03;
          }
        });
      });
    }
  }

  basePlayers.forEach(p => {
    p.c_score_adj = 1.0 + (p.score / 100 - 1) * settings.R_BIAS;

    if (!p.recent) {
      p.c_recent = 1.0;
    } else {
      const recentScores = p.recent.split('').map(Number);
      const avgRank = recentScores.length > 0
        ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length
        : 4.0;
      let trendBonus = 0;
      if (recentScores.length >= 3) {
        const d1 = recentScores[1] - recentScores[0];
        const d2 = recentScores[2] - recentScores[1];
        if (d1 > 0 && d2 > 0) trendBonus = +0.03;
        if (d1 < 0 && d2 < 0) trendBonus = -0.03;
      }
      p.c_recent = (1.0 + (4 - avgRank) * 0.05 + trendBonus) * settings.RECENT_WEIGHT;
    }

    if      (p.wmark === '◎')                         p.c_wmark = 1.04;
    else if (p.wmark === '〇')                         p.c_wmark = 1.02;
    else if (p.wmark === '△')                         p.c_wmark = 1.005;
    else if (p.wmark === '✕')                         p.c_wmark = 1.003;
    else                                               p.c_wmark = 1.0;

    p.c_s1 = p.is_s1 ? 1.005 : 1.0;
    p.c_b1 = p.is_b1 ? 1.015 : 1.0;

    const biasKey = STYLE_TO_BIAS_KEY[p.style] || '';
    p.c_e = (selectedBank && selectedBank.keirin_bias)
      ? (selectedBank.keirin_bias[biasKey] || 1.0)
      : 1.0;
  });

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
        const normalizedScore = score / 3;
        return {
          rank:        rank + 1,
          id:          Number(id),
          style:       p ? p.style : '',
          score:       Math.round(normalizedScore * 100) / 100,
          final_score: normalizedScore,
          is_b1:       p ? (p.is_b1 || false) : false,
          is_s1:       p ? (p.is_s1 || false) : false,
          wmark:       p ? (p.wmark || '')    : '',
        };
      });

  const seitenScoresWithBonus = applyLineCountBonus(seitenResult.integratedScores, lines);
  const seitenRanking = toRankingRich(seitenScoresWithBonus);
  const koutenRanking = toRankingRich(koutenResult.integratedScores);

  const tenunData = calculateTenunIndex(
    seitenScoresWithBonus,
    koutenResult.integratedScores,
    seitenResult.allScenarioResults,
    basePlayers,
    windSpeed
  );

  const seitenTop3Ids = new Set((tenunData.rankingWithData || []).slice(0, 3).map(p => p.id));
  const seitenBets = generateSeitenreiBets(tenunData.rankingWithData);
  const koutenBets = generateKoutenreiBets(tenunData.rankingWithData, seitenTop3Ids);

  let shakkouResult = null;
  if (typeof appStub.invokeShakkouDonperi === 'function') {
    const shakkouContext = {
      grade:         gradeKey,
      seriInfos:     allSeriInfos,
      lineInput,
      lines,
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
      lines,
      seiten:     seitenRanking.map(({ rank, id, style, score }) => ({ rank, id, style, score })),
      kouten:     koutenRanking.map(({ rank, id, style, score }) => ({ rank, id, style, score })),
      gcActivated,
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
