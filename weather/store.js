// store.js — data/races_YYYYMM.jsonl への蓄積・走査を担う共通モジュール
// JSON Lines（1レース1行）。キーは date|venue|race_no。
// CLI:
//   node weather/store.js venue-races <slug>       会場の累積R数を出力
//   node weather/store.js ledger-has <key>         走査済みなら exit 0、未走査なら exit 1
//   node weather/store.js ledger-add <key> <days> <ok> <errors>  台帳に追記

const fs   = require('fs');
const path = require('path');
const { VENUE_MAP } = require('../kaisai.js'); // slug → 和名

const DATA_DIR   = path.join(__dirname, '../data');
const LEDGER_PATH = path.join(DATA_DIR, 'scan_ledger.json');

const RANK_KEYS = Array.from({ length: 9 }, (_, i) => `rank_${i + 1}`);

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function monthFile(yyyymm) {
  return path.join(DATA_DIR, `races_${yyyymm}.jsonl`);
}

function keyOf(r) {
  return `${r.date}|${r.venue}|${r.race_no}`;
}

// 該当月の全行を配列で返す
function readMonth(yyyymm) {
  const fp = monthFile(yyyymm);
  if (!fs.existsSync(fp)) return [];
  return fs.readFileSync(fp, 'utf8')
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line));
}

// 全 data/races_*.jsonl の全行を配列で返す
function readAll() {
  ensureDir();
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => /^races_\d{6}\.jsonl$/.test(f));
  const rows = [];
  for (const f of files) {
    const content = fs.readFileSync(path.join(DATA_DIR, f), 'utf8');
    for (const line of content.split('\n')) {
      if (line.trim().length > 0) rows.push(JSON.parse(line));
    }
  }
  return rows;
}

// 月ファイルを date, race_no 昇順で書き出す
function writeMonth(yyyymm, rows) {
  ensureDir();
  const sorted = rows.slice().sort((a, b) =>
    a.date.localeCompare(b.date) || a.race_no - b.race_no
  );
  const body = sorted.map(r => JSON.stringify(r)).join('\n');
  fs.writeFileSync(monthFile(yyyymm), sorted.length ? body + '\n' : '', 'utf8');
}

// 新規レコードを正規化（rank_1〜9 と temp/humidity を必ず持たせる）
function normalize(r) {
  const out = {
    date:    r.date,
    venue:   r.venue,
    race_no: r.race_no,
    kimari:  r.kimari ?? null,
  };
  for (const k of RANK_KEYS) out[k] = r[k] ?? null;
  out.temp     = r.temp ?? null;
  out.humidity = r.humidity ?? null;
  return out;
}

// 既存行に新行をマージ（null は既存値を上書きしない）
function mergeRow(existing, incoming) {
  const out = { ...existing };
  for (const k of Object.keys(incoming)) {
    if (incoming[k] !== null && incoming[k] !== undefined) out[k] = incoming[k];
  }
  return out;
}

// レコード配列を月別 JSONL に upsert（date|venue|race_no で重複はマージ）
function upsertRaces(records) {
  const byMonth = new Map();
  for (const raw of records) {
    const r  = normalize(raw);
    const ym = r.date.slice(0, 4) + r.date.slice(5, 7); // YYYY-MM-DD → YYYYMM
    if (!byMonth.has(ym)) byMonth.set(ym, []);
    byMonth.get(ym).push(r);
  }
  for (const [ym, incoming] of byMonth) {
    const map = new Map();
    for (const r of readMonth(ym)) map.set(keyOf(r), normalize(r));
    for (const r of incoming) {
      const k = keyOf(r);
      map.set(k, map.has(k) ? mergeRow(map.get(k), r) : r);
    }
    writeMonth(ym, [...map.values()]);
  }
}

// 会場（和名）→ 累積R数
function countByVenue() {
  const counts = new Map();
  for (const r of readAll()) {
    counts.set(r.venue, (counts.get(r.venue) || 0) + 1);
  }
  return counts;
}

// --- 走査台帳（scan_ledger.json）---
function readLedger() {
  if (!fs.existsSync(LEDGER_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8')); }
  catch { return {}; }
}

function writeLedger(obj) {
  ensureDir();
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

module.exports = {
  DATA_DIR, RANK_KEYS,
  monthFile, readMonth, readAll, writeMonth,
  normalize, upsertRaces, countByVenue,
  readLedger, writeLedger,
};

// --- CLI ---
if (require.main === module) {
  const [cmd, a, b, c, d] = process.argv.slice(2);

  if (cmd === 'venue-races') {
    const ja = VENUE_MAP[a] || a;
    process.stdout.write(String(countByVenue().get(ja) || 0));
    process.exit(0);
  }

  if (cmd === 'ledger-has') {
    process.exit(readLedger()[a] ? 0 : 1);
  }

  if (cmd === 'ledger-add') {
    const led = readLedger();
    led[a] = {
      days:   parseInt(b, 10) || 0,
      ok:     parseInt(c, 10) || 0,
      errors: parseInt(d, 10) || 0,
      ts:     new Date().toISOString(),
    };
    writeLedger(led);
    process.exit(0);
  }

  console.error('unknown command:', cmd);
  process.exit(1);
}
