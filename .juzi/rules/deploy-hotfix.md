---
scope: [on-demand]
---

# onemails 运行模型：容器即主机——不更新操作系统（镜像），只更新软件

> 2026-09-06 与用户定的运行模型：**容器就是一台长期存续的 Linux 主机**。
> 日常所有更新（代码 / npm 依赖 / env）都在容器内直接做；
> 镜像只是装机快照与灾难恢复介质，不是日常更新路径。

## 模型成立的前提：容器可写层只死于 recreate

docker 容器可写层在 **restart / stop / start / 宿主重启** 后都还在；
只有以下情况才丢——这些就是本模型的"系统级变更"，要当成重装系统来对待：

- `docker compose pull` + `up`（镜像变了 → recreate）
- compose 文件字段变化后 `up`（env/ports/volumes 任何差异 → recreate）
- 手动 `docker rm`

**纪律：任何会触发 recreate 的操作 = 重装系统，必须先经用户确认，且先确认
"容器里有哪些自装软件需要重装清单"（本文件末节维护这份清单）。**

## 日常更新（容器内做，秒级生效）

| 变更 | 做法 |
|---|---|
| server 源码 | base64 / docker cp 写入容器 → wrangler dev watch 自动 reload |
| npm 依赖 | 容器内 `pnpm add`（**必须带代理** `HTTPS_PROXY=http://172.17.0.1:7899`，裸连 npmjs 经 clash TUN 会 ECONNRESET）；后台 + 日志，别用前台长命令 |
| env | 改宿主机 `server.dev.vars`（bind mount，wrangler 监听自动 reload） |
| 前端 apps/mail | ⚠️ 例外：SSR 跑的是 build/ 产物，得容器内重新 build 或换镜像——前端更新默认走镜像 |

## 同步纪律

- 热更前**先 commit + push**：容器是运行真相，仓库是保证可重建的源码真相。
  只热更不 push，一旦 recreate 就静默回退（本轮已踩过同类坑）。
- GitHub Actions 镜像照常构建——它是灾难恢复介质和系统级变更的载体，
  平时不 pull 不动容器。
- NAS DNS / 出网异常先查 clash（mihomo）而不是容器（本轮三次故障根因都在 clash DNS 劫持）。

## 自装软件清单（recreate 后需重装，有新增就补）

- `ca-certificates`（2026-09-06 apt 装；workerd 出站 TLS 用，镜像层修复已在 CI 中）
- `ioredis`（2026-09-06 pnpm 装；原生 redis 支持）

## 速查

- server 源码 `/app/apps/server/src/`；env 宿主机 `server.dev.vars` → 容器 `.dev.vars`
- 权威 compose：`docker-compose.yaml`（compose.yaml 已废弃归档）
- redis：与 server 同 `server-net`，`redis://redis:6379`
