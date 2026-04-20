const cron      = require('node-cron');
const fetch     = require('node-fetch');
const { selectRaces } = require('./selector');
const { predict }     = require('./orchestrator');
const { format }      = require('./formatter');
const { post }        = require('./poster');

const postedRaceIds = new Set();

function jstHour() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();
}

async function run() {
  const hour = jstHour();

  // 00:00〜07:00 はスキップ
  if (hour <= 7) {
    console.log(`[scheduler] JST ${hour}時 — スキップ`);
    return;
  }

  console.log(`[scheduler] JST ${hour}時 — 起動`);

  let selected;
  try {
    console.log('[A.L.L.] レース選定開始');
    selected = await selectRaces();
    console.log('[A.L.L.] レース選定完了:', selected.map(r => r.raceId));
  } catch (e) {
    console.error('[scheduler] selector エラー:', e.message);
    return;
  }

  if (selected.length === 0) {
    console.log('[scheduler] 対象レースなし（betTime 15〜30分 / 7車立て）');
    return;
  }

  for (const race of selected) {
    if (postedRaceIds.has(race.raceId)) {
      console.log(`[scheduler] スキップ（投稿済み）: ${race.raceId}`);
      continue;
    }
    try {
      console.log('[A.L.L.] 予想生成開始:', race.raceId);
      const prediction = await predict(race.raceId);
      console.log('[A.L.L.] 予想生成完了:', race.raceId);
      const payload    = format(prediction);
      console.log('[A.L.L.] Discord送信開始:', race.raceId);
      await post(payload);
      console.log('[A.L.L.] Discord送信完了:', race.raceId);
      postedRaceIds.add(race.raceId);
      console.log(`[scheduler] 投稿完了: ${race.raceId} (${race.venue})`);
    } catch (e) {
      console.error(`[scheduler] エラー (${race.raceId}):`, e.message);
    }
  }
}

// 毎時0分・30分に実行
cron.schedule('0,30 * * * *', run);

// 毎時30分に自己ping（Renderスリープ防止）
cron.schedule('*/10 * * * *', async () => {
  try {
    await fetch('https://keirin-proxy-ii.onrender.com/');
    console.log(`[ping] ${new Date().toISOString()}`);
  } catch (e) {}
});

console.log('[scheduler] 起動 — 毎時0分・30分に実行（JST 00〜07時はスキップ）');
