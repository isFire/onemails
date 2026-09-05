# 交接快照（2026-09-06 凌晨，自 harness 会话移交）

> 新会话读本文件即可接续。运行模型规则见 `.juzi/rules/deploy-hotfix.md`（容器即主机）。

## 本轮已完成

1. **GitHub OAuth 登录接入**（add-feature 流水线已走完，台账 5/5 verify 真跑通过）
   - 代码：`auth-providers.ts` 加 github 条目（required:false）、`auth.ts` connectionHandlerHook 非邮箱 provider 直接 return、登录页 GitHub 图标、首页 Sign in 改 /login 选择页
   - 凭据：`GITHUB_CLIENT_ID/SECRET` 在 NAS `server.dev.vars`（Ov23litloqGfDH3RVVsg）
   - 前端镜像 `ed9d758` 已部署；登录页三按钮（Google/Microsoft/GitHub）实测在
2. **三道线上故障已修**（全部有仓库提交）
   - `invalid_code`：容器缺 CA 根证书 → 已 apt 装 301 根 + Dockerfile 持久修（`ec0be84`）
   - session 500：`REDIS_URL` 是 dummy upstash → 改 `redis://redis:6379` + `services.ts` 原生 redis 支持 ioredis（`ff9d2fa`），容器内已 pnpm 装好 ioredis 并自测读写通过
   - 首页硬跳 Google：改 /login 选择页（`ed9d758`）
3. **配置治理**：`docker-compose.yaml` 确认为唯一权威（zero 段已加 `env_file: server.dev.vars`）；旧 `compose.yaml` 已归档 `.deleted-20260906`

## 待办（按优先级）

1. **GitHub 登录端到端实测**：ioredis 热更后用户还未再试。路径：强刷 → 首页 Sign in → Continue with GitHub → 授权 → 应登录成功（createSession 现在写本地 redis）
2. **登录后无邮箱源**：GitHub 只是身份。需在「设置 → 连接」连 Microsoft（需 Azure 注册）或 Google 邮箱
3. **Microsoft 按钮是 dummy 凭据**（点了必败）：要么 Azure 注册真凭据，要么 server 代码把 microsoft `required:true` 改 false 并删 dummy env（注意 required 缺 env 会让 server 启动 throw，两步必须一起）
4. **新镜像未部署**：CI 已出含 CA+ioredis+auth 的 server 镜像；按「容器即主机」模型不急，recreate 时记得 ~28 分钟 wrangler 冷启动 + 按 deploy-hotfix.md 自装软件清单核对
5. 小瑕疵：GitHub 授权 URL 里 scope 重复（`read:user user:email` ×2，Better Auth 默认+显式叠加，无害）——可把 auth-providers.ts github 条目的 `scope` 字段删掉

## NAS 关键事实

- 服务：`onemails-app`（SSR，:3000）、`onemails-server`（wrangler dev，:8787）、`onemails-db`（migrations）
- 入口：lucky 反代 `:441`，域名只有 AAAA 记录（**纯 IPv6 直连，IPv4 网络打不开**）
- redis 容器与 server 同 `server-net`；`server.dev.vars` bind mount 至容器 `.dev.vars`
- 故障排查先查 clash（mihomo）：本轮 docker pull / apt / pnpm 三次故障根因全是 clash DNS 劫持状态
- xterminal 凭据在 Xterminal 应用内（`~/.ssh/config` 无 NAS 条目，Mac 直连 scp 不通）

## juzi 状态

- 本仓库 `.juzi/` 尚未提交过（untracked）；本轮 add-feature 流水线已收官
- 全局语言兜底已写 `~/.config/opencode/AGENTS.md`（默认中文）
