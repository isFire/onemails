# ⚠️ 实验级 spike，非生产支持。
# 目的：验证 apps/server（Cloudflare Worker）能否在容器内以
# `wrangler dev --env local`（miniflare 本地模拟）+ 真实 Postgres 运行。
# 生产部署目标是 Cloudflare Workers，本镜像仅用于本地/自托管实验。
# NODE_IMAGE 默认官方源；Docker Hub 不可达的网络可用
# --build-arg NODE_IMAGE=docker.m.daocloud.io/library/node:22-slim 覆盖。
# 必须用 glibc 基座（slim/debian）：实测 alpine/musl 下 pnpm 装入的
# glibc 版 workerd 二进制重定位失败（fcntl64/_dl_find_object symbol not found）。
ARG NODE_IMAGE=docker.io/library/node:22-slim
FROM ${NODE_IMAGE}

# workerd（BoringSSL）出站 TLS 验证读系统 CA store（/etc/ssl/certs）；
# slim 基座在部分构建环境会缺 ca-certificates（实测 CI 产物 /etc/ssl/certs 为空，
# 导致 OAuth token 交换握手失败 invalid_code）——显式安装并刷新，不依赖基座状态。
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && update-ca-certificates && rm -rf /var/lib/apt/lists/*

# pnpm 版本与根 package.json packageManager 字段保持一致
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

WORKDIR /app

# --- 依赖层（利用层缓存：只拷 manifest 与 lockfile）---
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY patches/ patches/
COPY apps/server/package.json apps/server/
COPY packages/cli/package.json packages/cli/
COPY packages/db/package.json packages/db/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/tailwind-config/package.json packages/tailwind-config/
COPY packages/tsconfig/package.json packages/tsconfig/

# lockfile 已与 package.json 同步（含 sharp/@react-router/serve）；
# --ignore-scripts 跳过 root postinstall(nizzy sync) 与 husky。
# 仅安装 @zero/server 及其 workspace 依赖，避免拉取 apps/mail 的重型依赖。
RUN HUSKY=0 pnpm install --frozen-lockfile --ignore-scripts --filter @zero/server...

# --- 源码层 ---
COPY apps/server/wrangler.jsonc apps/server/tsconfig.json apps/server/
COPY apps/server/src/ apps/server/src/
COPY packages/db/src/ packages/db/src/
COPY packages/tsconfig/ packages/tsconfig/

# 容器内 .dev.vars：占位密钥（docker/server/dev.vars.example），
# 仅让 createAuth()/lazy 服务可实例化，不用于任何真实凭据。
COPY docker/server/dev.vars.example /app/apps/server/.dev.vars
COPY docker/server/probe-db.mjs /app/docker/server/probe-db.mjs

ENV NODE_ENV=development \
    WRANGLER_SEND_METRICS=false

EXPOSE 8787

WORKDIR /app/apps/server

CMD ["pnpm", "exec", "wrangler", "dev", "--env", "local", "--ip", "0.0.0.0", "--port", "8787", "--show-interactive-dev-session=false", "--persist-to", "/data"]
