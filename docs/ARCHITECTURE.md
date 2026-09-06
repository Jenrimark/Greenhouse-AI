# Greenhouse 正式版架构设计（v1.0）

> 状态：设计已确认（2026-09-07），待实施
> 适用代码基线：`bae4157`（本地 demo 版）
> 核心决策：阿里云 + ICP 备案 · 百级用户 · AI 多供应商 · 认证首版=邮箱密码（微信扫码二期）
> 2026-09-07 修订：微信扫码登录降级为二期（开放平台需企业主体认证），首版认证为邮箱 + 密码，不影响上线路径

---

## 1. 背景与目标

Greenhouse 从本地学习 demo（Express + JSON 文件持久化 + 规则占位 AI）升级为正式上线产品。目标：

- **真实多用户**：真实注册/登录，用户数据按账号隔离
- **真实数据持久化**：业务数据落 PostgreSQL，每日备份，损坏可恢复
- **真实 AI 能力**：接入豆包 / DeepSeek 等多供应商，统一网关、可切换
- **微信扫码登录**：二期支持（开放平台需企业主体认证；首版为邮箱 + 密码）
- **可部署可演进**：阿里云单机起步，模块化边界支撑后续扩展

现有代码中 `db.json` 单文件持久化、恒等会话映射、规则占位 AI 均为 demo 实现，**全部替换**，不兼容演进。

## 2. 架构原则

| 原则 | 含义 |
|---|---|
| 单体起步 | 一个 API 服务（Express + TypeScript），内部按领域拆模块，**不引入微服务** |
| 模块化边界 | auth / users / opportunities / stories / resumes / jobs / billing / ai / worker 独立路由与数据访问，接口清晰 |
| 数据层三件套 | PostgreSQL（业务）+ Redis（会话/限流/队列）+ 对象存储（附件） |
| 百级规模匹配 | 单机 ECS + 托管 RDS 即可覆盖百级用户，不做读写分离/分库分表 |
| 安全前置 | 密码哈希、会话令牌、限流、校验、日志脱敏、PIPL 合规随首版上线 |
| 可观测 | 结构化日志 + 错误追踪 + 云监控告警，上线第一天就有 |

## 3. 技术选型总览

| 层 | 选型 | 说明 |
|---|---|---|
| 前端 | React 18 + Vite + TS（现状保留） | 大 JSON 数据改按需加载 |
| 后端 | Express 4 + TypeScript（逐步迁移） | 保留现有路由结构，补类型与校验 |
| 数据库 | PostgreSQL 16（阿里云 RDS 最低配） | 自动备份、免运维 |
| 缓存/会话 | Redis 7（单实例） | 会话、速率限制、AI 任务队列 |
| 对象存储 | 阿里云 OSS | 简历附件、头像；签名 URL 直传 |
| 认证 | 邮箱+密码（argon2）+ 微信开放平台扫码 | 首版双通道 |
| AI | 豆包方舟 / DeepSeek / OpenAI 兼容 API | 适配器模式，可切换 |
| 接入层 | Nginx | TLS、静态托管、反代、限流 |
| 部署 | Docker + docker-compose + GitHub Actions CI/CD | ECS 单机 |
| 可观测 | Sentry + 结构化日志（pino）+ 云监控 | — |
| 校验 | zod | 请求体/环境变量统一校验 |

## 4. 系统架构（分层）

```
用户（浏览器 SPA，HTTPS）
  ↓
CDN（可选）/ Nginx（TLS 终止 · 静态资源 · /api 反代 · 限流）
  ↓
Greenhouse API（Express + TS 单体）
  ├─ auth       注册/登录/微信回调/登出/密码重置
  ├─ users      用户资料
  ├─ opportunities / stories / resumes / jobs / billing
  └─ ai-gateway 多供应商适配 · worker 任务队列（简历生成/面试评分）
  ↓
PostgreSQL（业务数据）· Redis（会话/限流/队列）· OSS（附件）
  ↓（出站）
AI API（豆包/DeepSeek）· 邮件服务（注册验证，二期）
横切：Sentry · pino 日志 · 云监控 · CI/CD
```

## 5. 部署架构（阿里云 + ICP 备案）

| 资源 | 规格 | 用途 |
|---|---|---|
| ECS | 2C4G，Ubuntu 22.04 | Docker 跑 Nginx + API + Worker + Redis |
| RDS PostgreSQL | 最低配（2C2G，50GB） | 业务主库，自动备份 |
| OSS | 按量 | 附件存储，CDN 可选 |
| 域名 | 1 个（需实名） | 备案 + 生产访问 |
| ICP 备案 | 阿里云备案（周期约 7–20 个工作日） | **上线硬前置，需尽早启动** |

关键点：

- **备案期间**可用 ECS 公网 IP + 临时端口开发联调；备案通过后切域名
- **Nginx 配置**：`/api` 反代到 API 容器；前端构建产物由 Nginx 托管（或 OSS+CDN）
- **HTTPS**：阿里云免费证书 / 通配符证书，TLS 1.2+
- **备份**：RDS 自动备份（每日全量 + binlog 增量），OSS 生命周期管理
- **监控告警**：CPU/内存/磁盘/接口错误率阈值告警，微信/短信通知

## 6. 认证与安全设计

### 6.1 认证通道（首版：邮箱 + 密码；二期：微信扫码）

**邮箱 + 密码（首版）**
- 注册：邮箱唯一索引，argon2id 哈希密码，首版不做邮箱验证（二期补）
- 登录：校验哈希 → 签发会话
- 会话：`sessions` 表存 token_hash + 过期时间；服务端生成随机 32 字节令牌，httpOnly cookie 下发（`SameSite=Lax`，生产 `Secure`）

**微信扫码登录（二期）**
- 前提：微信开放平台（open.weixin.qq.com）「网站应用」需**企业/组织主体认证（¥300/年）**，主体认证通过后接入
- 前端跳转 `https://open.weixin.qq.com/connect/qrconnect?...` → 用户扫码授权 → 回调携带 `code`
- 后端用 `code` 换 `access_token + openid`（`appid + secret` 仅存服务端环境变量）
- 首登：按 `openid` 查 `users.wx_openid`，无则创建用户并绑定；已存在则直接登录
- 数据模型已预留 `users.wx_openid` 唯一索引；接入时仅需新增回调路由 + 适配层，不动首版主体

### 6.2 安全基线

- 密码：argon2id（内存安全参数按 OWASP 推荐）
- 会话：令牌随机 32B、`token_hash` 落库（不存明文）、过期 + 登出吊销
- 输入校验：zod schema，所有 POST/PATCH 通过校验再进业务层
- 速率限制：Redis 令牌桶，登录接口 / AI 接口重点限流
- CORS：仅允许生产域名；CSRF 用 SameSite + Origin 校验
- 日志脱敏：不落 email 全文、token、密码；AI 请求体按需截断
- 数据隔离：所有业务查询强制带 `user_id`（SQL 层约束，杜绝水平越权）

## 7. 数据模型（PostgreSQL）

```
users            id uuid PK · email unique · password_hash · name · handle ·
                 avatar_url · wx_openid unique · credits int · status ·
                 created_at · updated_at
sessions         id uuid PK · user_id FK · token_hash · ip · user_agent ·
                 expires_at · created_at（定期清理过期）
opportunities    id uuid PK · user_id FK · company · role · jd · location ·
                 salary · stage · match · next_action jsonb · questions jsonb ·
                 rounds jsonb · due_at · created_at
stories          id uuid PK · user_id FK · title · org · start · end ·
                 bullets jsonb · tags text[] · created_at
resumes          id uuid PK · user_id FK · title · template_id · content jsonb ·
                 file_url · created_at · updated_at
credits_tx       id uuid PK · user_id FK · amount int · reason · ref_id ·
                 created_at（额度流水，审计用）
```

约定：

- 嵌套结构（questions / rounds / bullets / content）用 `jsonb` 保留，不做无谓规范化
- 全部表带 `created_at`；变更频繁表加 `updated_at`
- 索引：users.email / users.wx_openid / opportunities(user_id) / stories(user_id) / resumes(user_id) / sessions(token_hash) / sessions(user_id)
- 删除策略：首版物理删除；二期改软删除（`deleted_at`）满足 PIPL 删除响应

## 8. AI 多供应商网关（选型已确认：LangGraph JS）

> 2026-09-07 决策：Agent 编排层采用 **LangGraph JS**（状态机 + checkpointer 落 Postgres/Redis）。
> 对话类 LLM 调用统一走 OpenAI 兼容接口（`ChatOpenAI + baseURL`），ai-gateway 收敛为供应商配置层；非对话能力（transcribe/vision）阶段 2 暂保持占位。
> 完整改造任务清单见 `docs/AGENT-IMPLEMENTATION.md`。

```
ai-gateway（统一入口：对话 / mock / answer / gen / transcribe / vision）
  └─ 能力接口：chat() · generate() · transcribe() · vision() · score()
       ├─ DoubaoAdapter（火山方舟 SDK）
       ├─ DeepSeekAdapter（OpenAI 兼容）
       └─ OpenAICompatAdapter（其他兼容服务）
  └─ 配置中心：环境变量 / 配置表指定各能力默认供应商 + 备用供应商
  └─ 横切：超时 · 重试（退避）· 计费计量（写 credits_tx）· 失败降级
```

- 供应商密钥只存服务端环境变量，按能力可分别指定（如对话走豆包、转写走 DeepSeek）
- 耗时任务（简历生成、面试评分）投递 Redis 队列，worker 异步执行，前端轮询/WebSocket 拿结果
- 响应格式在适配器层统一，业务层不感知供应商差异

## 9. API 规范

- 统一前缀 `/api`，资源式路由（沿用现状并补全）
- 响应格式：成功 `{ data }` / 错误 `{ error: { code, message } }`；404/400/401/403/429/500 语义明确
- 统一错误处理中间件（替换现状默认 HTML 500）
- 鉴权中间件：`requireAuth`（校验会话）替换现 `attachUser` 恒等逻辑；`requireUser` 死代码删除
- 分页：列表接口支持 `page/pageSize`（首版机会/经历量小，仍预留）
- 健康检查 `/api/health` 保留，扩展 `/api/health/deps`（PG/Redis 连通性）

## 10. 合规（PIPL）

- 上线前必备：隐私政策、用户协议、注册时的明示同意
- 数据主体权利：提供账号注销 + 数据删除接口（首版可手工处理，二期自动化）
- 日志与备份中的个人信息脱敏
- 微信登录收集 openid 需在隐私政策中告知用途
- 备案号在页面底部展示（工信部要求）

## 11. 可观测性

- 日志：pino 结构化 JSON，请求 ID 贯穿；日志落盘 + 阿里云日志服务（或简单文件轮转）
- 错误：Sentry 前端 + 后端接入，告警阈值
- 指标：云监控（CPU/内存/磁盘/网络）+ 业务埋点（登录成功率、AI 调用失败率、接口 P99）
- 告警：错误率 > 1% / CPU > 80% 持续 5 分钟 → 通知

## 12. CI/CD

- GitHub Actions：push → lint + typecheck + 单测 → docker build → push 阿里云 ACR（或 Docker Hub）
- 发布：SSH 到 ECS → `docker compose pull && up -d` 滚动更新
- 环境：`.env` 管理密钥（不入库），`.env.example` 提交
- 迁移：数据库 schema 变更用迁移文件（`node-pg-migrate`），CI 中只读校验，发布时执行

## 13. 数据迁移（db.json → PostgreSQL）

1. 编写一次性迁移脚本：读 `server/data/db.json`，按 §7 表结构写入
2. 数据处置：现有 1 条 demo 机会、2 条 session 归入「演示账号」或作废；用户「吴汉东」转为管理员种子账号
3. 服务切换：`db.js` 替换为 `pg` 连接池 + 迁移工具，路由层数据访问改为 SQL/Repository
4. `db.json` 停止读写，保留为归档文件（gitignore 已覆盖）
5. 验证：迁移前后数据逐表对账（数量 + 关键字段抽样）

## 14. 分阶段实施计划

### 阶段 1 · 核心上线（MVP）
- [ ] 后端 TS 化 + zod 校验 + 统一错误中间件
- [ ] PostgreSQL 接入 + 迁移工具 + 建表 + db.json 迁移脚本
- [ ] 认证模块：邮箱密码注册/登录/登出 + 会话（Redis 或 DB）（微信回调移入阶段 2）
- [ ] 业务模块改造：opportunities / stories / resumes / account 按 user_id 隔离
- [ ] Redis 接入：会话 + 限流；OSS 接入：头像/附件上传
- [ ] 前端：真实 API 对接、登录页（邮箱 + 微信扫码）、大 JSON 按需加载
- [ ] 部署：Docker 化、Nginx、域名、HTTPS、阿里云备案、CI/CD
- [ ] 监控：Sentry + pino + 云监控告警
- **出口**：真实用户可注册登录（含微信扫码），核心数据持久化，AI 暂用规则版

### 阶段 2 · AI 能力
- [ ] ai-gateway + 豆包/DeepSeek 适配器
- [ ] worker 任务队列：简历生成、面试评分、对话
- [ ] credits 扣费闭环（credits_tx 流水）
- [ ] 模拟面试/实时助手接真实 AI
- [ ] 微信扫码登录（开放平台主体认证通过后，复用预留的 wx_openid 字段）
- **出口**：AI 能力真实可用，计费准确

### 阶段 3 · 增长与合规
- [ ] 运营后台、数据导出/删除自动化、隐私政策落地
- [ ] 推荐分享、支付（若商业化）
- **出口**：可持续运营

## 15. 风险与开放问题

| 风险 | 影响 | 缓解 |
|---|---|---|
| **微信开放平台需企业主体认证（¥300/年）**，个人主体无法开通 | 微信扫码无法按期上线 | **已决策**：首版邮箱密码，微信二期；主体认证通过后接入（架构已预留 wx_openid） |
| ICP 备案周期 7–20 个工作日 | 上线时间推迟 | 备案与开发并行启动；期间用 IP 联调 |
| AI 供应商 API 价格波动/限流 | 成本与稳定性 | 网关多供应商切换 + 用量监控 + credits 计费 |
| 百级规模假设偏差 | 架构需返工 | 规模上限明确，若超预期先加 Redis 缓存与 RDS 升配，架构已支持 |
| Express 4 → TS 迁移工作量 | 阶段 1 进度 | 路由层先接类型，业务逻辑增量迁移，不一次性重写 |

## 附：与现状的对应关系

| 现状 | 目标 | 处置 |
|---|---|---|
| `server/src/db.js`（JSON 防抖写盘） | PostgreSQL + Repository 层 | 替换 |
| `middleware.js attachUser`（恒等映射） | `requireAuth` + 会话校验 | 重写 |
| `routes/auth.js`（无密码校验） | 邮箱密码（首版）+ 微信扫码（二期） | 重写 |
| `routes/ai.js`（规则占位） | ai-gateway 多供应商 | 重写 |
| `client/src/data/*.json`（3.8MB 进 bundle） | 按需加载 / OSS | 改造 |
| `server/data/db.json` | 归档 | 迁移后停用 |
