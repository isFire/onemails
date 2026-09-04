#!/bin/sh
set -e

# Rewriting statically built URLs at container start: VITE_* variables are
# inlined into the bundle by Vite at build time, so runtime environment
# variables alone cannot change them.

/app/scripts/replace-placeholder.sh "http://REPLACE-BACKEND-URL.com" "$VITE_PUBLIC_BACKEND_URL"
/app/scripts/replace-placeholder.sh "http://REPLACE-APP-URL.com" "$VITE_PUBLIC_APP_URL"

# The React Router server bundle bakes assetsBuildDirectory as a relative
# path ("build/client"); @react-router/serve resolves it against the process
# CWD, so we must run from the app root or every /assets/* request 404s.
cd /app/apps/mail

exec node /app/serve/node_modules/@react-router/serve/bin.js /app/apps/mail/build/server/index.js
