#!/usr/bin/env bash
set -euo pipefail

src="${1:-template.cpp}"
name="$(basename "$src" .cpp)"
test_dir="${2:-tests/$name}"
bin="bin/main"
cxx="${CXX:-c++}"
sdkroot="$(xcrun --show-sdk-path 2>/dev/null || true)"
cpp_include=()

if [[ -n "$sdkroot" && -d "$sdkroot/usr/include/c++/v1" ]]; then
  cpp_include=(-isystem "$sdkroot/usr/include/c++/v1")
fi

mkdir -p bin
"$cxx" -std=c++20 -O2 -Wall -Wextra -Wshadow -Wconversion -DLOCAL "${cpp_include[@]}" "$src" -o "$bin"

if [[ ! -d "$test_dir" ]]; then
  echo "No test directory found: $test_dir"
  echo "Create tests like: $test_dir/1.in and $test_dir/1.out"
  exit 1
fi

shopt -s nullglob
inputs=("$test_dir"/*.in)

if [[ ${#inputs[@]} -eq 0 ]]; then
  echo "No .in files found in $test_dir"
  echo "Create tests like: $test_dir/1.in and $test_dir/1.out"
  exit 1
fi

passed=0
total=0

for input in "${inputs[@]}"; do
  total=$((total + 1))
  expected="${input%.in}.out"
  actual="$(mktemp)"

  "$bin" < "$input" > "$actual"

  if [[ ! -f "$expected" ]]; then
    echo "[$total] $(basename "$input"): missing expected file $(basename "$expected")"
    echo "Output:"
    cat "$actual"
    rm -f "$actual"
    continue
  fi

  if diff -u -w -B --strip-trailing-cr "$expected" "$actual" >/dev/null; then
    echo "[$total] $(basename "$input"): OK"
    passed=$((passed + 1))
  else
    echo "[$total] $(basename "$input"): WA"
    diff -u -w -B --strip-trailing-cr "$expected" "$actual" || true
  fi

  rm -f "$actual"
done

echo "$passed/$total passed"

if [[ "$passed" -ne "$total" ]]; then
  exit 1
fi
