// scrape_results.js — winticket から指定会場×1ヶ月の結果を取得して DB 投入
// Usage: node scrape_results.js <slugName> <YYYYMM>
// Example: node scrape_results.js kishiwada 202604
// 前橋(maebashi)・小倉(kokura)は除外

const fetch    = require('node-fetch');
const cheerio  = require('cheerio');
const Database = require('better-sqlite3');
const path     = require('path');
const { getKaisai } = require('../kaisai.js');

const DB_PATH = path.join(process.env.HOME || '/root', 'keirin_weather.db');
const UA      = 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const SLEEP_MS = 3000;

const VENUE_MAP = {
  '11':'hakodate', '12':'aomori',    '13':'iwakitaira',
  '21':'yahiko',   '22':'maebashi',  '23':'toride',
  '24':'utsunomiya','25':'omiya',    '26':'seibuen',
  '27':'keiokaku', '28':'tachikawa', '31':'matsudo',
  '32':'chiba',    '34':'kawasaki',  '35':'hiratsuka',
  '36':'odawara',  '37':'ito',       '38':'shizuoka',
  '42':'nagoya',   '43':'gifu',      '44':'ogaki',
  '45':'toyohashi','46':'toyama',    '47':'matsusaka',
  '48':'yokkaichi','51':'fukui',     '53':'nara',
  '54':'mukomachi','55':'wakayama',  '56':'kishiwada',
  '61':'tamano',   '62':'hiroshima', '63':'hofu',
  '71':'takamatsu','73':'komatsushima','74':'kochi',
  '75':'matsuyama','81':'kokura',    '83':'kurume',
  '84':'takeo',    '85':'sasebo',    '86':'beppu',
  '87':'kumamoto',
};

const EXCLUDED_SLUGS = new Set(['maebashi', 'kokura']);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function scrapeResult(raceId) {
  const venueCode = raceId.slice(0, 2);
  const slug      = VENUE_MAP[venueCode];
  if (!slug || EXCLUDED_SLUGS.has(slug)) return null;

  const yyyymmdd  = raceId.slice(2, 10);
  const dayOfMeet = parseInt(raceId.slice(10, 12), 10);
  const raceNo    = parseInt(raceId.slice(12), 10);
  const cupId     = `${yyyymmdd}${venueCode}`;

  const url = `https://www.winticket.jp/keirin/${slug}/raceresult/${cupId}/${dayOfMeet}/${raceNo}`;

  await sleep(SLEEP_MS);

  let body;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'ja-JP' },
    });
    if (!res.ok) { console.warn(`  skip ${raceId}: HTTP ${res.status}`); return null; }
    body = await res.text();
  } catch (e) {
    console.warn(`  fetch error ${raceId}: ${e.message}`);
    return null;
  }

  const $ = cheerio.load(body);

  // playerId → 車番マッピング（リンク直前の aria-label="N番" セルから取得）
  const playerBib = {};
  $('a[href*="/keirin/cyclist/"]').each((_, el) => {
    const pid = ($(el).attr('href') || '').match(/\/keirin\/cyclist\/(\d+)/);
    if (!pid) return;
    // 同行の先頭セルにある aria-label="N番" を探す
    const row = $(el).closest('tr');
    const bibEl = row.find('[aria-label$="番"]').first();
    const bm = (bibEl.attr('aria-label') || '').match(/^(\d+)番$/);
    if (bm) playerBib[pid[1]] = parseInt(bm[1], 10);
  });

  // results JSON（埋め込み）から着順・決まり手を取得
  const rm = body.match(/"results":\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/);
  if (!rm) { console.warn(`  results JSON not found: ${raceId}`); return null; }

  let results;
  try {
    results = JSON.parse('[' + rm[1] + ']');
  } catch (e) {
    console.warn(`  JSON parse error ${raceId}: ${e.message}`);
    return null;
  }

  const thisRace = results
    .filter(r => r.raceNumber === raceNo && r.day === dayOfMeet)
    .sort((a, b) => a.order - b.order);

  if (thisRace.length === 0) { console.warn(`  no results for ${raceId}`); return null; }

  const rank   = thisRace.map(r => playerBib[r.playerId] || null);
  const kimari = thisRace[0].factor || '';

  // rank_1〜9 を最大9枠分に展開
  const rankObj = {};
  for (let i = 0; i < 9; i++) {
    rankObj[`rank_${i + 1}`] = rank[i] ?? null;
  }

  return { kimari, ...rankObj };
}

// YYYYMM の全日付を配列で返す
function daysInMonth(yyyymm) {
  const year  = parseInt(yyyymm.slice(0, 4), 10);
  const month = parseInt(yyyymm.slice(4, 6), 10);
  const last  = new Date(year, month, 0).getDate();
  const days  = [];
  for (let d = 1; d <= last; d++) {
    days.push(`${yyyymm}${String(d).padStart(2, '0')}`);
  }
  return days;
}

async function run(targetSlug, yyyymm) {
  if (EXCLUDED_SLUGS.has(targetSlug)) {
    console.error('前橋・小倉は除外対象でございます。');
    process.exit(1);
  }

  const db   = new Database(DB_PATH);
  const ins  = db.prepare(`
    INSERT OR IGNORE INTO races
      (date, venue, race_no, rank_1, rank_2, rank_3, rank_4, rank_5,
       rank_6, rank_7, rank_8, rank_9, kimari)
    VALUES
      (@date, @venue, @race_no, @rank_1, @rank_2, @rank_3, @rank_4, @rank_5,
       @rank_6, @rank_7, @rank_8, @rank_9, @kimari)
  `);

  const days   = daysInMonth(yyyymm);
  let inserted = 0;

  for (const yyyymmdd of days) {
    let kaisai;
    try {
      kaisai = await getKaisai(yyyymmdd);
    } catch (e) {
      console.warn(`kaisai fetch error ${yyyymmdd}: ${e.message}`);
      continue;
    }

    const targetVenue = kaisai.venues.find(v => v.slug === targetSlug);
    if (!targetVenue) continue;

    // F1・F2 以外の開催はスキップ
    if (!['F1', 'F2'].includes(targetVenue.grade)) {
      console.log(`  skip (grade=${targetVenue.grade}): ${targetVenue.name}`);
      continue;
    }

    const loopDate = `${yyyymmdd.slice(0,4)}-${yyyymmdd.slice(4,6)}-${yyyymmdd.slice(6,8)}`;
    console.log(`[${loopDate}] ${targetVenue.name} — ${targetVenue.grade} ${targetVenue.days.length}日開催`);

    for (const day of targetVenue.days) {
      for (const race of day.races) {
        // 実際のレース日 = 開催開始日 + (dayOfMeet - 1)日
        const startYmd  = race.raceId.slice(2, 10); // 開催開始日 YYYYMMDD
        const dom       = parseInt(race.raceId.slice(10, 12), 10); // dayOfMeet
        const startDt   = new Date(`${startYmd.slice(0,4)}-${startYmd.slice(4,6)}-${startYmd.slice(6,8)}`);
        startDt.setDate(startDt.getDate() + dom - 1);
        const dateStr   = startDt.toISOString().slice(0, 10); // YYYY-MM-DD
        if (!dateStr.replace(/-/g, '').startsWith(yyyymm)) continue; // 当月外スキップ
        if (dateStr !== loopDate) continue; // 当日分のみ処理

        process.stdout.write(`  R${race.raceNo} ${race.raceId} ... `);
        const result = await scrapeResult(race.raceId);
        if (!result) { console.log('skip'); continue; }

        ins.run({
          date:    dateStr,
          venue:   targetVenue.name,
          race_no: race.raceNo,
          ...result,
        });
        inserted++;
        console.log(`OK (${result.rank_1}着→決:${result.kimari})`);
      }
    }
  }

  console.log(`\n完了 — ${inserted} 件 INSERT`);
  db.close();
}

// --- CLI ---
const [,, slug, yyyymm] = process.argv;
if (!slug || !yyyymm || !/^\d{6}$/.test(yyyymm)) {
  console.error('Usage: node scrape_results.js <slug> <YYYYMM>');
  console.error('Example: node scrape_results.js kishiwada 202604');
  process.exit(1);
}
run(slug, yyyymm).catch(e => { console.error(e); process.exit(1); });
