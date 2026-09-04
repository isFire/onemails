## [0.1.1(20260904)] - 2026-09-04

- docker(scripts): 评审返工——replace-placeholder 空 TO 守卫 exit 1、& 与反斜杠预转义、grep 错误不再吞且零命中告警(P1)
- docker(server): 评审返工——spike compose 默认基座 alpine 改 slim(P0，musl 下 workerd 必崩)、恢复 --frozen-lockfile(P1)、SPIKE 限制#7 改写为已修复
- ci(docker): GHCR 多架构发布 workflow + 镜像文档 + .dockerignore 补本地构建产物
- docker(app): React Router v7 Node 双目标构建 + 镜像重写——vite 按 DOCKER_BUILD 开关 CF 插件、cloudflare:workers shim、workers-og 降级 stub、placeholder 启动时替换、非 root 运行
- docker(server): miniflare 容器化 spike PASS（实验级）——容器内 wrangler dev+真实 PG 全链路验证，musl/glibc 根因固化，限制清单入 SPIKE.md
- docker/db: 单段 lockfile 声明式安装，消除显式装包版本漂移
- Update link format in README.md
- Add website link to README
- Update README with project title and description
- Ignore .env file in .gitignore
- original license
- first commit

