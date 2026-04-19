const { getKaisai } = require('./kaisai');
const { scrapeRace } = require('./scraper');

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

  // 今日のraceIdのみ収集
  // raceId構造: [VV][YYYYMMDD(開催初日)][DD(日数目)][RRRR(レース番号)]
  // 開催初日が当日とは限らないため、初日日付と当日の差分でDD(日数目)を算出して照合する
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

  // 5並列バッチスクレイプ
  const BATCH = 5;
  const scraped = [];
  for (let i = 0; i < allRaceIds.length; i += BATCH) {
    const batch = allRaceIds.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(id => scrapeRace(id)));
    for (const r of results) {
      if (r.status === 'fulfilled') scraped.push(r.value);
    }
    if (i + BATCH < allRaceIds.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // 条件: betTimeまで15〜30分以内 かつ 7車立て
  const filtered = scraped.filter(race => {
    if (!race.betTime) return false;
    const [h, m] = race.betTime.split(':').map(Number);
    const diff = (h * 60 + m) - nowMinutes;
    const riderCount = race.riders.filter(r => !r.isScratched).length;
    return diff >= 15 && diff <= 30 && riderCount === 7;
  });

  // シャッフルして最大2件
  return filtered.sort(() => Math.random() - 0.5).slice(0, 2);
}

module.exports = { selectRaces };
