// fetch_weather.js — races テーブルの未取得行に open-meteo 気象データを紐付け
// Usage: node fetch_weather.js

const fetch    = require('node-fetch');
const Database = require('better-sqlite3');
const path     = require('path');

const DB_PATH = path.join(process.env.HOME || '/root', 'keirin_weather.db');
const sleep   = ms => new Promise(r => setTimeout(r, ms));

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

// date: YYYY-MM-DD, lat/lon: number → { temp, humidity }（12〜16時平均）
async function fetchWeatherForDate(date, lat, lon) {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude',  lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('start_date', date);
  url.searchParams.set('end_date',   date);
  url.searchParams.set('hourly', 'temperature_2m,relativehumidity_2m');
  url.searchParams.set('timezone', 'Asia/Tokyo');

  await sleep(500);
  const res  = await fetch(url.toString());
  if (!res.ok) throw new Error(`open-meteo HTTP ${res.status}`);
  const data = await res.json();

  if (!data.hourly) throw new Error('hourly data missing');
  // index 12〜16 = 12:00〜16:00
  const tempSlice     = data.hourly.temperature_2m.slice(12, 17);
  const humiditySlice = data.hourly.relativehumidity_2m.slice(12, 17);

  return { temp: avg(tempSlice), humidity: avg(humiditySlice) };
}

async function run() {
  const db  = new Database(DB_PATH);
  const upd = db.prepare('UPDATE races SET temp=@temp, humidity=@humidity WHERE date=@date AND venue=@venue AND race_no=@race_no');

  // temp が NULL の行を日付・会場でグループ化して処理
  const rows = db.prepare('SELECT DISTINCT date, venue FROM races WHERE temp IS NULL').all();
  console.log(`未取得 ${rows.length} 件（日付×会場）`);

  let updated = 0;
  for (const { date, venue } of rows) {
    const latlng = VENUE_LATLNG[venue];
    if (!latlng) {
      console.warn(`  座標なし: ${venue} → スキップ`);
      continue;
    }

    process.stdout.write(`  ${date} ${venue} ... `);
    let weather;
    try {
      weather = await fetchWeatherForDate(date, latlng[0], latlng[1]);
    } catch (e) {
      console.log(`error: ${e.message}`);
      continue;
    }

    const raceNos = db.prepare('SELECT race_no FROM races WHERE date=? AND venue=?').all(date, venue);
    for (const { race_no } of raceNos) {
      upd.run({ temp: weather.temp, humidity: weather.humidity, date, venue, race_no });
      updated++;
    }
    console.log(`temp=${weather.temp}℃ humidity=${weather.humidity}%`);
  }

  console.log(`\n完了 — ${updated} 行 UPDATE`);
  db.close();
}

run().catch(e => { console.error(e); process.exit(1); });
