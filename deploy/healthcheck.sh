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

# ---- 版（配っているものは、どの commit から作られたか） ----
# 2026-08-19、本番が main から 3 日ぶん遅れているのに、この死活確認は 3 日間
# ずっと緑だった。見ていたのが「API が ok を返すか」「一覧の見出しが出るか」
# だけで、**版を見ていなかった**ため。事例 64（配備が全部緑のまま「動画だけ
# 古い」を通した）と同じ形が、こんどはサイト全体で起きていた。
#
# **2 つを分けて扱う。**
#
#   配ったもの ≠ 手元 … NG。「反映したつもりで反映されていない」＝事例 64
#   手元 < main      … NG にしない。注記だけ
#
# **遅れていること自体は異常ではない。**反映を回すかどうかは社長が決めること
# で、遅れは判断の結果でもありうる。**異常でないものを赤くする警報は、やがて
# 誰も見なくなり、本当の赤が埋もれる。**（だから注記に留める。代わりに、
# 役割④が毎周これを読んでレポートに書く ——⑤ 06:45 の裁定 2。読む人が
# 居ない注記は、無いのと同じ。）
DEPLOY_DIR="${DEPLOY_DIR:-/opt/creatoryard}"
VERSION_URL="${VERSION_URL:-$WEB/build.txt}"
VERSION_CHECK="${VERSION_CHECK:-1}"
if [ "$VERSION_CHECK" != "1" ]; then
  note "版: 確認しません（VERSION_CHECK=$VERSION_CHECK）"
else
  served="$(curl -sS --max-time 10 --fail "$VERSION_URL" 2>/dev/null | tr -d '\r\n[:space:]')"
  local_rev="$(git -C "$DEPLOY_DIR" rev-parse HEAD 2>/dev/null)"
  if [ -z "$served" ]; then
    # まだ build.txt を置いていない本番がある（この仕組みより前に配備した版）。
    # **無いことを壊れ扱いしない。**次の反映で置かれる
    note "版: まだ置かれていません（$VERSION_URL）。次の反映から出ます"
  elif [ -z "$local_rev" ]; then
    note "版: 手元の checkout を読めません（$DEPLOY_DIR）。比べられません"
  elif [ "$served" != "$local_rev" ]; then
    fail "配っているものが手元と違います（公開 ${served%"${served#???????}"}… / 手元 ${local_rev%"${local_rev#???????}"}…）。反映が途中で止まっているか、ビルドが古いままです"
  else
    # ここまで来たら「置いたものは配れている」。あとは手元が main から
    # 何本うしろか。**取れなければ黙って飛ばす**（網が無いことを異常にしない）
    behind=''
    if git -C "$DEPLOY_DIR" fetch --quiet origin main 2>/dev/null; then
      behind="$(git -C "$DEPLOY_DIR" rev-list --count HEAD..FETCH_HEAD 2>/dev/null)"
    fi
    if [ -n "$behind" ] && [ "$behind" -gt 0 ] 2>/dev/null; then
      note "版: 配っているものと手元は同じですが、main より ${behind} 本うしろです（反映するかは人が決めること）"
    else
      note "版: 配っているものと手元は同じです（${local_rev%"${local_rev#???????}"}…）"
    fi
  fi
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
#
# 置き場が無いときに黙って飛ばす作りにしていたが、backup.sh は置き場を
# mkdir -p で作るので、**1 度も取っていないサーバーにだけ置き場が無い**。
# いちばん危ない状態だけが静かになり、順序が逆だった。既定では鳴らし、
# 別経路で取る構成は BACKUP_CHECK=0 で**人が明示的に**黙らせる。
BACKUP_DIR="${BACKUP_DIR:-/var/backups/creatoryard}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-36}"
BACKUP_CHECK="${BACKUP_CHECK:-1}"
if [ "$BACKUP_CHECK" != "1" ]; then
  note "バックアップ: 確認しません（BACKUP_CHECK=$BACKUP_CHECK）"
elif [ ! -d "$BACKUP_DIR" ]; then
  fail "バックアップの置き場がありません（$BACKUP_DIR）。まだ 1 度も取れていないか、置き場の指定が違います"
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

# ---- 通報 ----
# 受け皿（server/lib/reports.mjs）は完成しているが、**届いたことに気づく経路が
# 無い**。あのファイル自身が「受け付けたまま増えていく一覧は、しばらくすると
# 誰も見なくなる」と書いている。状態は、見に行った人にしか効かない。
#
# **バックアップとは既定が逆。0 件は正常**（誰も困っていない）。置き場が無い
# のも、まだ 1 件も来ていないだけ。O-1 の結論をそのまま持ち込むと、開店初日
# から鳴り続ける警報になる（鳴りっぱなしの警報は、無いのと同じ）。
#
# **出すのは数字だけ。**本文・対象・通報者・運営メモ・受付番号は出さない。
# **種別も出さない** ——「著作権が 3 件」と出るだけでも、通報が集中している
# Story を外から推測する材料になる。状態を知るには JSON を開くしかないので、
# 「読まない」ではなく**「出さない」を保証する**（server/report-health.test.mjs
# の集計保証が機械で縛っている）。
REPORT_DIR="${REPORT_DIR:-${CY_DATA_DIR:-/var/lib/creatoryard/store}/reports}"
REPORT_MAX_AGE_HOURS="${REPORT_MAX_AGE_HOURS:-24}"
REPORT_CHECK="${REPORT_CHECK:-1}"
if [ "$REPORT_CHECK" != "1" ]; then
  note "通報: 確認しません（REPORT_CHECK=$REPORT_CHECK）"
elif [ ! -d "$REPORT_DIR" ]; then
  note "通報: 未対応 0 件（まだ 1 件も届いていません）"
else
  # 返すのは「未対応件数 最古の epoch 秒 読めなかった件数」の 3 語だけ。
  # ここに通報の中身は 1 文字も通さない。
  report_stat="$(python3 - "$REPORT_DIR" <<'PYREPORT'
import datetime, json, os, sys

d = sys.argv[1]
open_n = 0
oldest = 0
broken = 0
try:
    names = os.listdir(d)
except OSError:
    names = []
for name in names:
    if not name.endswith('.json'):
        continue
    try:
        with open(os.path.join(d, name), encoding='utf-8') as f:
            record = json.load(f)
        status = record['status']
        created = record['createdAt']
    except Exception:
        broken += 1          # 壊れた 1 件も黙って捨てない
        continue
    if status != 'open':
        continue
    open_n += 1
    try:
        stamp = int(
            datetime.datetime.fromisoformat(created.replace('Z', '+00:00')).timestamp()
        )
    except Exception:
        broken += 1
        continue
    if oldest == 0 or stamp < oldest:
        oldest = stamp
print(open_n, oldest, broken)
PYREPORT
)" || report_stat=""
  if [ -z "$report_stat" ]; then
    fail "通報の集計に失敗しました（$REPORT_DIR）"
  else
    set -- $report_stat
    open_n=$1
    oldest=$2
    broken=$3
    [ "$broken" -gt 0 ] && fail "読めない通報が ${broken} 件あります（$REPORT_DIR）。中身を確かめること"
    if [ "$open_n" -eq 0 ]; then
      note "通報: 未対応 0 件"
    else
      report_age_h=$(( ( $(date +%s) - oldest ) / 3600 ))
      if [ "$report_age_h" -ge "$REPORT_MAX_AGE_HOURS" ]; then
        fail "未対応の通報が ${open_n} 件、いちばん古いもので ${report_age_h} 時間が経っています（閾値 ${REPORT_MAX_AGE_HOURS} 時間）"
      else
        note "通報: 未対応 ${open_n} 件（いちばん古いもので ${report_age_h} 時間前）"
      fi
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
