#!/bin/bash
#
# 死活確認。systemd timer から数分おきに回す（GAMEYARD の縮約版）。
#
# 見るのは「プロセスが生きているか」ではなく「役目を果たせているか」:
#   - API が JSON で ok を返すか
#   - web が Story 一覧を HTML で返すか（SSR が死ぬとタグ SEO ごと死ぬ）
#   - ディスクに書ける余地があるか（書けなくなると投稿が黙って失敗する）
#
# 使い方:
#   deploy/healthcheck.sh
#   ALERT_WEBHOOK=https://... deploy/healthcheck.sh
set -uo pipefail

API="${HEALTH_API:-http://127.0.0.1:8798}"
WEB="${HEALTH_WEB:-http://127.0.0.1:3000}"
DATA_MOUNT="${DATA_MOUNT:-/var/lib/creatoryard}"
DISK_WARN_PCT="${DISK_WARN_PCT:-85}"
WEBHOOK="${ALERT_WEBHOOK:-}"

problems=()
note() { echo "[health] $*"; }
fail() { problems+=("$1"); echo "[health] NG: $1"; }

# ---- API ----
# `curl -f` は使わない。この API は異常を 4xx/5xx + 理由つき JSON で返す
# 設計なので、-f を付けると本文が捨てられ「応答しません」と誤診する。
response="$(curl -sS --max-time 10 -w '\n%{http_code}' "$API/api/health" 2>/dev/null)"
status="$(printf '%s' "$response" | tail -1)"
body="$(printf '%s' "$response" | sed '$d')"
if [ "$status" = "000" ] || [ -z "$body" ]; then
  fail "API が応答しません（$API）。投稿もログインもできない状態です"
else
  ok=$(printf '%s' "$body" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ok'))" 2>/dev/null)
  if [ "$ok" != "True" ]; then
    fail "API が異常を報告しています: $body"
  else
    note "API: OK"
  fi
  # メール送信の有無は異常ではない（無効のまま運用してよい）。ただし
  # 「設定したつもりで無効」に気づけないと、パスワードを忘れた書き手を
  # 戻せない。状態だけ出す。
  mail=$(printf '%s' "$body" | python3 -c "import json,sys; print(json.load(sys.stdin).get('mail'))" 2>/dev/null)
  [ "$mail" = "True" ] && note "パスワード再設定: 有効" || note "パスワード再設定: 無効（MAIL_TRANSPORT 未設定）"
fi

# ---- web（SSR） ----
html="$(curl -sS --max-time 10 "$WEB/stories/" 2>/dev/null)"
if [ -z "$html" ]; then
  fail "web が応答しません（$WEB）。Story ページが出せない状態です"
elif ! printf '%s' "$html" | grep -q 'Creator Story'; then
  fail "web の応答に一覧の見出しがありません。ビルドの混入か設定違いを疑うこと（scripts/verify.mjs 参照）"
else
  note "web: OK（SSR が HTML を返しています）"
fi

# ---- ディスク ----
if [ -d "$DATA_MOUNT" ]; then
  used_pct=$(df --output=pcent "$DATA_MOUNT" | tail -1 | tr -dc '0-9')
  if [ "${used_pct:-0}" -ge "$DISK_WARN_PCT" ]; then
    fail "実データのディスク使用率が ${used_pct}% です（警告閾値 ${DISK_WARN_PCT}%）"
  else
    note "ディスク: ${used_pct}% 使用"
  fi
fi

# ---- バックアップ ----
# 「timer が生きているか」ではなく「新しい書庫が実在するか」を見る。
# systemctl is-active は仕組みを見る検査で、仕組みが動いていても中身が
# 増えていなければ守られていない。GitLab は 2017-01-31 に、5 系統の
# バックアップ・複製がすべて死んでいる状態で本番を消した。決め手は
# 「取れていなかったこと」ではなく「取れていないと誰も知らなかったこと」で、
# 失敗を知らせるメール自体が弾かれていた（docs/research/case-studies.md 62）。
#
# 見るのはファイル名と mtime だけで、書庫は開かない。中身が戻せるかは
# backup.sh の復元訓練（BACKUP_DRILL=1）が取得のたびに照合している。
# ここで開くと死活確認が数分おきに数百 MB を展開することになる。
#
# 閾値は「1 日」ではなく時間で書く。timer は毎日 1 回なので、36 時間なら
# 1 回飛ばしでは鳴らず、2 回続けて飛んだら鳴る。扱うのは時刻差だけで
# 暦日の境目をまたがないため、時刻帯には依存しない。
BACKUP_DIR="${BACKUP_DIR:-/var/backups/creatoryard}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-36}"
if [ ! -d "$BACKUP_DIR" ]; then
  # 別の経路で取る構成を壊さない。無いことは異常にしない。
  note "バックアップ: 確認しません（$BACKUP_DIR がありません）"
else
  newest="$(find "$BACKUP_DIR" -maxdepth 1 -name 'creatoryard-*.tar.gz' \
    -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1)"
  if [ -z "$newest" ]; then
    fail "バックアップが 1 本もありません（$BACKUP_DIR）。まだ 1 度も取れていない可能性があります"
  else
    age_h=$(( ( $(date +%s) - ${newest%%.*} ) / 3600 ))
    if [ "$age_h" -ge "$BACKUP_MAX_AGE_HOURS" ]; then
      fail "最後のバックアップから ${age_h} 時間が経っています（閾値 ${BACKUP_MAX_AGE_HOURS} 時間）。timer か backup.sh が黙って止まっている可能性があります"
    else
      note "バックアップ: ${age_h} 時間前（$(basename "${newest#* }")）"
    fi
  fi
fi

# ---- 通知 ----
if [ "${#problems[@]}" -gt 0 ]; then
  summary="CreatorYard healthcheck NG: ${problems[*]}"
  echo "[health] $summary"
  if [ -n "$WEBHOOK" ]; then
    curl -sS --max-time 10 -X POST -H 'content-type: application/json' \
      -d "$(python3 -c "import json,sys; print(json.dumps({'content': sys.argv[1]}))" "$summary")" \
      "$WEBHOOK" > /dev/null 2>&1 || echo "[health] 通知の送信にも失敗しました"
  fi
  exit 1
fi
note "すべて OK"
