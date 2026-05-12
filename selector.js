const { getKaisai } = require('./kaisai');
const { scrapeRace, scrapeRaceLight } = require('./scraper');

function jstNow() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year  = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day   = String(d.getUTCDate()).padStart(2, '0');
  return {
    dateStr:    `${year}${month}${day}`,
    nowMinutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

async function selectRaces() {
  const { dateStr, nowMinutes } = jstNow();

  const kaisai = await getKaisai(dateStr);

  const todayMs = Date.UTC(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(4, 6)) - 1,
    parseInt(dateStr.slice(6, 8))
  );
  const allRaceIds = [];
  for (const venue of kaisai.venues) {
    for (const day of venue.days) {
      for (const race of day.races) {
        const start = race.raceId.slice(2, 10);
        const startMs = Date.UTC(
          parseInt(start.slice(0, 4)),
          parseInt(start.slice(4, 6)) - 1,
          parseInt(start.slice(6, 8))
        );
        const dayNum = Math.round((todayMs - startMs) / 86400000) + 1;
        if (dayNum >= 1 && race.raceId.slice(10, 12) === String(dayNum).padStart(2, '0')) {
          allRaceIds.push(race.raceId);
        }
      }
    }
  }

  // Phase 1: ライトスクレイプ — betTime のみ取得して範囲外を除外
  const BATCH = 3;
  const candidates = [];
  for (let i = 0; i < allRaceIds.length; i += BATCH) {
    const batch = allRaceIds.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(id => scrapeRaceLight(id)));
    for (let j = 0; j < batch.length; j++) {
      const r = results[j];
      if (r.status !== 'fulfilled' || !r.value) continue;
      const [h, m] = r.value.split(':').map(Number);
      const diff = (h * 60 + m) - nowMinutes;
      if (diff >= 15 && diff <= 30) candidates.push(batch[j]);
    }
    if (i + BATCH < allRaceIds.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  if (candidates.length === 0) return [];

  // Phase 2: 候補のみフルスクレイプ（winticket 含む）
  const fullResults = await Promise.allSettled(candidates.map(id => scrapeRace(id)));
  const scraped = fullResults
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  // 再確認: betTime + 7車立て
  const filtered = scraped.filter(race => {
    if (!race.betTime) return false;
    const [h, m] = race.betTime.split(':').map(Number);
    const diff = (h * 60 + m) - nowMinutes;
    const riderCount = race.riders.filter(r => !r.isScratched).length;
    return diff >= 15 && diff <= 30 && riderCount === 7;
  });

  return filtered.sort(() => Math.random() - 0.5).slice(0, 2);
}

module.exports = { selectRaces };
