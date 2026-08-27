// generate_trends.js — data/*.jsonl 集計 → docs/weather_trends.json 出力
// 気温帯・季節別の決まり手比率を会場ごとに集計する。
const fs    = require('fs');
const path  = require('path');
const store = require('./store.js');

const OUT_PATH = path.join(__dirname, '../docs/weather_trends.json');

const KIMARI_KEYS = ['差', '捲', '逃'];

function tempBinOf(temp) {
  if (temp < 10) return '<10';
  if (temp < 20) return '10-20';
  if (temp < 25) return '20-25';
  if (temp < 30) return '25-30';
  return '30+';
}

const SEASON_OF_MONTH = {
  '12': '冬', '01': '冬', '02': '冬',
  '03': '春', '04': '春', '05': '春',
  '06': '夏', '07': '夏', '08': '夏',
  '09': '秋', '10': '秋', '11': '秋',
};

function seasonOf(dateStr) {
  const mm = dateStr.slice(5, 7);
  return SEASON_OF_MONTH[mm];
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// rows: kimari が既に絞られた配列を group => {n, 差, 捲, 逃, low_n}
function summarize(rows) {
  const n = rows.length;
  const counts = { '差': 0, '捲': 0, '逃': 0 };
  for (const r of rows) counts[r.kimari]++;
  const out = { n };
  for (const k of KIMARI_KEYS) {
    out[k] = n > 0 ? round1(counts[k] / n * 100) : 0;
  }
  if (n < 30) out.low_n = true;
  return out;
}

function run() {
  const allRows = store.readAll();

  // kimari が空/nullの行は除外
  const valid = allRows.filter(r => r.kimari);

  const byVenue = new Map();
  for (const row of valid) {
    if (!byVenue.has(row.venue)) byVenue.set(row.venue, []);
    byVenue.get(row.venue).push(row);
  }

  const venues = {};
  for (const [venue, rows] of byVenue.entries()) {
    const total = rows.length;
    const baseline = summarize(rows);
    delete baseline.n;
    delete baseline.low_n;

    const byTempBin = {};
    const tempGroups = new Map();
    for (const r of rows) {
      const bin = tempBinOf(r.temp);
      if (!tempGroups.has(bin)) tempGroups.set(bin, []);
      tempGroups.get(bin).push(r);
    }
    for (const bin of ['<10', '10-20', '20-25', '25-30', '30+']) {
      const grp = tempGroups.get(bin);
      if (grp && grp.length > 0) {
        byTempBin[bin] = summarize(grp);
      }
    }

    const bySeason = {};
    const seasonGroups = new Map();
    for (const r of rows) {
      const s = seasonOf(r.date);
      if (!seasonGroups.has(s)) seasonGroups.set(s, []);
      seasonGroups.get(s).push(r);
    }
    for (const s of ['春', '夏', '秋', '冬']) {
      const grp = seasonGroups.get(s);
      if (grp && grp.length > 0) {
        bySeason[s] = summarize(grp);
      }
    }

    venues[venue] = {
      total,
      baseline,
      by_temp_bin: byTempBin,
      by_season: bySeason,
    };
  }

  const output = {
    generated_at: new Date().toISOString(),
    venues,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`weather_trends.json 生成完了: ${Object.keys(venues).length}会場`);
}

run();
