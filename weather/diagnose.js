// diagnose.js — 一時診断スクリプト（読み取り専用・DB書き込みなし）
// Actions環境からkdreams.jpへ実際に何が返ってきているかを確認する
// Usage: node diagnose.js <YYYYMMDD>
const fetch = require('node-fetch');
const { getKaisai } = require('../kaisai.js');

// scrape_results.js と同じSupabase初期化を再現し、これが原因かどうか切り分ける
if (process.env.DIAG_WITH_SUPABASE === '1') {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    console.error('[診断] SUPABASE_URL / SUPABASE_SECRET_KEY が未設定です');
    process.exit(1);
  }
  const { createClient } = require('@supabase/supabase-js');
  const ws = require('ws');
  console.log('[診断] Supabaseクライアント初期化中（scrape_results.js同等構成）...');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    realtime: { transport: ws },
  });
  console.log('[診断] Supabaseクライアント初期化完了');
}

async function run(yyyymmdd) {
  const year  = yyyymmdd.slice(0, 4);
  const month = yyyymmdd.slice(4, 6);
  const day   = yyyymmdd.slice(6, 8);
  const url   = `https://keirin.kdreams.jp/kaisai/${year}/${month}/${day}/`;

  console.log(`[診断] URL: ${url}`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'PoliteKeirinBot/1.0 (on-demand only, no flood; say the word and I vanish; DM: https://x.com/kayoutouidou01)',
      'Accept': 'text/html',
      'Accept-Language': 'ja-JP',
    },
  });
  const body = await res.text();
  console.log(`[診断] HTTP status: ${res.status}`);
  console.log(`[診断] body length: ${body.length}`);
  console.log(`[診断] body先頭300字: ${body.slice(0, 300).replace(/\n/g, ' ')}`);
  const racecardCount = (body.match(/\/racecard\//g) || []).length;
  console.log(`[診断] racecard文字列出現回数: ${racecardCount}`);

  console.log('[診断] --- getKaisai()呼び出し ---');
  const kaisai = await getKaisai(yyyymmdd);
  console.log(`[診断] venues検出数: ${kaisai.venues.length}`);
  console.log(`[診断] venues一覧: ${JSON.stringify(kaisai.venues.map(v => ({ slug: v.slug, grade: v.grade, days: v.days.length })))}`);
}

// 月単位シミュレーション: scrape_results.js の日次ループを模して連続アクセス時の挙動を見る
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

async function runMonth(targetSlug, yyyymm) {
  const days = daysInMonth(yyyymm);
  console.log(`[診断月次] ${targetSlug} ${yyyymm} — 対象${days.length}日`);
  let foundCount = 0;
  for (const yyyymmdd of days) {
    let kaisai;
    try {
      kaisai = await getKaisai(yyyymmdd);
    } catch (e) {
      console.log(`[診断月次] ${yyyymmdd} kaisai fetch error: ${e.message}`);
      continue;
    }
    const targetVenue = kaisai.venues.find(v => v.slug === targetSlug);
    if (!targetVenue) continue;
    foundCount++;
    console.log(`[診断月次] ${yyyymmdd} 発見: ${targetVenue.name} grade=${targetVenue.grade} days=${targetVenue.days.length}`);
  }
  console.log(`[診断月次] === 完了 ${targetSlug} ${yyyymm} — 発見${foundCount}日 ===`);
}

const [, , arg1, arg2] = process.argv;
if (arg1 && /^\d{8}$/.test(arg1) && !arg2) {
  run(arg1).catch(e => { console.error('診断エラー:', e); process.exit(1); });
} else if (arg1 && arg2 && /^\d{6}$/.test(arg2)) {
  runMonth(arg1, arg2).catch(e => { console.error('診断エラー:', e); process.exit(1); });
} else {
  console.error('Usage: node diagnose.js <YYYYMMDD>  |  node diagnose.js <slug> <YYYYMM>');
  process.exit(1);
}
