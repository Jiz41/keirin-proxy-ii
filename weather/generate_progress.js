// generate_progress.js — Supabase集計 → docs/progress.json 出力
const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SECRET_KEY が未設定です');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
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

async function run() {
  const totalMonths = calcTotalMonths();

  // 全件取得（集計用）— select date,venue,kimari,temp,humidity のみ
  const { data: allRows, error } = await supabase
    .from('races')
    .select('date,venue,kimari,temp,humidity,race_no');
  if (error) { console.error('Supabase selectエラー:', error.message); process.exit(1); }

  const totalRaces = allRows.length;

  // venue別に分類
  const byVenue = new Map();
  for (const row of allRows) {
    if (!byVenue.has(row.venue)) byVenue.set(row.venue, []);
    byVenue.get(row.venue).push(row);
  }

  const venues = VENUES.map(venue => {
    const rows      = byVenue.get(venue) || [];
    const months    = new Set(rows.map(r => r.date.slice(0, 7)));
    const doneMonths = months.size;
    const pct       = totalMonths > 0 ? Math.min(100, Math.round(doneMonths / totalMonths * 100)) : 0;

    // 最新レコード（date DESC, race_no DESC）
    const sorted = rows.slice().sort((a, b) =>
      b.date.localeCompare(a.date) || b.race_no - a.race_no
    );
    const latest = sorted.length > 0
      ? { date: sorted[0].date, kimari: sorted[0].kimari, temp: sorted[0].temp, humidity: sorted[0].humidity }
      : null;

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
}

run().catch(e => { console.error(e); process.exit(1); });
