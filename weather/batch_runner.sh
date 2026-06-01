#!/bin/bash
set -e

SUPABASE_URL="${SUPABASE_URL}"
SUPABASE_KEY="${SUPABASE_SECRET_KEY}"

load_done() {
  curl -s "${SUPABASE_URL}/rest/v1/progress?select=key&limit=10000" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    | jq -r '.[].key' 2>/dev/null || echo ""
}

save_done() {
  local key="$1"
  curl -s -X POST "${SUPABASE_URL}/rest/v1/progress" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "{\"key\":\"${key}\"}"
}

DONE=$(load_done)

VENUES=(hakodate aomori iwakitaira yahiko maebashi toride utsunomiya omiya seibuen keiokaku tachikawa matsudo kawasaki hiratsuka odawara ito shizuoka toyama nagoya gifu ogaki toyohashi matsusaka yokkaichi fukui nara mukomachi wakayama kishiwada tamano hiroshima hofu takamatsu komatsushima kochi matsuyama kokura kurume takeo sasebo beppu kumamoto)

START_YEAR=2022
START_MONTH=4
NOW_YEAR=$(date +%Y)
NOW_MONTH=$(date +%m)

COUNT=0
MAX=15

for VENUE in "${VENUES[@]}"; do
  Y=$START_YEAR
  M=$START_MONTH
  while true; do
    KEY="${VENUE}_$(printf '%04d%02d' $Y $M)"
    if echo "$DONE" | grep -qx "$KEY"; then
      :
    else
      if [ $COUNT -ge $MAX ]; then break 2; fi
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] 処理開始: $VENUE $Y年${M}月"
      SLEEP_SEC=$((RANDOM % 4 + 3))
      sleep $SLEEP_SEC
      node weather/scrape_results.js "$VENUE" "$(printf '%04d%02d' $Y $M)" && \
        save_done "$KEY" && COUNT=$((COUNT + 1)) || \
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] scrapeエラー: $VENUE $(printf '%04d%02d' $Y $M) → スキップ"
    fi
    M=$((M + 1))
    if [ $M -gt 12 ]; then M=1; Y=$((Y + 1)); fi
    if [ $Y -gt $NOW_YEAR ] || ([ $Y -eq $NOW_YEAR ] && [ $M -gt $NOW_MONTH ]); then break; fi
  done
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] === scrape完了 $COUNT 件 — fetch_weather 実行 ==="
node weather/fetch_weather.js

echo "[$(date '+%Y-%m-%d %H:%M:%S')] === fetch_weather 完了 — progress.json 生成 ==="
node weather/generate_progress.js

echo "[$(date '+%Y-%m-%d %H:%M:%S')] === progress.json 生成完了 — GitHub プッシュ ==="
git config user.email "actions@github.com"
git config user.name "github-actions"
git add docs/progress.json
git diff --cached --quiet || git commit -m "update progress.json [skip ci]"
git push https://x-access-token:${GITHUB_TOKEN}@github.com/Jiz41/keirin-proxy-ii.git HEAD:main && \
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] === プッシュ完了 ===" || \
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] === プッシュ失敗 ==="
