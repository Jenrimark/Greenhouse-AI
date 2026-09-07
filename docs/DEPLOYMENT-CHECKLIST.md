# Greenhouse 上线检查清单（M1 阶段 1 部署）

> 版本 v1.0（2026-09-07）· 对应 `docs/ARCHITECTURE.md` §5 部署架构
> 目标：阿里云 ECS + RDS PostgreSQL + OSS + ICP 备案，百级用户单机架构

## A. 资源与域名

- [ ] 注册阿里云账号并完成实名认证
- [ ] 购买域名并完成实名（ICP 备案前置）
- [ ] 启动 ICP 备案（周期约 7–20 个工作日，**与开发并行**；备案期间用 `http://ECS公网IP:80` 联调）
- [ ] 创建 ECS（2C4G，Ubuntu 22.04），安全组放行 80/443（22 仅限来源白名单）
- [ ] 创建 RDS PostgreSQL（2C2G 50GB），开启自动备份（每日全量 + binlog）；内网连接，禁止公网暴露
- [ ] （可选）创建 OSS Bucket 用于附件/简历文件；配置生命周期策略
- [ ] 备案通过后：域名解析到 ECS 公网 IP

## B. 代码与镜像

- [ ] `npm ci && npm run build`（server + client 全量构建通过）
- [ ] `npm run typecheck -w server` 无错误
- [ ] Docker 镜像构建通过：`docker build -f server/Dockerfile .`、`docker build -f client/Dockerfile .`
- [ ] CI（GitHub Actions）green：lint/typecheck/build/迁移/健康检查/镜像构建

## C. 部署步骤（ECS 上）

```bash
# 1. 安装 docker + compose 插件（或使用安装脚本）
# 2. 拉取代码
git clone <repo> && cd greenhouse
cp .env.example .env
vi .env   # 填写生产 DATABASE_URL（RDS 内网地址）、REDIS_URL、COOKIE_SECURE=true、AGENT_*（阶段 2）

# 3. 启动全栈（api 启动前自动执行数据库迁移）
docker compose up -d --build

# 4. 健康检查
curl http://localhost:80/api/health/deps   # 期望 {"postgres":"ok","redis":"ok"}

# 5. 设置种子管理员口令（吴汉东账号，仅首次）
docker compose exec -e ADMIN_SEED_PASSWORD='<强口令>' api npm run seed:admin -w server
```

## D. 域名与 HTTPS

- [ ] 备案通过后配置 Nginx 443 块（`deploy/nginx.conf` 已预留注释模板）
- [ ] 申请阿里云免费 SSL 证书（或 Let's Encrypt certbot），挂载到 nginx 容器
- [ ] `COOKIE_SECURE=true`，确认生产 Cookie 带 Secure 属性
- [ ] 页面底部展示备案号（ICP 备案完成后）

## E. 安全验收

- [ ] 注册/登录/登出全流程通过；密码哈希为 argon2id（抽查 `users.password_hash` 前缀 `$argon2id$`）
- [ ] 会话令牌随机 32B、落库为 sha256 哈希；过期会话自动清理
- [ ] 水平越权防护：用户 B 无法读写/删除用户 A 的机会/经历/简历（返回 404）
- [ ] 登录/注册接口限流生效（Redis 固定窗口，超限 429）
- [ ] 未登录访问业务接口返回 401；API 404/400/500 均为 `{ error: { code, message } }`
- [ ] 日志脱敏：访问日志不含 Cookie、口令、邮箱全文（抽查 pino 输出）
- [ ] 账号注销（`DELETE /api/account/me`）后数据级联删除

## F. 合规（PIPL）

- [ ] `/privacy` 隐私政策、`/terms` 用户协议可访问，注册页明示同意
- [ ] 账号注销与数据删除接口可用（首版物理删除）
- [ ] （二期）微信登录 openid 用途写入隐私政策

## G. 监控与备份

- [ ] RDS 自动备份已开启；备份恢复演练（文档记录）
- [ ] pino 结构化日志落盘（Docker volume 或日志服务）
- [ ] 云监控告警：CPU>80%、内存、磁盘、API 5xx 错误率阈值（阿里云云监控）
- [ ] （阶段 2 A9）Sentry DSN 配置、agent_traces 复盘

## H. 上线前冒烟

- [ ] 新用户注册 → 登录 → 建机会/经历/简历 → 登出 → 再登录数据仍在
- [ ] `docker compose restart api` 后服务自动恢复，迁移幂等
- [ ] 管理员账号（demo@greenroom.local）可登录
- [ ] 前端登录页 → 主界面端到端可用（管线/找岗位/岗位地图/经历/简历/设置）

## I. Agent 上线检查（阶段 2 A10）

- [ ] `.env` 配齐：`AGENT_PROVIDER/AGENT_MODEL/AGENT_BASE_URL/AGENT_API_KEY`（主）+ `AGENT_FALLBACK_*`（备）；`SENTRY_DSN`（可选）
- [ ] worker 独立进程/容器运行：`node dist/worker/index.js`（bullmq 消费 agent_tasks）；compose 已含 worker 服务
- [ ] 降级路径验证：主 LLM 5xx/超时 → 自动切备；全部不可用时 mock 兜底可回复
- [ ] 每用户并发锁：同时两个 Agent 请求 → 第二个 429；agent:chat 每用户限流 20 次/分
- [ ] credits 扣费：对话后 credits_tx 有流水、余额正确；余额不足返回 402（前端提示充值）
- [ ] agent_traces 可复盘：一次对话在 traces 表可按 run_id 查各节点/LLM token/耗时
- [ ] 越权复查：跨用户 conversation/task 访问均 404；工具层入参无 user_id 信任点
- [ ] 灰度切真实供应商：先 10% 流量，观察 24h 无 5xx/扣费异常后全量
- [ ] 会话恢复：服务重启后用户可继续对话（PostgresSaver 断点续跑）
- [ ] 简历异步任务：worker 崩溃后任务重试 2 次 → failed 有告警日志；前端轮询可感知
