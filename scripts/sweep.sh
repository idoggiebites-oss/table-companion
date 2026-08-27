#!/bin/sh
# Every browser suite, once, with a verdict that cannot be misread.
#
# The one-liner this replaces filtered for lines NOT matching "N pass, 0 fail"
# — and "0 pass, 0 fail" matches that, so a suite that ran NOTHING read as a
# suite that passed. The dev server died partway through a run and 54 of 60
# suites reported nothing; the filter called it clean. Silence is not success.
#
# So: a suite that produced no assertions is an ERROR here, the server is
# checked before starting, and the exit code is the verdict.
set -u
cd "$(dirname "$0")/.."
URL="${URL:-http://127.0.0.1:8787/}"

if ! curl -s -o /dev/null --max-time 5 "$URL"; then
  echo "SWEEP ABORTED: nothing is serving $URL"
  exit 2
fi

fails=0
empty=0
total=0
suites=0
for f in scripts/verify*.mjs; do
  n=$(basename "$f")
  out=$(node "$f" 2>&1)
  p=$(printf '%s' "$out" | grep -cE '^PASS')
  x=$(printf '%s' "$out" | grep -cE '^FAIL')
  skipped=$(printf '%s' "$out" | grep -cE '^SKIP')
  suites=$((suites + 1))
  total=$((total + p))
  fails=$((fails + x))
  if [ "$x" != "0" ]; then
    echo "FAILED  $n: $p pass, $x fail"
    printf '%s' "$out" | grep -E '^FAIL' | head -5
  elif [ "$p" = "0" ] && [ "$skipped" = "0" ]; then
    # Ran and asserted nothing: a crash, a timeout, or a dead server.
    empty=$((empty + 1))
    echo "EMPTY   $n: produced no assertions"
    printf '%s' "$out" | grep -E 'Error|Timeout|ECONNREFUSED' | head -2
  fi
done

echo "---"
echo "$suites suites, $total assertions, $fails failures, $empty empty"
if ! curl -s -o /dev/null --max-time 5 "$URL"; then
  echo "NOTE: the server died during the run — earlier suites may be stale"
  exit 2
fi
[ "$fails" = "0" ] && [ "$empty" = "0" ] && echo "SWEEP OK" || echo "SWEEP NOT OK"
[ "$fails" = "0" ] && [ "$empty" = "0" ]
