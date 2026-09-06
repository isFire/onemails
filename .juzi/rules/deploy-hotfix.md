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
| env | ⚠️ **wrangler dev（4.16）只在进程启动时读一次 `.dev.vars`，reload 不重读 env**（2026-09-06 实证）：改完必须 `docker restart onemails-server`（restart ≠ recreate，可写层保留，本次冷启动仅 ~30s）。改宿主机 `server.dev.vars` 时还要**保 inode** 写入（`cat new > file` 截断重写可以；`sed -i` / 编辑器「写新文件再改名」会换 inode → 单文件 bind mount 失效，容器永久看旧内容，直到 recreate）。mount 已失效的应急：宿主机 `docker exec -i onemails-server sh -c 'cat > /app/apps/server/.dev.vars' < server.dev.vars`（容器内 `>` 保 inode）再 restart |
| 前端 apps/mail | ⚠️ 例外：SSR 跑的是 build/ 产物，得容器内重新 build 或换镜像——前端更新默认走镜像 |

## 同步纪律

- 热更前**先 commit + push**：容器是运行真相，仓库是保证可重建的源码真相。
  只热更不 push，一旦 recreate 就静默回退（本轮已踩过同类坑）。
- GitHub Actions 镜像照常构建——它是灾难恢复介质和系统级变更的载体，
  平时不 pull 不动容器。
- NAS DNS / 出网异常先查 clash（mihomo）而不是容器（本轮三次故障根因都在 clash DNS 劫持）。
- 怀疑 env 没生效先对 inode（2026-09-06 实测）：宿主机 `stat -c '%i' server.dev.vars` vs 容器内 `stat -c '%i' /app/apps/server/.dev.vars`，不一致 = 单文件 bind mount 已失效（宿主机侧换过 inode），容器看的是旧内容。

## 自装软件清单（recreate 后需重装，有新增就补）

- `ca-certificates`（2026-09-06 apt 装；workerd 出站 TLS 用，镜像层修复已在 CI 中）
- `ioredis`（2026-09-06 pnpm 装；原生 redis 支持）
- `/etc/hosts` github 钉 IP（2026-09-06 加：`140.82.113.3 github.com` + `140.82.113.6 api.github.com`；DNS 解析到死 IP 的应急，长期应在 mihomo DNS hosts 层修）

## 容器出站到 github 的坎坷（2026-09-06 全过程）

1. 容器直连 github.com 不稳的根子：**DNS 把 github.com 解析到死 IP `20.205.243.166`**（GitHub 的 Azure 新加坡段，此线路 TCP 全断），而 `140.82.11x.x` 段 TCP 通。已在容器 `/etc/hosts` 钉死：`140.82.113.3 github.com`、`140.82.113.6 api.github.com`（recreate 后需重加，见自装软件清单）。
2. 但同日中午起 **TLS 层被按概率切断**（任意 GitHub IP 握手成功率 ~1/4，TCP 层正常）——SNI/链路级干扰，OAuth 一次性回调赌不起。
3. 曾加过 iptables 透明代理（`server-net` 443 → mihomo redir 7895，规则本身工作正常，日志可见 `github→Proxy` 命中），因机场 11/11 节点全灭（含 IPv6 节点，一个机场域名 NXDOMAIN）**已撤回**。机场恢复后若要重加：`iptables -t nat -A PREROUTING -i br-<server-net-id12> -p tcp --dport 443 -j REDIRECT --to-ports 7895`（网桥名用 `docker network inspect server-net` 查）。
- 排障要点：mihomo 对 CONNECT 会立即回 `200 Connection established`（懒连接），**不代表上游节点可用**；验证节点用真实请求 `curl -x http://127.0.0.1:7899 https://github.com` 或 API `/proxies/<节点>/delay`。
- 排查顺序：容器 TCP 探测 → TLS 握手成功率 → mihomo 日志 `dial Proxy` → 节点 delay API。别在应用层瞎找。

## 速查

- server 源码 `/app/apps/server/src/`；env 宿主机 `server.dev.vars` → 容器 `.dev.vars`
- 权威 compose：`docker-compose.yaml`（compose.yaml 已废弃归档）
- redis：与 server 同 `server-net`，`redis://redis:6379`
