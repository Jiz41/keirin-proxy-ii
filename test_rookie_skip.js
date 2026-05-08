#!/usr/bin/env node
// 松山競輪 2026/05/08 の全レースのレース名を取得し、スキップ対象を Discord に報告する
try { require('dotenv').config(); } catch (_) {}
const fetch = require('node-fetch');

const SLUG       = 'matsuyama';
const VENUE_CODE = '75';
const YYYYMMDD   = '20260508';
const MAX_RACE   = 12;
const SKIP_RE    = /新人|ルーキー|[Rr]ookie/;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getRaceName(raceNo, dayOfMeet) {
  const url = `https://www.winticket.jp/keirin/${SLUG}/racecard/${YYYYMMDD}${VENUE_CODE}/${dayOfMeet}/${raceNo}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'ja-JP',
      }
    });
    if (!res.ok) return null;
    const body = await res.text();
    const re = /"number":(\d+),"class":"[^"]+","raceType":"([^"]+)"/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      if (parseInt(m[1], 10) === raceNo) return m[2];
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function main() {
  const rows  = [];
  const skips = [];

  // dayOfMeet=1 で試行、null が続いたら打ち切り
  let consecutive_null = 0;
  for (let raceNo = 1; raceNo <= MAX_RACE; raceNo++) {
    await sleep(800);
    const name = await getRaceName(raceNo, 1);
    if (name === null) {
      consecutive_null++;
      if (consecutive_null >= 2) break;
      rows.push(`R${raceNo}: (取得失敗)`);
      continue;
    }
    consecutive_null = 0;
    const isSkip = SKIP_RE.test(name);
    rows.push(`R${raceNo}: ${name}${isSkip ? ' ⚠️スキップ' : ''}`);
    if (isSkip) skips.push(raceNo);
  }

  const body = [
    '**[新人戦スキップテスト] 松山競輪 2026/05/08**',
    '',
    rows.join('\n'),
    '',
    skips.length > 0
      ? `スキップ対象レース: R${skips.join(', R')}`
      : 'スキップ対象: なし',
  ].join('\n');

  console.log(body);

  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) { console.warn('DISCORD_WEBHOOK_URL 未設定'); return; }

  const res = await fetch(webhook, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ content: body }),
  });
  if (!res.ok) console.error('Discord送信失敗:', res.status);
  else         console.log('Discord送信完了');
}

main().catch(e => { console.error(e); process.exit(1); });
