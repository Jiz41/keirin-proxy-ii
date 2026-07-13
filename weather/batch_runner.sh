#!/bin/bash
set -e

# 進捗管理は data/scan_ledger.json（走査済み月）と data/races_*.jsonl（累積R数）で行う。
# Supabase 依存は廃止済み。
#
# 完了判定（バグ1対策）:
#   scrape_results.js は exit 0 = クリーン完走（一時的失敗なし。404含む正当な欠測は許容）、
#                       exit 3/その他 = 一時的失敗あり → 台帳に記録せず次回再試行。
# 会場ごとの累積R数が TARGET_RACES に達したらその会場は以降スキップ（進行単位=350R）。
# 相手サイトへの配慮のため、1日の処理レース数を DAILY_RACE_LIMIT で頭打ちにする。

cd "$(dirname "$0")/.."   # リポジトリルートへ

TARGET_RACES=350
DAILY_RACE_LIMIT=700

VENUES=(hakodate aomori iwakitaira yahiko maebashi toride utsunomiya omiya seibuen keiokaku tachikawa matsudo kawasaki hiratsuka odawara ito shizuoka toyama nagoya gifu ogaki toyohashi matsusaka yokkaichi fukui nara mukomachi wakayama kishiwada tamano hiroshima hofu takamatsu komatsushima kochi matsuyama kokura kurume takeo sasebo beppu kumamoto)

# 前橋・小倉は除外
EXCLUDED="maebashi kokura"

START_YEAR=2022
START_MONTH=4
NOW_YEAR=$(date +%Y)
NOW_MONTH=$(date +%m)

TOTAL_OK=0

for VENUE in "${VENUES[@]}"; do
  case " $EXCLUDED " in *" $VENUE "*) continue ;; esac

  # 累積R数が目標に達している会場はスキップ
  RACES=$(node weather/store.js venue-races "$VENUE")
  if [ "$RACES" -ge "$TARGET_RACES" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $VENUE は ${RACES}R（目標${TARGET_RACES}R到達）→ スキップ"
    continue
  fi

  Y=$START_YEAR
  M=$START_MONTH
  while true; do
    YM=$(printf '%04d%02d' $Y $M)
    KEY="${VENUE}_${YM}"

    if node weather/store.js ledger-has "$KEY"; then
      :  # 走査済み → スキップ
    else
      if [ $TOTAL_OK -ge $DAILY_RACE_LIMIT ]; then break 2; fi
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] 処理開始: $VENUE $Y年${M}月"
      SLEEP_SEC=$((RANDOM % 4 + 3))
      sleep $SLEEP_SEC

      OUT=$(node weather/scrape_results.js "$VENUE" "$YM" 2>&1) && RC=0 || RC=$?
      echo "$OUT"

      if [ "$RC" -eq 0 ]; then
        # クリーン完走 → SUMMARY をパースして台帳に記録
        SUMMARY=$(echo "$OUT" | grep '^SUMMARY ' | tail -1)
        DAYS=$(echo "$SUMMARY" | sed -n 's/.*kaisai_days=\([0-9]*\).*/\1/p')
        OK=$(echo "$SUMMARY"   | sed -n 's/.*ok=\([0-9]*\).*/\1/p')
        ERRS=$(echo "$SUMMARY" | sed -n 's/.*errors=\([0-9]*\).*/\1/p')
        node weather/store.js ledger-add "$KEY" "${DAYS:-0}" "${OK:-0}" "${ERRS:-0}"
        TOTAL_OK=$((TOTAL_OK + ${OK:-0}))

        # 目標到達したら会場ループを打ち切り
        RACES=$(node weather/store.js venue-races "$VENUE")
        if [ "$RACES" -ge "$TARGET_RACES" ]; then
          echo "[$(date '+%Y-%m-%d %H:%M:%S')] $VENUE ${RACES}R 到達 → 会場完了"
          break
        fi
      else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 一時的失敗(exit $RC): $VENUE $YM → 台帳に記録せず再試行対象"
      fi
    fi

    M=$((M + 1))
    if [ $M -gt 12 ]; then M=1; Y=$((Y + 1)); fi
    if [ $Y -gt $NOW_YEAR ] || ([ $Y -eq $NOW_YEAR ] && [ $M -gt $NOW_MONTH ]); then break; fi
  done
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] === scrape完了 ${TOTAL_OK}R — fetch_weather 実行 ==="
node weather/fetch_weather.js

echo "[$(date '+%Y-%m-%d %H:%M:%S')] === fetch_weather 完了 — progress.json 生成 ==="
node weather/generate_progress.js

echo "[$(date '+%Y-%m-%d %H:%M:%S')] === progress.json 生成完了 — GitHub プッシュ ==="
git config user.email "actions@github.com"
git config user.name "github-actions"
git add data/ docs/progress.json
git diff --cached --quiet || git commit -m "update weather dataset [skip ci]"
git push https://x-access-token:${GITHUB_TOKEN}@github.com/Jiz41/keirin-proxy-ii.git HEAD:main && \
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] === プッシュ完了 ===" || \
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] === プッシュ失敗 ==="
