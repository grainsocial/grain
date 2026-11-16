#!/bin/sh
# That harness/answers.mjs holds answers to their lexicons: the answers in
# answers-test/right pass against answers-test/lexicons, and each of those
# in answers-test/wrong is named, so a check that passes is one that looked.
set -u
cd "$(dirname "$0")"
lexicons=answers-test/lexicons
node answers.mjs answers-test/right "$lexicons" || { echo "answers-test: right answers were refused"; exit 1; }
out=$(node answers.mjs answers-test/wrong "$lexicons") && { echo "answers-test: wrong answers passed"; exit 1; }
failed=0
for expected in \
  '/xrpc/_health (200): _health answers {version}' \
  '/xrpc/test.grain.getThing?actor=a (200): Output/name must be a string' \
  '/xrpc/test.grain.getThing?nope=1 (200): nope is no parameter of test.grain.getThing' \
  '/xrpc/test.grain.getThing (400): a failure is {error, message}' \
  '/xrpc/test.grain.missing (200): no lexicon names this method'
do
  printf '%s\n' "$out" | grep -qxF "$expected" || { echo "answers-test: not said: $expected"; failed=1; }
done
[ "$failed" = 0 ] || { printf 'it said:\n%s\n' "$out"; exit 1; }
echo "answers-test: the wrong answers are each named"
