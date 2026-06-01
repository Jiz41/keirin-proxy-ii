// migrate_to_supabase.js — SQLite(/root/keirin_weather.db) → Supabase 全件移行
const Database    = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const path        = require('path');

const DB_PATH = path.join(process.env.HOME || '/root', 'keirin_weather.db');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SECRET_KEY が未設定です');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const db       = new Database(DB_PATH, { readonly: true });

const BATCH = 500;

async function run() {
  const rows = db.prepare('SELECT * FROM races').all();
  console.log(`SQLite: ${rows.length} 件 → Supabase へ upsert`);

  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('races')
      .upsert(chunk, { onConflict: 'date,venue,race_no' });
    if (error) {
      console.error(`upsertエラー (batch ${i / BATCH + 1}): ${error.message}`);
      process.exit(1);
    }
    done += chunk.length;
    process.stdout.write(`\r  ${done}/${rows.length} 完了`);
  }
  console.log('\n移行完了');
  db.close();
}

run().catch(e => { console.error(e); process.exit(1); });
