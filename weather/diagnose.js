// diagnose.js — 一時診断スクリプト（読み取り専用・DB書き込みなし）
// Actions環境からkdreams.jpへ実際に何が返ってきているかを確認する
// Usage: node diagnose.js <YYYYMMDD>
const fetch = require('node-fetch');
const { getKaisai } = require('../kaisai.js');

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

const [, , yyyymmdd] = process.argv;
if (!yyyymmdd || !/^\d{8}$/.test(yyyymmdd)) {
  console.error('Usage: node diagnose.js <YYYYMMDD>');
  process.exit(1);
}
run(yyyymmdd).catch(e => { console.error('診断エラー:', e); process.exit(1); });
