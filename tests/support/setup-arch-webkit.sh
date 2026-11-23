#!/usr/bin/env bash
# Playwright WebKit on Arch Linux: the bundle wants Ubuntu 24.04 ICU 74, libxml2 2.9 and libmanette.
# Downloads those three .deb files and copies the libraries into the bundle's own sys/lib.
# Run once after: PLAYWRIGHT_BROWSERS_PATH=$TMPDIR/Game/cache/ms-playwright npx playwright install chromium webkit
set -euo pipefail
cache="${TMPDIR:-/var/tmp}/Game/cache"
browsers="${PLAYWRIGHT_BROWSERS_PATH:-$cache/ms-playwright}"
pool=https://archive.ubuntu.com/ubuntu/pool/main
work="$cache/ubuntu-libs"
mkdir -p "$work/debs" "$work/root"
cd "$work/debs"
curl -fsSO "$pool/i/icu/libicu74_74.2-1ubuntu3.1_amd64.deb"
curl -fsSO "$pool/libx/libxml2/libxml2_2.9.14+dfsg-1.3ubuntu3_amd64.deb"
curl -fsSO "$pool/libm/libmanette/libmanette-0.2-0_0.2.7-1build2_amd64.deb"
for deb in *.deb; do
  tmp="$(mktemp -d)"
  (cd "$tmp" && ar x "$work/debs/$deb" && tar xf data.tar.* -C "$work/root")
  rm -rf "$tmp"
done
for dir in "$browsers"/webkit-*/minibrowser-*/sys/lib; do
  cp -an "$work"/root/usr/lib/x86_64-linux-gnu/*.so* "$dir"/
done
echo "WebKit libs installed under $browsers"
