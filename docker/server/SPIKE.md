# SPIKE：apps/server（Cloudflare Worker）Docker 化可行性

> 状态：**PASS（实验级）** —— 判定见下。本报告所有证据均为真实执行记录（命令 + 原始输出），实测于 2026-09-04，Apple Silicon（linux/arm64 容器），wrangler 4.16.0，Docker 29.7.2。

## 一、判定

**PASS（实验级，非生产支持）。**

`apps/server` 可以在容器内以 `wrangler dev --env local`（miniflare 本地模拟）+ 真实 PostgreSQL 的方式运行，HTTP 服务、tRPC 路由、Hyperdrive→PG 数据链路全部验证通过。**但仅适用于本地开发/测试/自托管实验场景，不能替代 Cloudflare Workers 生产部署**，原因见「六、限制清单」（Workers AI 凭据、Vectorize 不支持本地绑定、KV/DO 仅本地模拟非持久等）。

## 二、结论摘要

| 项 | 结果 |
|---|---|
| `docker build -f docker/server/Dockerfile .` | ✅ 成功（glibc 基座 `node:22-slim`） |
| 容器内 wrangler dev 启动 | ✅ `Ready on http://0.0.0.0:8787` |
| `GET /health` smoke | ✅ 200 `{"message":"Zero Server is Up!"}` |
| `GET /api/trpc` smoke | ✅ 404（tRPC 规范 JSON 错误，证明路由器挂载 + 中间件链无 5xx） |
| `GET /` smoke | ✅ 302 → `VITE_PUBLIC_APP_URL` |
| Hyperdrive 覆盖机制 | ✅ 环境变量覆盖生效（wrangler 官方日志确认 + probe 实连 PG） |
| Hyperdrive→PG 真实连通 | ✅ `SELECT version()` → PostgreSQL 17.11，public 表 11 张（drizzle 迁移初始化生效） |
| DO 绑定（DurableMailbox） | ✅ 本地模拟挂载成功（仅启动验证，未做 E2E 广播） |
| KV ×4 | ✅ 本地模拟挂载成功（非持久，见限制） |
| Workers AI / Vectorize | ⚠️ 本地不可用/被剥离（见限制） |

## 三、Smoke 目标的选择依据

通读 `apps/server/wrangler.jsonc` 与 `src/main.ts`：

- 最外层 Hono app 挂了 `GET /health`（`src/main.ts:81`），**不经过** `/api/*` 的 DB/auth 中间件（`src/main.ts:18-36`），匿名可 curl，是「进程已服务」的最干净证据；
- `GET /api/trpc`（`endpoint: '/api/trpc'`，`src/main.ts:43`）在无路径/无输入时返回 tRPC 规范 **404** JSON（`TRPCError NOT_FOUND -32004`），证明 tRPC 路由器挂载且请求穿透了完整中间件链（createDb/createAuth）而未产生 5xx/连接拒绝；
- `GET /` 返回 302 重定向到 `VITE_PUBLIC_APP_URL`（`src/main.ts:82`），证明 vars 注入生效。

## 四、证据（A 级：命令 + 原始输出）

### 4.0 本机基线（非容器，先证 wrangler dev 路线本身可行）

命令（仓库根目录）：

```
pnpm --filter @zero/server exec wrangler dev --env local --port 8787 \
  --show-interactive-dev-session=false --persist-to <tmp>
```

关键启动输出（节选）：

```
- Hyperdrive Configs:
  - HYPERDRIVE: 57834ddb6716440496c8836f6d99bc9a [simulated locally]
- Services:
  - zero: zero-worker [not connected]
- AI:
  - Name: AI [connected to remote resource]

[wrangler:inf] Ready on http://localhost:8787
▲ [WARNING] Using Workers AI always accesses your Cloudflare account in order to run AI models, and so will incur usage charges even in local development.
▲ [WARNING] Vectorize local bindings are not supported yet. You may use the `--experimental-vectorize-bind-to-prod` flag to bind to your production index in local dev mode.
```

```
$ curl -i http://localhost:8787/health
HTTP/1.1 200 OK
Content-Type: application/json

{"message":"Zero Server is Up!"}

$ curl -i http://localhost:8787/api/trpc
HTTP/1.1 404 Not Found

{"error":{"json":{"message":"No procedure found on path \"\"","code":-32004,"data":{"code":"NOT_FOUND", ...}}}}

$ curl -i http://localhost:8787/
HTTP/1.1 302 Found
Location: http://localhost:3000
```

### 4.1 容器构建（pass 判据 2 之「build 成功」）

```
$ docker build --build-arg NODE_IMAGE=docker.m.daocloud.io/library/node:22-slim \
    -f docker/server/Dockerfile .
...
#17 [13/20] RUN HUSKY=0 pnpm install --no-frozen-lockfile --ignore-scripts --filter @zero/server...
#17 55.18 Done in 55s using pnpm v10.11.0
...
#25 exporting layers 11.1s done
...
#25 DONE 17.5s        ← BUILD_EXIT=0
```

（Docker Hub 直连在本网络不可达 `EOF`，故构建参数化了 `NODE_IMAGE`/`POSTGRES_IMAGE`，默认值仍为官方源。）

> 注：上方日志中的 `--no-frozen-lockfile` 是 spike 期历史记录；lockfile 失同步已由 50937d1 修复，当前镜像已恢复 `--frozen-lockfile`，见限制清单 #7。

### 4.2 关键试错记录：alpine/musl 基座不可行（为何选 slim）

第一版用 `node:22-alpine`，server 容器启动即退，原始日志：

```
✘ [ERROR] Error relocating /app/node_modules/.pnpm/@cloudflare+workerd-linux-arm64@1.20250508.0/node_modules/@cloudflare/workerd-linux-arm64/bin/workerd: fcntl64: symbol not found
✘ [ERROR] Error relocating ...workerd: _dl_find_object: symbol not found
```

原因：pnpm 装入的 workerd 发布物是 glibc 二进制，musl 下动态重定位失败。**结论：server 容器必须用 glibc 基座（node:22-slim / debian 系），alpine 不可用。**

### 4.3 容器栈启动 + Hyperdrive 覆盖生效

```
$ NODE_IMAGE=... POSTGRES_IMAGE=... docker compose -f docker/server/docker-compose.spike.yaml up --build -d
 Container zero-server-spike-db-1 Healthy
 Container zero-server-spike-server-1 Started

$ docker logs zero-server-spike-server-1
Found a non-empty WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING variable for binding. Hyperdrive will connect to this database during local development.
Using vars defined in .dev.vars
Your Worker and resources are simulated locally via Miniflare. For more information, see: https://developers.cloudflare.com/workers/testing/local-development.
--
- Durable Objects:
  - DURABLE_MAILBOX: DurableMailbox
- KV Namespaces: (×4 挂载)
- Hyperdrive Configs:
  - HYPERDRIVE: 57834ddb6716440496c8836f6d99bc9a [simulated locally]
- Services:
  - zero: zero-worker [not connected]
- AI:
  ▲ [WARNING] Using Workers AI always accesses your Cloudflare account ...
  ▲ [WARNING] Vectorize local bindings are not supported yet ...
[wrangler:inf] Ready on http://0.0.0.0:8787
```

容器内 wrangler dev 正常 Ready；`zero: zero-worker [not connected]` 为非致命告警（本 spike 未起 zero-worker，/health 与 /api/trpc 不依赖它）。

### 4.4 容器 HTTP smoke（宿主机 curl → 8787 映射端口）

```
$ curl -i http://localhost:8787/health
HTTP/1.1 200 OK
Content-Type: application/json

{"message":"Zero Server is Up!"}

$ curl -o - -w "HTTP %{http_code}\n" http://localhost:8787/api/trpc
HTTP 404
{"error":{"json":{"message":"No procedure found on path \"\"","code":-32004,"data":{"code":"NOT_FOUND", ...}}}}

$ curl -o /dev/null -w "HTTP %{http_code} -> %{redirect_url}\n" http://localhost:8787/
HTTP 302 -> http://localhost:3000/
```

### 4.5 Hyperdrive 覆盖机制的源码与运行时双重实证

**源码依据**（wrangler 4.16.0 `wrangler-dist/cli.js`）：

```js
// 行 175692-175701：local dev 下 localConnectionString 可被环境变量覆盖
if (local && connectionStringFromEnv === void 0 && hyperdrive.localConnectionString === void 0) { ... }
hyperdrive.localConnectionString = connectionStringFromEnv;
// connectionStringFromEnv 取自 WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_<BINDING>
```

**运行时依据**：4.3 节官方日志 `Found a non-empty WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING variable for binding. Hyperdrive will connect to this database during local development.`

**链路实证**（容器内 probe，使用仓库同款 `postgres` 驱动 + wrangler 实际注入 binding 的那个环境变量）：

```
$ docker compose -f docker/server/docker-compose.spike.yaml exec server \
    node /app/docker/server/probe-db.mjs
[probe] connection string: postgresql://postgres:****@db:5432/zerodotemail
[probe] OK: {"version":"PostgreSQL 17.11 on aarch64-unknown-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit","db":"zerodotemail","usr":"postgres"}
[probe] public tables: 11
```

`public tables: 11` 同时证明 compose 将 `packages/db/migrations/*.sql` 挂载为 PG 初始化脚本的方案生效（drizzle 迁移内的 `--> statement-breakpoint` 行是 PG 合法注释，可直接执行）。

### 4.6 db 容器

```
postgres:17-alpine，POSTGRES_USER=postgres / POSTGRES_PASSWORD=postgres / POSTGRES_DB=zerodotemail
STATUS: Up (healthy)   ← healthcheck: pg_isready -U postgres -d zerodotemail
```

## 五、复现步骤

```bash
# 网络可达 Docker Hub 时（默认官方镜像源）
docker compose -f docker/server/docker-compose.spike.yaml up --build -d
# Docker Hub 不可达时
NODE_IMAGE=docker.m.daocloud.io/library/node:22-slim \
POSTGRES_IMAGE=docker.m.daocloud.io/library/postgres:17-alpine \
docker compose -f docker/server/docker-compose.spike.yaml up --build -d

curl -i http://localhost:8787/health          # 预期 200
curl -i http://localhost:8787/api/trpc        # 预期 404 tRPC JSON
docker compose -f docker/server/docker-compose.spike.yaml exec server \
  node /app/docker/server/probe-db.mjs        # 预期 PG 17 + 表计数

docker compose -f docker/server/docker-compose.spike.yaml down -v   # 清理
```

## 六、限制清单（实验级的边界）

1. **非生产支持**：生产目标是 Cloudflare Workers；本镜像仅本地开发/测试/自托管实验。容器以 root 运行 wrangler dev（spike 简化，生产化需非 root + 多阶段优化）。
2. **Workers AI（binding `AI`）不可用**：wrangler 官方告警——本地调用 AI 实际访问 Cloudflare 账户并计费，需要 CF 凭据（OAuth/API token）；离线容器内 AI 调用会失败。所有走 `env.AI` 的路由（如 /api/chat、brain）在容器内不可用。
3. **Vectorize（threads-vector/messages-vector）本地绑定不支持**：wrangler 4.16.0 源码（cli.js:47522）无 flag 时直接剥离绑定（`config.bindings.vectorize = []`）仅告警；`--experimental-vectorize-bind-to-prod` 需 CF 凭据且读写生产索引（会计费/改库），自包含容器内不可用。引用 `env.VECTORIZE` 的代码路径运行时为 undefined。
4. **KV/DO 仅本地模拟、非持久**：Miniflare 本地模拟 KV×4 与 DurableMailbox，状态存容器 `/data`（persist-to），容器删除即失；与生产 Cloudflare KV/DO 行为有差异（无真实最终一致性/全球分布语义）。
5. **service binding `zero → zero-worker` 未连接**：`[not connected]` 非致命；依赖该 binding 的请求路径在容器内不可用（本 spike 未部署 zero-worker）。
6. **Hyperdrive 是本地模拟**：`[simulated locally]`——binding 直接返回连接串（即 `localConnectionString`/环境变量覆盖值），无生产 Hyperdrive 的连接池/查询加速语义。
7. **lockfile 失同步（历史问题，已解决）**：spike 期曾因 apps/mail 依赖集变化未更新锁文件（`sharp` 等未入锁文件）导致 `--frozen-lockfile` 失败，镜像被迫降级 `--no-frozen-lockfile`；已由 50937d1 同步 pnpm-lock.yaml，本镜像已恢复 `--frozen-lockfile`。
8. **`.dev.vars` 为占位密钥**（`docker/server/dev.vars.example`）：仅使 createAuth/lazy 服务可实例化，OAuth/Resend/Upstash 等外部集成本身不可用（属预期）。
9. **未覆盖的 E2E**：带真实登录态的 tRPC 业务流、DO 广播/WS（partykit）、邮件收发驱动（Gmail/Outlook）均未在容器内验证；email/password 注册在 better-auth 配置中关闭（auth.ts:120 `enabled: false`），unauth 场景无触库 HTTP 端点，DB 链路由 probe（4.5）以驱动级证据补足。

## 七、产物清单

| 文件 | 说明 |
|---|---|
| `docker/server/Dockerfile` | 实验级镜像：node:22-slim + corepack pnpm 10.11.0 + 定向 COPY + `--filter @zero/server...` 安装；`ARG NODE_IMAGE` 支持镜像源覆盖；头部已标注「实验级，非生产支持」 |
| `docker/server/docker-compose.spike.yaml` | db（postgres:17-alpine + drizzle 迁移初始化挂载 + healthcheck）+ server（Hyperdrive 连接串覆盖注入），`NODE_IMAGE`/`POSTGRES_IMAGE` 可覆盖 |
| `docker/server/probe-db.mjs` | 容器内 DB 探针：读取 wrangler 注入变量所用的连接串，用仓库同款 `postgres` 驱动执行 `SELECT version()` |
| `docker/server/dev.vars.example` | 占位密钥模板（构建时拷为容器内 `apps/server/.dev.vars`） |
| `docker/server/SPIKE.md` | 本报告 |

**域自检**：`git status` 仅含 `docker/server/**`；未修改 `apps/server/**` 任何源码（本机调试用的 `apps/server/.dev.vars` 与 `apps/server/.wrangler/` 均在 .gitignore 内，不入库）。
