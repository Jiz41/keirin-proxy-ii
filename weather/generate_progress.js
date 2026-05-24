// generate_progress.js — SQLite集計 → docs/progress.json 出力
const Database = require('better-sqlite3');
const path = require('path');
const fs   = require('fs');

const DB_PATH  = path.join(process.env.HOME || '/root', 'keirin_weather.db');
const OUT_PATH = path.join(__dirname, '../docs/progress.json');

// 43会場（前橋・小倉含む全場）
const VENUES = [
  '函館', '青森', 'いわき平', '弥彦', '前橋', '取手', '宇都宮', '大宮', '西武園',
  '京王閣', '立川', '松戸', '千葉', '川崎', '平塚', '小田原', '伊東', '静岡',
  '富山', '名古屋', '岐阜', '大垣', '豊橋', '松阪', '四日市', '福井', '奈良',
  '向日町', '和歌山', '岸和田', '玉野', '広島', '防府', '高松', '小松島', '高知',
  '松山', '小倉', '久留米', '武雄', '佐世保', '別府', '熊本',
];

// 2022-04 〜 現在月 の総月数
function calcTotalMonths() {
  const now = new Date();
  return (now.getFullYear() - 2022) * 12 + (now.getMonth() + 1 - 4) + 1;
}

const db         = new Database(DB_PATH);
const totalMonths = calcTotalMonths();
const totalRaces  = db.prepare('SELECT COUNT(*) as n FROM races').get().n;

const venues = VENUES.map(venue => {
  const doneRow = db.prepare(
    "SELECT COUNT(DISTINCT substr(date,1,7)) as n FROM races WHERE venue=?"
  ).get(venue);
  const doneMonths = doneRow ? doneRow.n : 0;
  const pct        = totalMonths > 0 ? Math.min(100, Math.round(doneMonths / totalMonths * 100)) : 0;

  const latest = db.prepare(
    "SELECT date, kimari, temp, humidity FROM races WHERE venue=? ORDER BY date DESC, race_no DESC LIMIT 1"
  ).get(venue) || null;

  return { venue, done_months: doneMonths, total_months: totalMonths, pct, latest };
});

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify({
  generated_at: new Date().toISOString(),
  total_races:  totalRaces,
  total_months: totalMonths,
  venues,
}, null, 2), 'utf8');

console.log(`progress.json 出力: ${OUT_PATH} (${venues.length}会場)`);
db.close();
