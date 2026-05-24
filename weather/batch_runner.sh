#!/bin/bash
# batch_runner.sh — 41会場×2021年1月〜現在を月単位でローテーション取得
# 進捗: ~/keirin_weather_progress.json
# ログ: ~/keirin_weather_cron.log（crontabから追記）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROGRESS_FILE="$HOME/keirin_weather_progress.json"
SCRAPE="$SCRIPT_DIR/scrape_results.js"
WEATHER="$SCRIPT_DIR/fetch_weather.js"
NODE="$(which node)"
export TMPDIR=/data/data/com.termux/files/usr/tmp

# 前橋(maebashi)・小倉(kokura)を除いた39会場
SLUGS=(
  hakodate aomori iwakitaira yahiko toride utsunomiya omiya seibuen
  keiokaku tachikawa matsudo chiba kawasaki hiratsuka odawara ito
  shizuoka toyama nagoya gifu ogaki toyohashi matsusaka yokkaichi
  fukui nara mukomachi wakayama kishiwada tamano hiroshima hofu
  takamatsu komatsushima kochi matsuyama kurume takeo sasebo beppu kumamoto
)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# 2021-01 〜 現在月 の YYYYMM 一覧を生成
generate_months() {
  local year=2022 month=4
  local cur_year cur_month
  cur_year=$(date +%Y); cur_month=$(date +%-m)
  while [[ $year -lt $cur_year ]] || [[ $year -eq $cur_year && $month -le $cur_month ]]; do
    printf "%04d%02d\n" "$year" "$month"
    ((month++))
    if [[ $month -gt 12 ]]; then month=1; ((year++)); fi
  done
}

# 進捗ファイルから done セットを読み込む
load_done() {
  if [[ -f "$PROGRESS_FILE" ]]; then
    python3 -c "
import json, sys
try:
    d = json.load(open('$PROGRESS_FILE'))
    print('\n'.join(d.get('done', [])))
except Exception as e:
    sys.stderr.write(str(e)+'\n')
" 2>/dev/null
  fi
}

# 進捗ファイルに key を追記保存
save_done() {
  local key="$1" note="$2"
  python3 -c "
import json, datetime
f = '$PROGRESS_FILE'
try:
    d = json.load(open(f))
except Exception:
    d = {'done': []}
if '$key' not in d['done']:
    d['done'].append('$key')
d['last_updated'] = datetime.datetime.now().isoformat()
d['last_entry'] = '$key ($note)'
json.dump(d, open(f, 'w'), ensure_ascii=False, indent=2)
print('進捗更新: ' + str(len(d['done'])) + ' 件完了 / last=' + '$key')
"
}

mapfile -t MONTHS < <(generate_months)
DONE="$(load_done)"

TARGET_SLUG=""
TARGET_YYYYMM=""

# 会場×月の順で次の未取得を探す
for slug in "${SLUGS[@]}"; do
  for yyyymm in "${MONTHS[@]}"; do
    key="${slug}_${yyyymm}"
    if ! grep -qx "$key" <<< "$DONE" 2>/dev/null; then
      TARGET_SLUG="$slug"
      TARGET_YYYYMM="$yyyymm"
      break 2
    fi
  done
done

if [[ -z "$TARGET_SLUG" ]]; then
  log "全会場・全月の取得が完了しております。"
  exit 0
fi

log "実行開始: $TARGET_SLUG $TARGET_YYYYMM"

# scrape
if "$NODE" "$SCRAPE" "$TARGET_SLUG" "$TARGET_YYYYMM"; then
  save_done "${TARGET_SLUG}_${TARGET_YYYYMM}" "OK"
  log "scrape完了: $TARGET_SLUG $TARGET_YYYYMM"

  # fetch_weather
  log "fetch_weather 実行開始"
  "$NODE" "$WEATHER"
  log "fetch_weather 完了"
else
  EXIT_CODE=$?
  log "scrapeエラー (exit ${EXIT_CODE}): $TARGET_SLUG $TARGET_YYYYMM → スキップして次へ"
  save_done "${TARGET_SLUG}_${TARGET_YYYYMM}" "ERROR:${EXIT_CODE}"
fi
