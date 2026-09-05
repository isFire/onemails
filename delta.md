# delta: GitHub OAuth 增量改动方案

## 决策卡
- **判据**:不动邮箱连接语义(GitHub 不是邮箱源);不引入新的启动硬依赖(required:false);最小行数。
- **考虑过的方案**:
  - A. GitHub 仅登录(本方案):auth-providers 加条目 + hook guard + 前端图标。
  - B. Microsoft 邮箱源:代码已支持但需 Azure 注册(用户暂缓,凭据仍是 dummy)。
  - C. emailAndPassword 开放:Better Auth 已启用该段,零改动,但作为主登录方式弱于 OAuth,留作备选不动。
  - 否决 D. 给 GitHub 写 driver:GitHub 无邮件 API,物理不成立。
- **推荐**:A,理由:满足"摆脱 Google 登录"诉求,改动 ~30 行,风险面三处小文件。

## 改动清单
1. apps/server/src/lib/auth-providers.ts:加 github 条目(GITHUB_CLIENT_ID/SECRET,scope read:user user:email,required:false)。
2. apps/server/src/lib/auth.ts:connectionHandlerHook 开头 guard——providerId 非 google/microsoft 直接 return。
3. apps/mail/(auth)/login/login-client.tsx:getProviderIcon 加 case 'github' 复用 icons.tsx GitHub 组件。
4. 部署:NAS server.dev.vars 加 GITHUB_CLIENT_ID/SECRET(用户注册 GitHub OAuth App 提供);push main 走 CI。
## 验证
typecheck 双端过;线上 signin/social provider=github 返回 github.com/login/oauth/authorize 授权 URL。
