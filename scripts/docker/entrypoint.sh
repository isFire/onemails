#!/bin/sh
set -e

# Rewriting statically built URLs at container start: VITE_* variables are
# inlined into the bundle by Vite at build time, so runtime environment
# variables alone cannot change them.

/app/scripts/replace-placeholder.sh "http://REPLACE-BACKEND-URL.com" "$VITE_PUBLIC_BACKEND_URL"
/app/scripts/replace-placeholder.sh "http://REPLACE-APP-URL.com" "$VITE_PUBLIC_APP_URL"

exec node /app/serve/node_modules/@react-router/serve/bin.js /app/apps/mail/build/server/index.js
