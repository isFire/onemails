# NOTE: the upstream bun.lock only covers the root + packages/* workspaces;
# the complete dependency graph (apps/* + the "novel" patch) lives in
# pnpm-lock.yaml, so this image installs with pnpm, not bun.

# ========================================
# Base Stage: Alpine Linux with Node
# ========================================
FROM node:22-alpine AS base

# ========================================
# Dependencies Stage: Install Dependencies
# ========================================
FROM base AS deps
RUN corepack enable
WORKDIR /app

# Workspace manifests only (no sources) for maximal layer caching
COPY --parents package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc patches/ apps/*/package.json packages/*/package.json scripts/package.json ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# ========================================
# Builder Stage: Build the Application
# ========================================
FROM base AS builder
RUN corepack enable
WORKDIR /app

# Bring the installed dependency tree (root + per-workspace node_modules)
COPY --from=deps /app ./
# Then the actual sources (context has no node_modules, see .dockerignore)
COPY . .
RUN rm -rf apps/mail/build apps/mail/.react-router

# The SSR bundle is built self-contained for Node; the VITE_* URLs are
# baked as placeholders and rewritten at container start (entrypoint.sh).
ENV DOCKER_BUILD=true \
    NODE_ENV=production \
    VITE_PUBLIC_BACKEND_URL=http://REPLACE-BACKEND-URL.com \
    VITE_PUBLIC_APP_URL=http://REPLACE-APP-URL.com
RUN pnpm --filter @zero/mail run build

# @react-router/serve pinned to the exact version resolved in the lockfile
# (matches the react-router version compiled into the SSR bundle)
RUN mkdir -p /serve && cd /serve \
    && npm install --omit=dev --ignore-scripts --no-audit --no-fund @react-router/serve@7.6.0

# ========================================
# Runner Stage: Production Environment
# ========================================
FROM base AS runner
WORKDIR /app

RUN addgroup -S -g 1001 nodejs && \
    adduser -S -u 1001 -G nodejs nextjs

ENV NODE_ENV=production \
    PORT=3000

# Copy entrypoint and placeholder replacement scripts
COPY scripts/docker/ /app/scripts/
RUN chmod +x /app/scripts/*.sh

# SSR bundle (build/server) + client assets (build/client)
COPY --from=builder --chown=nextjs:nodejs /app/apps/mail/build ./apps/mail/build

# react-router-serve runtime (express and its small dependency closure)
COPY --from=builder --chown=nextjs:nodejs /serve/node_modules ./serve/node_modules

USER nextjs

EXPOSE 3000

CMD ["/app/scripts/entrypoint.sh"]
