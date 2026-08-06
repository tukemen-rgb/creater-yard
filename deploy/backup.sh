#!/bin/bash
#
# CreatorYard のバックアップ。GAMEYARD の deploy/backup.sh の縮約版。
#
# 失われたら復元できないのは store/ だけ:
#   store/accounts/  アカウント（パスワードハッシュ・墓標）
#   store/stories/   Story（下書き含む）
#   store/images/    画像の実体とメタ
#   store/../.auth-secret  署名鍵（AUTH_SECRET を env で持つ場合は無い）
# 静的成果物と node_modules はリポジトリから作り直せるので対象外。
#
# 使い方:
#   deploy/backup.sh                      # 既定の設定で 1 回取る
#   BACKUP_DIR=/mnt/backup deploy/backup.sh
#
# cron ではなく systemd timer から呼ぶ想定（deploy/creatoryard-backup.timer）。
set -euo pipefail

DATA_DIR="${CY_DATA_DIR:-/var/lib/creatoryard/store}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/creatoryard}"
# 保持日数と、日数に関係なく残す最小本数。
# 「古いものを消す」だけの設定にすると、障害で新しいバックアップが
# 作れていない期間に古いものまで消えてしまう。
RETENTION_DAYS="${RETENTION_DAYS:-14}"
KEEP_MIN="${KEEP_MIN:-3}"
# 取った直後に復元の訓練を回すか。既定は回す。「取れている」と「戻せる」は
# 別のことで、確かめずに置くと、必要になった日に初めて戻せないと分かる。
DRILL="${BACKUP_DRILL:-1}"

log() { echo "[backup] $*"; }
die() { echo "[backup] 失敗: $*" >&2; exit 1; }

[ -d "$DATA_DIR" ] || die "store ディレクトリがありません: $DATA_DIR"
mkdir -p "$BACKUP_DIR"

stamp="$(date -u +%Y%m%d-%H%M%SZ)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# ---- 1. 取る前に中身を確かめる ----
# 壊れた JSON をそのまま保存すると、復元しても壊れたままになる。
bad=0
while IFS= read -r -d '' f; do
  if ! python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$f" 2>/dev/null; then
    log "壊れた JSON: $f"
    bad=$((bad + 1))
  fi
done < <(find "$DATA_DIR" -name '*.json' -print0)
[ "$bad" -eq 0 ] || die "$bad 件の JSON が壊れています。先に調査すること"

# 件数を数える。復元するときに読むのはこの数字。
count() { find "$DATA_DIR/$1" -name '*.json' 2>/dev/null | wc -l; }
accounts=$(count accounts)
stories=$(count stories)
images=$(count images)

# ---- 2. 固める ----
archive="$BACKUP_DIR/creatoryard-$stamp.tar.gz"
secret="$(dirname "$DATA_DIR")/.auth-secret"
tar -czf "$archive" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")" \
  $([ -f "$secret" ] && echo ".auth-secret")
cat > "$archive.manifest" <<EOF
{"stamp":"$stamp","accounts":$accounts,"stories":$stories,"images":$images}
EOF
log "取得: $archive（アカウント $accounts / Story $stories / 画像 $images）"

# ---- 3. 復元の訓練（一時ディレクトリへ展開して件数を照合するだけ）----
if [ "$DRILL" = "1" ]; then
  tar -xzf "$archive" -C "$work"
  got=$(find "$work/$(basename "$DATA_DIR")/stories" -name '*.json' 2>/dev/null | wc -l)
  [ "$got" -eq "$stories" ] || die "復元訓練で Story の件数が合いません（$got != $stories）"
  log "復元訓練 OK"
fi

# ---- 4. 回転（最小本数は日数より優先して残す）----
total=$(ls -1 "$BACKUP_DIR"/creatoryard-*.tar.gz 2>/dev/null | wc -l)
if [ "$total" -gt "$KEEP_MIN" ]; then
  find "$BACKUP_DIR" -name 'creatoryard-*.tar.gz' -mtime +"$RETENTION_DAYS" \
    | sort | head -n $((total - KEEP_MIN)) \
    | while IFS= read -r old; do
        rm -f "$old" "$old.manifest"
        log "回転: $(basename "$old") を削除"
      done
fi
log "完了"
