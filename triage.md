# triage: GitHub OAuth 登录接入(2026-09-05)

## 类型判定
add-feature —— 新增 GitHub 作为登录身份 provider。用户不想用 Google 登录;GitHub 只作身份,不作邮箱源(无邮件 API、无 refreshToken)。

## 方案(已经源码审查并与用户对齐)
- auth-providers.ts 加 github 条目(required:false)
- auth.ts connectionHandlerHook 加 guard:非 google/microsoft 直接 return(否则 GitHub 无 refreshToken 在 hook 第一关炸、createDriver('github') 第二关炸)
- login-client.tsx getProviderIcon 加 github case(icons.tsx 已有 GitHub 组件)
- 邮箱连接列表(emailProviders 前端硬编码)不受影响
- 部署:push main → CI 构建 GHCR → NAS pull + server.dev.vars 填 GITHUB_CLIENT_ID/SECRET + 重启
- 用户负责注册 GitHub OAuth App(callback: https://onemails-api.qingtangbaimian.cn:441/api/auth/callback/github)

## 边界
不动:driver 层、emailProviders 常量、account linking trustedProviders。
已知限制:GitHub 登录后无邮箱源,收发邮件仍需另连 Microsoft/Google。
