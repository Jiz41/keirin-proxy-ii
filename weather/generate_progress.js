// generate_progress.js — data/*.jsonl 集計 → docs/progress.json 出力
const fs    = require('fs');
const path  = require('path');
const store = require('./store.js');

const OUT_PATH   = path.join(__dirname, '../docs/progress.json');
const TARGET_RACES = 350; // 会場あたりの目標R数

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

function run() {
  const totalMonths = calcTotalMonths();

  const allRows = store.readAll();
  const totalRaces = allRows.length;

  // venue別に分類
  const byVenue = new Map();
  for (const row of allRows) {
    if (!byVenue.has(row.venue)) byVenue.set(row.venue, []);
    byVenue.get(row.venue).push(row);
  }

  const venues = VENUES.map(venue => {
    const rows       = byVenue.get(venue) || [];
    const months     = new Set(rows.map(r => r.date.slice(0, 7)));
    const doneMonths = months.size;
    const doneRaces  = rows.length;
    // 進捗は「1000R到達度」を主指標に（月数指標は既存フィールドとして維持）
    const pct        = Math.min(100, Math.round(doneRaces / TARGET_RACES * 100));

    // 最新レコード（date DESC, race_no DESC）
    const sorted = rows.slice().sort((a, b) =>
      b.date.localeCompare(a.date) || b.race_no - a.race_no
    );
    const latest = sorted.length > 0
      ? { date: sorted[0].date, kimari: sorted[0].kimari, temp: sorted[0].temp, humidity: sorted[0].humidity }
      : null;

    return {
      venue,
      done_months:  doneMonths,
      total_months: totalMonths,
      done_races:   doneRaces,
      target_races: TARGET_RACES,
      pct,
      latest,
    };
  });

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify({
    generated_at: new Date().toISOString(),
    total_races:  totalRaces,
    total_months: totalMonths,
    venues,
  }, null, 2), 'utf8');

  console.log(`progress.json 出力: ${OUT_PATH} (${venues.length}会場)`);
}

try { run(); } catch (e) { console.error(e); process.exit(1); }
