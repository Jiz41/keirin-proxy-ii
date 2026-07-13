// fetch_weather.js — races テーブルの未取得行に open-meteo 気象データを紐付け
// Usage: node fetch_weather.js

const fetch    = require('node-fetch');
const store    = require('./store.js');

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

const sleep      = ms => new Promise(r => setTimeout(r, ms));
const sleepRand  = () => sleep(3000 + Math.random() * 2000); // 3〜5秒ランダム

// 会場名 → [緯度, 経度]（前橋・小倉は null で除外済み）
const VENUE_LATLNG = {
  '函館':     [41.7686, 140.7288],
  '青森':     [40.7822, 140.7380],
  'いわき平': [37.0574, 140.8877],
  '弥彦':     [37.6517, 138.8272],
  '取手':     [35.9103, 140.0780],
  '宇都宮':   [36.5658, 139.8836],
  '大宮':     [35.9065, 139.6244],
  '西武園':   [35.7897, 139.4731],
  '京王閣':   [35.6297, 139.4503],
  '立川':     [35.7042, 139.4139],
  '松戸':     [35.7878, 139.9026],
  '千葉':     [35.6072, 140.1062],
  '川崎':     [35.5308, 139.7032],
  '平塚':     [35.3303, 139.3497],
  '小田原':   [35.2481, 139.1542],
  '伊東':     [34.9657, 139.0991],
  '静岡':     [34.9756, 138.3831],
  '富山':     [36.6953, 137.2113],
  '名古屋':   [35.1815, 136.9066],
  '岐阜':     [35.4231, 136.7608],
  '大垣':     [35.3597, 136.6194],
  '豊橋':     [34.7694, 137.3917],
  '松阪':     [34.5781, 136.5272],
  '四日市':   [34.9731, 136.6242],
  '福井':     [36.0641, 136.2197],
  '奈良':     [34.6853, 135.8326],
  '向日町':   [34.9408, 135.7103],
  '和歌山':   [34.2261, 135.1669],
  '岸和田':   [34.4608, 135.3628],
  '玉野':     [34.4878, 133.9458],
  '広島':     [34.3853, 132.4733],
  '防府':     [34.0531, 131.5617],
  '高松':     [34.3403, 134.0461],
  '小松島':   [33.9778, 134.5897],
  '高知':     [33.5597, 133.5317],
  '松山':     [33.8331, 132.7658],
  '久留米':   [33.3197, 130.5081],
  '武雄':     [33.1928, 130.0194],
  '佐世保':   [33.1597, 129.7186],
  '別府':     [33.2797, 131.4975],
  '熊本':     [32.7903, 130.7419],
};

function avg(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined);
  if (!valid.length) return null;
  return Math.round((valid.reduce((s, v) => s + v, 0) / valid.length) * 10) / 10;
}

// YYYY-MM-DD 同士の日差（整数）
function dayDiff(from, to) {
  return Math.round((new Date(to) - new Date(from)) / 86400000);
}

// 日付配列を7日以内のチャンクに分割
function chunkDates(dates) {
  const sorted = [...dates].sort();
  const chunks = [];
  let chunk = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (dayDiff(chunk[0], sorted[i]) < 7) {
      chunk.push(sorted[i]);
    } else {
      chunks.push(chunk);
      chunk = [sorted[i]];
    }
  }
  chunks.push(chunk);
  return chunks; // [[startDate, ..., endDate], ...]
}

// 指数バックオフリトライ付きフェッチ（最大5回、sleep込み）
async function fetchWithRetry(url, maxRetries = 5) {
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await sleepRand();
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (attempt < maxRetries - 1) {
      const backoff = Math.pow(2, attempt) * 1000;
      console.warn(`    retry ${attempt + 1}/${maxRetries - 1} after ${backoff}ms...`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

// チャンク（複数日）まとめて1リクエスト → 日別の12〜16時平均を返す Map<date, {temp, humidity}>
async function fetchChunk(dates, lat, lon) {
  const startDate = dates[0];
  const endDate   = dates[dates.length - 1];

  const url = new URL(ARCHIVE_URL);
  url.searchParams.set('latitude',   lat);
  url.searchParams.set('longitude',  lon);
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date',   endDate);
  url.searchParams.set('hourly',     'temperature_2m,relativehumidity_2m');

  const res  = await fetchWithRetry(url.toString());
  const data = await res.json();
  if (!data.hourly) throw new Error('hourly data missing');

  const result = new Map();
  for (const date of dates) {
    const offset    = dayDiff(startDate, date) * 24;
    const tempSlice = data.hourly.temperature_2m.slice(offset + 12, offset + 17);
    const humSlice  = data.hourly.relativehumidity_2m.slice(offset + 12, offset + 17);
    result.set(date, { temp: avg(tempSlice), humidity: avg(humSlice) });
  }
  return result;
}

async function run() {
  // 全 JSONL を読み、temp 未取得（null）の (date, venue) を洗い出す
  const allRows = store.readAll();

  const seen = new Set();
  const rows = [];
  for (const r of allRows) {
    if (r.temp !== null && r.temp !== undefined) continue;
    const k = `${r.date}|${r.venue}`;
    if (!seen.has(k)) { seen.add(k); rows.push({ date: r.date, venue: r.venue }); }
  }
  rows.sort((a, b) => a.venue.localeCompare(b.venue) || a.date.localeCompare(b.date));
  console.log(`未取得 ${rows.length} 件（日付×会場）`);

  // venue → [date, ...] のマップ
  const venueMap = new Map();
  for (const { date, venue } of rows) {
    if (!venueMap.has(venue)) venueMap.set(venue, []);
    venueMap.get(venue).push(date);
  }

  // (date|venue) → {temp, humidity} の確定結果を貯め、最後に月別 upsert
  const resolved = new Map();
  let updated = 0;

  for (const [venue, dates] of venueMap) {
    const latlng = VENUE_LATLNG[venue];
    if (!latlng) { console.warn(`  座標なし: ${venue} → スキップ`); continue; }

    const chunks = chunkDates(dates);
    console.log(`[${venue}] ${dates.length}日分 → ${chunks.length}チャンク`);

    for (const chunk of chunks) {
      const label = chunk.length === 1 ? chunk[0] : `${chunk[0]}〜${chunk[chunk.length - 1]}`;
      process.stdout.write(`  ${label} ... `);

      let weatherMap;
      try {
        weatherMap = await fetchChunk(chunk, latlng[0], latlng[1]);
      } catch (e) {
        console.log(`error: ${e.message}`);
        continue;
      }

      for (const [date, { temp, humidity }] of weatherMap) {
        resolved.set(`${date}|${venue}`, { date, venue, temp, humidity });
      }
      console.log(`OK (temp=${[...weatherMap.values()].map(w => w.temp).join('/')}℃)`);
    }
  }

  // 該当 (date, venue) の全レース行に temp/humidity を書き戻す
  const updates = [];
  for (const r of allRows) {
    const hit = resolved.get(`${r.date}|${r.venue}`);
    if (!hit) continue;
    updates.push({ ...r, temp: hit.temp, humidity: hit.humidity });
    updated++;
  }
  if (updates.length) store.upsertRaces(updates);

  console.log(`\n完了 — ${updated} レース行に気象データを反映（${resolved.size} 日付×会場）`);
}

run().catch(e => { console.error(e); process.exit(1); });
