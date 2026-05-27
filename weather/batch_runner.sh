#!/bin/bash
# batch_runner.sh — 39会場×2022年4月〜現在を月単位でローテーション取得
# 1日15会場×1ヶ月分を消化、翌日は続きから
# 進捗: ~/keirin_weather_progress.json
# ログ: ~/keirin_weather_cron.log（crontabから追記）

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROGRESS_FILE="$HOME/keirin_weather_progress.json"
SCRAPE="$SCRIPT_DIR/scrape_results.js"
WEATHER="$SCRIPT_DIR/fetch_weather.js"
NODE="$(which node)"
export TMPDIR=/data/data/com.termux/files/usr/tmp

MAX_PER_DAY=15

# 前橋(maebashi)・小倉(kokura)を除いた39会場
SLUGS=(
  hakodate aomori iwakitaira yahiko toride utsunomiya omiya seibuen
  keiokaku tachikawa matsudo chiba kawasaki hiratsuka odawara ito
  shizuoka toyama nagoya gifu ogaki toyohashi matsusaka yokkaichi
  fukui nara mukomachi wakayama kishiwada tamano hiroshima hofu
  takamatsu komatsushima kochi matsuyama kurume takeo sasebo beppu kumamoto
)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# 2022-04 〜 現在月 の YYYYMM 一覧を生成
generate_months() {
  local year=2022 month=4
  local cur_year cur_month
  cur_year=$(date +%Y); cur_month=$(date +%-m)
  while [[ $year -lt $cur_year ]] || [[ $year -eq $cur_year && $month -le $cur_month ]]; do
    printf "%04d%02d\n" "$year" "$month"
    month=$((month + 1))
    if [[ $month -gt 12 ]]; then month=1; year=$((year + 1)); fi
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

# 次の未取得を1件返す（見つからなければ空文字）
find_next() {
  local done="$1"
  for slug in "${SLUGS[@]}"; do
    for yyyymm in "${MONTHS[@]}"; do
      local key="${slug}_${yyyymm}"
      if ! grep -qx "$key" <<< "$done" 2>/dev/null; then
        echo "${slug} ${yyyymm}"
        return
      fi
    done
  done
}

mapfile -t MONTHS < <(generate_months)

COUNT=0
log "=== batch_runner 開始 (最大 ${MAX_PER_DAY} 件) ==="

while [[ $COUNT -lt $MAX_PER_DAY ]]; do
  # ループごとに進捗を再読み込み（save_done の結果を反映）
  DONE="$(load_done)"
  NEXT="$(find_next "$DONE")"

  if [[ -z "$NEXT" ]]; then
    log "全会場・全月の取得が完了しております。"
    break
  fi

  TARGET_SLUG="${NEXT%% *}"
  TARGET_YYYYMM="${NEXT##* }"

  log "[$((COUNT + 1))/$MAX_PER_DAY] $TARGET_SLUG $TARGET_YYYYMM"

  if "$NODE" "$SCRAPE" "$TARGET_SLUG" "$TARGET_YYYYMM"; then
    save_done "${TARGET_SLUG}_${TARGET_YYYYMM}" "OK"
  else
    EXIT_CODE=$?
    log "scrapeエラー (exit ${EXIT_CODE}): $TARGET_SLUG $TARGET_YYYYMM → スキップ"
    save_done "${TARGET_SLUG}_${TARGET_YYYYMM}" "ERROR:${EXIT_CODE}"
  fi

  COUNT=$((COUNT + 1))

  # 会場間 sleep 3〜5秒ランダム（最終件は不要）
  if [[ $COUNT -lt $MAX_PER_DAY ]]; then
    S=$((3 + RANDOM % 3))
    log "sleep ${S}s"
    sleep "$S"
  fi
done

log "=== scrape完了 ${COUNT} 件 — fetch_weather 実行 ==="
"$NODE" "$WEATHER"
log "=== fetch_weather 完了 — progress.json 生成 ==="
"$NODE" "$SCRIPT_DIR/generate_progress.js"
log "=== progress.json 生成完了 — GitHub プッシュ ==="
cd "$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
git add docs/progress.json
git commit -m "chore: progress.json 自動更新 (batch_runner $(date '+%Y-%m-%d'))" || log "コミット対象なし"
git push origin main && log "=== プッシュ完了 ===" || log "=== プッシュ失敗 ==="
log "=== batch_runner 終了 ==="
