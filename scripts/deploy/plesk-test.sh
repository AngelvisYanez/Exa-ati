#!/bin/sh
set -eu
exec sh "${0%/*}/plesk.sh" staging "${1:-start}"
