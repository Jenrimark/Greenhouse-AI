# Greenhouse 交付核验报告

> 核验日期：2026-09-14  
> 核验基线：当前分支 `main`，报告初稿基线为 `62b3b5e`；后续修复见 Git 提交记录。  
> 报告状态：已更新；本报告不把未实际执行的项目标记为通过。

## 1. 报告目的与范围

本报告依据以下材料和当前代码状态整理：

- `README.md`：现状功能、开发方式与已知简化。
- `docs/ARCHITECTURE.md`：正式版目标架构、安全、部署与阶段出口。
- `docs/DEPLOYMENT-CHECKLIST.md`：M1 阶段部署、Agent 上线和安全清单。
- `docs/DELIVERY-AUDIT-PLAN.md`：本轮核验范围、执行顺序和验收原则。
- `docs/AGENT-IMPLEMENTATION.md`：历史 A1–A10 Agent 实施计划。
- 当前 `client/src`、`server/src`、测试脚本及 Git 历史中的阶段提交。

### 1.1 纳入范围

1. 前端页面和用户可见交互：助手、机会管线、找岗位、岗位地图、简历工作室、经历库、模拟面试、实时助手、设置。
2. 后端认证、用户隔离、机会/经历/简历、Agent runtime、异步任务、数据库、Redis、计费和可观测入口。
3. 构建、类型检查、Agent 测试、配置和部署材料。
4. 上线阻断项、未实现项和可复现的后续验收命令。

### 1.2 判定口径

- **真实**：当前代码存在可追溯的 API 或持久化链路，且本报告记录了实际核验结果。
- **部分**：主链路存在，但仍有明显本地状态、兜底、缺失子流程或环境依赖，不能按完整生产能力宣称。
- **占位**：明确使用 mock、规则、静态数据、定时器、`alert` 或返回 `501 NOT_IMPLEMENTED`。
- 历史提交信息只能作为实现线索，不能替代本次可重复验收。
- 依赖 PostgreSQL、Redis、真实 LLM、浏览器或云资源的结果，必须注明实际环境；未执行或环境不可用时标记为「未验证」。

## 2. 当前 UI 功能矩阵

| 页面 / 路由 | 当前实现 | 判定 | 证据与限制 |
|---|---|---|---|
| 登录 `/login` | 登录、游客体验入口、认证守卫 | 部分 | README 标明本地演示；正式认证代码已迁移，但本次未完成真实注册/登录环境验收。 |
| 助手 `/app` | 会话列表、切换历史、发送消息、Agent 回复、轨迹折叠 | 部分 | `client/src/screens/AssistantScreen.tsx` 调用 `/api/agent/chat`；失败显示错误。未验证真实模型、长会话恢复和生产流式输出。 |
| 机会管线 `/app/pipeline` | 列表、看板/表格、添加岗位、阶段操作 | 部分 | 后端机会服务按用户持久化的链路存在；本次未在可用 PG 环境完成端到端 CRUD 证据。 |
| 找岗位 `/app/discover` | 关键词、地点、经验、薪资、远程筛选 | 部分 | 调用 `/api/job-search`；岗位结果是确定性检索/生成，不是外部实时招聘数据。 |
| 岗位地图 `/app/atlas` | 行业、职能、岗位地图及详情 | 真实（本地数据） | 使用 `catalog.json`、`ladders.json` 按需加载；数据为仓库内静态目录，不代表实时市场数据。 |
| 简历工作室 `/app/studio` | 模板筛选、空白简历入口、AI 生成入口、任务轮询界面、服务端列表与详情编辑状态 | 部分 | `client/src/screens/StudioScreen.tsx` 已调用 `/api/resumes` 的列表、创建和详情接口；AI 完成后刷新列表。当前详情编辑器只展示 JSON，保存、导入、导出仍未闭环。 |
| 经历库 `/app/stories` | 列表、排序、新增、编辑、删除 | 部分 | 已统一 `{ data: { items } }` 解包，并通过 `/api/stories` 持久化新增、编辑和删除；本次仍未在可用 PG 环境完成浏览器刷新验收。 |
| 模拟面试 `/app/mock` | 岗位选择、风格/模式/题量、逐题作答、评分结果 | 部分 | 首题和点评调用 Agent interview 意图，失败使用内置题库与 75 分兜底；语音输入按钮仅切换录音状态，未接录音/转写服务。 |
| 实时助手 `/app/live` | 音频来源选择、轮次、转写区、提词器、快捷键展示 | 占位 | `MOCK_TRANSCRIPT` + `setInterval` 模拟转写；第二屏按钮为 `alert`；提词器字体大小/位置选择无实际状态变化；未接 `/api/transcribe`。 |
| 设置 `/app/settings` | 浅色/深色/系统主题、中文/英文、昵称 | 部分 | 主题和语言偏好写入 `localStorage`；昵称是否持久化依赖 API，本次未完成端到端验收；账号注销/隐私入口需单独验证。 |
| 命令面板 `⌘K / Ctrl+K` | 页面跳转和快捷入口 | 真实（前端） | `CommandPalette` 已接入应用外壳；不等同于后端能力验收。 |

## 3. 后端与基础设施现状

### 3.1 已具备的代码入口

- Express + TypeScript 服务，统一请求 ID、错误处理、校验和 `requireAuth` 中间件。
- PostgreSQL 连接池、迁移目录、用户/会话/机会/经历/简历/Agent 相关服务。
- Redis 客户端、会话缓存、限流和 BullMQ 队列配置。
- Agent 图、工具闭包、会话记忆/checkpointer、runtime API、任务状态 API。
- `agent_traces`、credits 扣费、`credits_tx`、pino 和条件启用 Sentry 代码入口。
- Docker Compose、API/worker/nginx 服务定义和 `.env.example`。

### 3.2 当前不能直接宣称的能力

- 没有可用的生产 PostgreSQL、Redis、真实 AI 供应商和域名/HTTPS 证据，不能宣称正式环境已上线。
- README 仍准确指出：实时转写、视觉、深层简历编辑、支付、推荐等功能没有完整真实实现。
- Compose 中 `DATABASE_URL` 已做脱敏展示，但服务环境仍通过 Compose 覆盖连接串；生产 RDS、证书、备案、备份和告警均需实际配置并留证。

## 4. 历史 A1–A10 计划对应验收

下表区分「历史提交声称的验收」和「本次核验状态」。历史提交不是本轮重新验收结果。

| 阶段 | 计划目标 | 历史实现线索 | 本次状态 |
|---|---|---|---|
| A1 | LangGraph 最小图、MemorySaver、mock/真实 ReAct 工具往返 | `d554f49` | 已有实现入口；本次未单独运行 `a1:smoke`，标记未验证。 |
| A2 | OpenAI 兼容 ChatModel 工厂、豆包/DeepSeek 切换、超时/5xx 降级 | `0f508cb` | 配置和代码存在；真实供应商切换及故障注入本次未验证。 |
| A3 | 业务工具、zod schema、userId 闭包、越权隔离 | `4a20874` | 工具测试存在；本次 `test:agent` 因数据库密码配置错误未通过，不能标记通过。 |
| A4 | PostgresSaver、消息/画像落库、会话恢复 | `41fe2bc` | 代码和 smoke 入口存在；当前测试环境未连通，未验证。 |
| A5 | orchestrator + strategy/resume/interview/qa 子图和意图路由 | `fe2bc`（历史提交为 `41fe2bc` 后的 A5 提交 `817d6c6`） | 本次 Agent 子图测试因 PG 连接失败而取消，未验证。 |
| A6 | BullMQ worker、任务状态、失败重试与重启恢复 | `20ace14` | worker、任务路由和 smoke 入口存在；未执行成功证据，未验证。 |
| A7 | `/api/agent/chat`、鉴权、限流、并发锁、结构化错误 | `3fb0133` | 路由和中间件存在；本次未完成 curl 环境验收，未验证。 |
| A8 | 助手、模拟面试、简历工作室前端接入和任务轮询 | `e603ac5` | 助手和模拟面试调用 Agent；简历页面仍有本地 state/alert 限制，判定部分，未视为完整 E2E 通过。 |
| A9 | traces、token→credits、runId、Sentry | `4ed9e9d` | 代码入口存在；本次未在真实 PG/LLM 环境核对流水、token 和 trace，未验证。 |
| A10 | 单测、集成、安全、性能、上线清单 | `d8eee03` | 历史提交声称 14+4+3 通过；本次运行 `test:agent` 未通过，不能沿用为当前通过结论。 |

> 说明：A5 行的提交线索以完整哈希 `817d6c6` 为准；表内短文本仅用于提示阶段关系。

## 5. 本次核验执行记录

### 5.1 已执行命令

| 命令 | 结果 | 证据 / 结论 |
|---|---|---|
| `npm run build` | 通过 | 服务端 TypeScript 和客户端 TypeScript/Vite 均成功；客户端构建产物已生成。 |
| `npm run typecheck -w server` | 待复跑 | 本次 build 已通过服务端 `tsc`；需单独复跑并记录独立命令结果。 |
| `npm run test:agent -w server` | 失败 | 15 个测试中 0 通过、11 失败、4 取消；主要错误为 PostgreSQL `SASL: ... client password must be a string`，测试环境数据库凭据不可用。 |
| `npm run test:security -w server` | 失败 | 未登录伪造/过期 Cookie 用例通过；其余注册、越权和限流用例因相同 PostgreSQL 认证错误失败。 |
| `npm run a10:perf -w server` | 失败 | 启动阶段因相同 PostgreSQL SCRAM 密码配置错误退出，未形成性能结论。 |
| `npm test` | 失败 | 根入口已添加并能执行 server 测试；实际结果受 PostgreSQL 测试环境阻断。 |
| 代码与文档静态核对 | 完成 | 已读取本报告列出的 README、架构、部署清单、核验计划和 Agent 计划；静态结果不能替代运行时验收。 |

### 5.2 未执行或未形成证据的项目

- `npm run a1:smoke`、`a2:smoke`、`a4:smoke`、`a5:smoke`、`a6:smoke`、`a9:smoke`。
- 生产 Docker 构建与 Compose 健康检查。
- 真实数据库迁移、备份恢复、Redis 限流、worker 重启恢复、真实供应商降级、Sentry 告警、浏览器 E2E、跨用户权限和会话劫持专项复测。
- ICP 备案、域名解析、TLS、OSS、RDS、云监控和灰度发布。

## 6. 已发现风险

### 6.1 阻断性风险

1. **当前构建已通过。** `npm run build` 在 2026-09-14 重新执行成功。
2. **Agent 测试环境不可用。** PostgreSQL 密码不是字符串，导致认证、工具和子图测试无法运行；不能据此判断功能正确。
3. **经历库与简历工作室已补齐主要持久化链路，但尚未完成真实 PG + 浏览器刷新验收。**
4. **实时助手仍为模拟功能。** 静态转写和定时器会被误认为实时语音能力，且 `/api/transcribe` 明确返回未实现。

### 6.2 高风险但需环境复核

- Compose 生产 Cookie 默认覆盖为 `COOKIE_SECURE: "false"`，HTTPS 上线前必须改为 `true` 并验证浏览器 Cookie 属性。
- 生产数据库、Redis、AI 密钥、Sentry DSN 需要通过真实 `.env` 注入；禁止把凭据写入日志或提交。
- 认证、水平越权、会话劫持、限流、账号注销级联删除需要在真实 PG/Redis 环境重新执行。
- A9 计费和 trace 依赖模型响应 token 与数据库写入，mock 结果不能作为准确扣费证据。
- ICP 备案、隐私政策、用户协议、注销/删除入口和备案号是正式上线硬前置。

## 7. 已修复项登记（可更新结构）

本节只记录已经确认的修复，不把计划当作完成。后续每条应补充提交、验证命令和结果。

| 编号 | 问题 | 修复提交 | 验证命令 / 环境 | 验证结果 | 日期 | 备注 |
|---|---|---|---|---|---|---|
| F-001 | 岗位地图加载和地图解析问题 | `35900ce` | 待补充浏览器 / 构建证据 | 未验证 | — | 历史提交已存在，需重新核验。 |
| F-002 | 经历库 API 解包 / CRUD 持久化 | `341669b` | `npm run build -w client`；`npm run typecheck -w server` | 构建和类型检查通过；真实 PG 刷新未验证 | 2026-09-14 | 已接入 POST/PATCH/DELETE，失败不更新成功状态。 |
| F-003 | 简历工作室列表、创建、详情与编辑状态 | `24af24c` | `npm run build -w client` | 构建通过；真实 PG 刷新未验证 | 2026-09-14 | 已接入列表、创建、详情和 JSON 编辑状态；保存/导入/导出未闭环。 |
| F-004 | 构建与类型检查错误 | `24af24c`、`0c3bad3` | `npm run build` | 通过 | 2026-09-14 | 服务端和客户端构建成功。 |
| F-005 | 生产配置、Cookie、Compose 健康依赖 | `dba8429` | 静态 Compose 核对 | 部分 | 2026-09-14 | 健康依赖和 Cookie 覆盖已调整；生产凭据、TLS、Docker 运行仍未验证。 |

## 8. 可执行验收命令

### 8.1 本地基础检查

```bash
npm install
npm run build
npm run typecheck -w server
```

### 8.2 Agent 与性能检查

```bash
npm run a1:smoke -w server
npm run a2:smoke -w server
npm run test:agent -w server
npm run test:security -w server
npm run a4:smoke -w server
npm run a5:smoke -w server
npm run a6:smoke -w server
npm run a9:smoke -w server
npm run a10:perf -w server
```

运行前必须提供可用的测试 PostgreSQL、Redis、迁移表和测试环境变量；否则失败只能说明环境不满足，不能判定业务失败或成功。

### 8.3 Docker / 部署检查

```bash
cp .env.example .env
docker compose up -d --build
curl http://localhost:80/api/health/deps
docker compose ps
docker compose logs --tail=200 api worker nginx
```

生产环境还需使用真实 RDS 内网 `DATABASE_URL`、Redis、`COOKIE_SECURE=true`、Agent 主备供应商配置，并执行部署清单中的 seed、HTTPS、安全和备份验收。

### 8.4 浏览器手工验收主路径

1. 登录或游客入口 → 助手页发送消息 → 刷新并切换历史会话。
2. 找岗位 → 添加机会 → 机会管线修改阶段 → 刷新确认数据仍在。
3. 经历库新增、编辑、删除 → 刷新确认服务端持久化。
4. 简历工作室创建/选择模板 → 打开详情并编辑 → 刷新确认数据仍在。
5. 模拟面试出题 → 作答 → 点评 → 完成结果；记录 Agent 可用或兜底路径。
6. 实时助手确认其状态为模拟/未实现，不得把静态转写当作真实验收通过。
7. 设置切换主题和语言，修改昵称，登出后确认业务接口返回 `401`。

## 9. 环境前置

### 9.1 本地开发

- Node.js `>=18`，npm workspaces 可用。
- 已执行 `npm install`。
- 客户端默认端口 `5173`，服务端默认端口 `8787`。
- 若运行真实后端链路，需要 PostgreSQL 16 和 Redis 7；`.env` 不入库。

### 9.2 Agent 验收

- `DATABASE_URL` 指向可登录的测试 PostgreSQL，密码必须是字符串；完成迁移。
- `REDIS_URL` 指向可用 Redis 7。
- 真实 LLM 验收需配置 `AGENT_PROVIDER`、`AGENT_MODEL`、`AGENT_BASE_URL`、`AGENT_API_KEY`；无密钥时只能核验 mock 兜底，不能宣称真实 AI。
- A9 需可查询 `agent_traces` 和 `credits_tx`；A6 需 worker 独立运行。

### 9.3 生产上线

- 阿里云 ECS、RDS PostgreSQL、Redis、OSS、域名和 ICP 备案完成。
- Nginx TLS 证书、443 配置、生产 Cookie、备份恢复演练和云监控告警完成。
- 隐私政策、用户协议、账号注销/数据删除和备案号页面完成。

## 10. 上线阻断项

在以下项目关闭前，不应宣称正式上线或全量灰度：

- [ ] `npm run build` 通过。
- [ ] `npm run typecheck -w server` 通过。
- [ ] 测试 PostgreSQL/Redis 可用，Agent 工具、子图、安全测试重新通过。
- [ ] 经历库 CRUD 和简历工作室 CRUD 完成真实 API 持久化并通过刷新验证。
- [ ] Agent runtime 的鉴权、限流、并发锁、错误结构和会话恢复有 curl/集成证据。
- [ ] worker 任务状态、失败重试、重启恢复和前端轮询有证据。
- [ ] 真实供应商主备降级、token 计费、`agent_traces`、Sentry 和 runId 链路有证据。
- [ ] Docker 镜像、Compose 健康检查、Nginx HTTPS 和生产 Cookie 完成验证。
- [ ] RDS 备份恢复、Redis、OSS、云监控和告警完成验证。
- [ ] ICP 备案、隐私政策、用户协议、注销/删除和备案号完成。
- [ ] 灰度 10% 观察窗口完成，且 24 小时无未解释的 5xx、扣费异常或数据隔离问题。

## 11. 未实现项与明确降级

以下项目当前不能按真实生产能力对外描述：

- 实时音频采集、真实语音转写、实时 AI 提词和第二屏扫码连接。
- 视觉和转写 AI 能力；旧 `/api/gen`、`/api/transcribe`、`/api/vision` 等接口明确返回 `501 NOT_IMPLEMENTED`。
- 简历导入解析、完整简历编辑器、详情打开、导出文件和附件/OSS 上传闭环。
- 微信扫码登录（架构文档规划为二期，首版应使用邮箱密码）。
- 支付、推荐分享、运营后台、自动化数据导出/删除和邮件验证。
- 外部实时招聘数据源；当前找岗位能力属于本地确定性检索/候选生成。
- 无真实 LLM 配置时，Agent 的 mock/规则兜底不等于真实 AI 服务。

## 12. 交付结论

截至 2026-09-14，本仓库具备较完整的前后端代码骨架、Agent A1–A10 的历史实现线索和部署材料，但当前核验没有达到可签署「生产上线通过」的条件。直接证据显示构建和服务端类型检查失败，Agent 测试因数据库凭据环境错误未通过；同时经历库、简历工作室和实时助手仍有明确的部分实现或占位行为。

建议下一步按以下顺序处理：

1. 先修复客户端缺失模块导入和服务端 `express` 类型错误，恢复基础构建绿灯。
2. 准备隔离的测试 PostgreSQL/Redis，完成迁移后重新运行 Agent、安全和性能验收。
3. 修复经历库与简历工作室的服务端 CRUD 和刷新持久化，再做浏览器 E2E。
4. 对实时助手、转写、视觉、导入、导出等未实现能力保持明确文案和上线范围隔离。
5. 最后按部署清单补齐生产资源、合规、监控、备份、灰度和 24 小时观察证据。
