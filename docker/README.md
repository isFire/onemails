# Docker 镜像

本仓库发布三个镜像到 GHCR（由 `.github/workflows/docker-publish.yml` 自动构建）：

| 镜像 | 状态 | 说明 |
|---|---|---|
| `ghcr.io/isfire/onemails-app` | 生产可用 | 前端 + SSR（React Router v7 Node 运行时），多架构 |
| `ghcr.io/isfire/onemails-migrations` | 生产可用 | 数据库迁移一次性任务镜像，多架构 |
| `ghcr.io/isfire/onemails-server` | ⚠️ 实验级 spike | Cloudflare Worker 容器化实验（见下），多架构 |

## Tag 语义

| 触发 | 产出 tags |
|---|---|
| push 到 `main` | `latest`、`sha-<短 commit>` |
| push tag `v1.2.3` | `1.2.3`、`1.2`、`1`、`latest` |
| `workflow_dispatch`（分支 `foo`） | `branch-foo` |
| `pull_request` | 不推送，仅 amd64 构建验证 |

## app：主应用

最简运行（拉镜像版 compose）：

```yaml
services:
  app:
    image: ghcr.io/isfire/onemails-app:latest
    ports:
      - "3000:3000"
    environment:
      # VITE_PUBLIC_* 在构建时已内联为占位符，容器启动时由 entrypoint
      # 用以下运行时变量原地替换（见 scripts/docker/replace-placeholder.sh）。
      VITE_PUBLIC_BACKEND_URL: https://your-api.example.com
      VITE_PUBLIC_APP_URL: https://your-app.example.com
      # 与自托管 server 容器同网络时使用：SSR 内部会话代理直连，绕开
      # Docker DNAT 不回环限制；不设则回退 VITE_PUBLIC_BACKEND_URL。
      BACKEND_INTERNAL_URL: http://server:8787
      DATABASE_URL: postgresql://postgres:postgres@db:5432/zerodotemail
      REDIS_URL: http://upstash-proxy:80
      REDIS_TOKEN: upstash-local-token
```

完整环境变量清单与 db / valkey / upstash-proxy 等配套服务见仓库根的
`docker-compose.prod.yaml`。注意：`VITE_PUBLIC_*` 是 Vite 构建期内联的
URL，运行时改环境变量本身无效——镜像内已做占位符启动时替换机制，改
compose 里的这两个变量后重启容器即生效（需换域名时不用重新构建镜像）。

## migrations：数据库迁移

镜像本身无 ENTRYPOINT/CMD，需显式传 command 跑一次：

```yaml
services:
  migrations:
    image: ghcr.io/isfire/onemails-migrations:latest
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/zerodotemail
    command: ["bun", "run", "db:migrate"]
    restart: "no"
```

`docker-compose.prod.yaml` 已通过 `service_completed_successfully` 把 app
编排为等迁移成功后再启动。

## server：实验级 spike（⚠️ 非生产支持）

`ghcr.io/isfire/onemails-server` 是 `apps/server`（Cloudflare Worker）在容器
内以 `wrangler dev --env local`（miniflare 本地模拟）+ 真实 Postgres 运行的
**实验镜像**，仅用于本地开发/自托管实验；Workers AI、Vectorize 等
Cloudflare 绑定在容器内不可用或非持久。CI 对该镜像**构建失败不阻塞**其余
两个镜像的发布（`continue-on-error`）。

本地体验请用 spike compose（自带 PG 与探针脚本）：

```bash
docker compose -f docker/server/docker-compose.spike.yaml up --build -d
curl -i http://localhost:8787/health
```

背景与限制清单见 `docker/server/SPIKE.md`。

## 多架构说明

除 PR 构建验证外，所有镜像均构建 `linux/amd64` + `linux/arm64`；arm64 走
QEMU 模拟，构建偏慢属预期（工作负载为纯 JS，无原生编译）。
