# comprehend: onemails 认证与邮箱连接现状(2026-09-05 源码实测)

## 系统形态
自托管 0.email fork:apps/server(Hono + Better Auth 1.2.8 + drizzle) + apps/mail(React 前端)。
部署:NAS docker(onemails-server/app/db),CI=GitHub Actions → GHCR,push main 发 latest。
线上:https://onemails-app/api.qingtangbaimian.cn:441(auth basePath 默认 /api/auth,实测 /auth/* 404、/api/auth/* 302)。

## 认证与连接的现状约束
- socialProviders 由 auth-providers.ts 按 env 非空过滤生成;google/microsoft 均 required:true(缺 env 启动 throw)。
- databaseHooks.account.create/update.after = connectionHandlerHook:任何 social 账号都尝试写成 connection 表「邮箱连接」——先查 accessToken+refreshToken,再 createDriver(providerId)。
- driver/index.ts supportedProviders 仅 {google, microsoft};未知 providerId throw 'Provider not supported'。
- GitHub OAuth 无 refreshToken → 现 hook 下 GitHub 登录必炸(两关)。
- 前端登录按钮数据驱动(providers 列表);邮箱连接列表 emailProviders 为前端硬编码常量(仅 Gmail/Outlook),不受后端 provider 增加影响。
- icons.tsx 已有 GitHub 图标组件可复用。
- account.accountLinking.trustedProviders = ['google','microsoft']。
- NAS server.dev.vars 现有 MICROSOFT_*=dummy(isProviderEnabled 只判非空,dummy 也算启用——前端按钮会显示但点了必败,本轮顺带由 GitHub 真值替代其展示价值);ICLOUD 段为注释死代码。
