#!/bin/sh
# 생각 줄다리기 자동 시험 실행기: 프로젝트의 index.html을 임시 폴더로 복사해 모든 시험 묶음을 돌리고 합계를 보여 준다
# 사용법: sh tests/run.sh   (Node.js 필요. 브라우저·인터넷은 쓰지 않는다)
set -e
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
mkdir -p "$work/run" "$work/expand200"
cp "$here"/*.js "$here/fixture-200.json" "$here/../index.html" "$here/../qrcode.js" "$work/run/"
cp "$here/fixture-200.json" "$work/expand200/fixture.json"   # big-reasons·sides-image 시험이 찾는 자리
cd "$work/run"
pass=0; fail=0; bad=""
for t in *-test.js phone-test-flow.js phone-test-pure.js; do
  line="$(node "$t" 2>&1 | tail -1)"
  p="$(printf '%s' "$line" | sed -n -E 's/^([0-9]+) passed, ([0-9]+) failed.*/\1/p')"
  f="$(printf '%s' "$line" | sed -n -E 's/^([0-9]+) passed, ([0-9]+) failed.*/\2/p')"
  if [ -z "$p" ]; then echo "$t: 실행 오류"; bad="$bad $t"; continue; fi
  echo "$t: $line"; pass=$((pass + p)); fail=$((fail + f))
  [ "$f" -eq 0 ] || bad="$bad $t"
done
echo "합계: $pass passed, $fail failed"
[ -z "$bad" ] || { echo "확인이 필요한 묶음:$bad"; exit 1; }
