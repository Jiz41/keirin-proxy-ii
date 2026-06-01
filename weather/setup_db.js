// setup_db.js — Supabase 接続確認（テーブルは SQL Editor で作成済み）
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SECRET_KEY が未設定です');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  const { count, error } = await supabase
    .from('races')
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.error('Supabase接続エラー:', error.message);
    process.exit(1);
  }
  console.log(`Supabase接続OK — races テーブル: ${count} 件`);
}

run().catch(e => { console.error(e); process.exit(1); });
