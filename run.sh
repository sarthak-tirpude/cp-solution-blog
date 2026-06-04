#!/usr/bin/env bash
set -euo pipefail

src="${1:-template.cpp}"
bin="bin/main"
cxx="${CXX:-c++}"
sdkroot="$(xcrun --show-sdk-path 2>/dev/null || true)"
cpp_include=()

if [[ -n "$sdkroot" && -d "$sdkroot/usr/include/c++/v1" ]]; then
  cpp_include=(-isystem "$sdkroot/usr/include/c++/v1")
fi

mkdir -p bin
"$cxx" -std=c++20 -O2 -Wall -Wextra -Wshadow -Wconversion -DLOCAL "${cpp_include[@]}" "$src" -o "$bin"
"$bin" < input.txt > output.txt
echo "Wrote output.txt"
