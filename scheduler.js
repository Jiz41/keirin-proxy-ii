const cron              = require('node-cron');
const fetch             = require('node-fetch');
const { createClient }  = require('@supabase/supabase-js');
const { selectRaces }   = require('./selector');
const { predict }       = require('./orchestrator');
const { format }        = require('./formatter');
const { post }          = require('./poster');

// ── Supabase クライアント（二重投稿防止 + 実行ログ共用） ─────────────────────
let _db = null;
function getDb() {
  if (!_db && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    _db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }
  return _db;
}

// 実行ログINSERT
async function logExecution(result, raceId = null, venue = null, raceNum = null) {
  const db = getDb();
  if (!db) return;
  const { error } = await db.from('execution_logs').insert({
    result,
    race_id:  raceId,
    venue,
    race_num: raceNum,
  });
  if (error) console.error('[scheduler] execution_logs INSERT失敗:', error.message);
  else       console.log(`[scheduler] execution_logs INSERT: ${result}${raceId ? ` (${raceId})` : ''}`);
}

// Supabase上の discord_posts で二重投稿チェック
async function hasPosted(raceId) {
  const db = getDb();
  if (!db) return false;
  const { data, error } = await db
    .from('discord_posts')
    .select('race_id')
    .eq('race_id', raceId)
    .limit(1);
  if (error) {
    console.error('[scheduler] hasPosted チェック失敗:', error.message);
    return false;
  }
  return !!(data && data.length > 0);
}

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
    await logExecution('not_found');
    return;
  }

  for (const race of selected) {
    // Supabaseで二重投稿チェック（インメモリSetを廃止）
    const alreadyPosted = await hasPosted(race.raceId);
    if (alreadyPosted) {
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
      const raceNum = parseInt(race.raceId.slice(-2), 10);
      await logExecution('found', race.raceId, race.venue, raceNum);
      console.log(`[scheduler] 投稿完了: ${race.raceId} (${race.venue})`);
    } catch (e) {
      console.error(`[scheduler] エラー (${race.raceId}):`, e.message);
    }
  }
}

// 毎時0分・30分に実行
cron.schedule('0,30 * * * *', run);

// 毎10分にping（Renderスリープ防止 + HF Spaceスリープ防止）
cron.schedule('*/10 * * * *', async () => {
  try {
    await fetch('https://keirin-proxy-ii.onrender.com/');
    console.log(`[ping] render ${new Date().toISOString()}`);
  } catch (e) {}
  try {
    await fetch('https://jiz41-weather-proxy.hf.space/');
    console.log(`[ping] weather-proxy ${new Date().toISOString()}`);
  } catch (e) {}
});

console.log('[scheduler] 起動 — 毎時0分・30分に実行（JST 00〜07時はスキップ）');
