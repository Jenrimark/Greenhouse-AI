# Greenhouse Agent 化改造任务清单（v1.0）

> 状态：已确认（2026-09-07）・编排层选型 
>
> **LangGraph JS**
> 关联文档：
>
> `docs/ARCHITECTURE.md`
>
> （总体架构）・本文为可执行改造清单
> 约定：每任务含子步骤（1.x）与验收标准（✅）；标注 [P1] = 阶段 1 基建、[P2] = 阶段 2 Agent 化



***

## 0. 改造总览

两条主线，依赖顺序固定：



```
阶段 1（基建，Agent 的地基）

&#x20; A 后端 TS 基座 → B PostgreSQL+建表 → C db.json 迁移 → D Redis

&#x20; → E 认证（邮箱密码） → F 业务模块 user\_id 隔离 → G 前端对接 → H 部署上线

&#x20;                                                         ↕ 可并行

阶段 2（Agent 化，本清单主体）

&#x20; A1 LangGraph 骨架 → A2 模型接入层 → A3 工具层 → A4 记忆层

&#x20; → A5 状态图 → A6 异步 worker → A7 runtime API → A8 前端 → A9 可观测/计费 → A10 测试上线
```

里程碑：



* **M1** 阶段 1 完成 = 非 Agent MVP 可上线（真实注册登录 + 数据持久化 + 规则版 AI）

* **M2** A1–A4 完成 = Agent 骨架可跑（图执行 + 工具调用 + 记忆恢复）

* **M3** A5–A8 完成 = Agent 功能上线（4 条子工作流 + 前端接入）

* **M4** A9–A10 完成 = Agent 生产就绪（计费 + 可观测 + 测试）



***

## 阶段 1・基建任务（Agent 化前置）

> 详细步骤见 
>
> `docs/ARCHITECTURE.md`
>
>  §14；本节只列与 Agent 化强相关的增量要求。



| 任务                    | 内容                                                    | Agent 相关增量                                                                               |
| --------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **A** 后端 TS 基座        | tsconfig、共享类型、zod、统一错误中间件                             | 类型定义预留 AgentState 基础类型                                                                   |
| **B** PostgreSQL + 建表 | pg 连接池 + node-pg-migrate                              | **必须同步建 §3 的四张 Agent 预留表**（conversations /messages/agent\_traces /user\_profiles），避免二次迁移 |
| **C** db.json 迁移      | 一次性脚本 + 对账                                            | 无                                                                                        |
| **D** Redis 接入        | 会话 / 限流基础封装                                           | 预留队列配置（阶段 2 异步任务用）                                                                       |
| **E** 认证（邮箱密码）        | 注册 / 登录 / 登出 + 会话 + requireAuth                       | 会话 key 结构预留 conversationId 维度                                                            |
| **F** 业务模块隔离          | opportunities /stories/resumes /account 按 user\_id 隔离 | 业务逻辑抽成 service 层（**供阶段 2 工具层复用**，不要在路由里写死）                                               |
| **G** 前端对接            | 登录页、API 适配、大 JSON 按需加载                                | 无                                                                                        |
| **H** 部署上线            | Docker、Nginx、HTTPS、CI/CD、监控                           | 镜像预留 worker 进程（阶段 2 用）                                                                   |



***

## 阶段 2・Agent 化任务（详细到每一步）

### A1. LangGraph 骨架接入

1.1 安装依赖：`@langchain/langgraph`、`@langchain/core`、`@langchain/langgraph-checkpoint-postgres`（备用 `@langchain/langgraph-checkpoint-redis`）。⚠️ 版本以 npm 官方为准，接入时核对文档。

1.2 建最小验证图：1 个节点 + `MemorySaver`，本地脚本 `invoke()` 跑通。

1.3 接真实 LLM 跑通最小 ReAct：`ChatOpenAI`（OpenAI 兼容端点）+ 1 个假工具，验证「LLM→工具→LLM」循环。

✅ 验收：本地脚本可执行图；工具调用往返正常；`node_modules` 依赖解析无冲突。

### A2. 模型接入层（ai-gateway → Agent 可用的 ChatModel）

2.1 封装工厂 `createChatModel(provider)`：统一 `ChatOpenAI({ baseURL, apiKey, model })`；DeepSeek 与豆包方舟均走各自 OpenAI 兼容端点。

2.2 供应商配置入 `.env`：`AGENT_PROVIDER` / `AGENT_MODEL` / `AGENT_BASE_URL` / `AGENT_API_KEY` + 备用 `AGENT_FALLBACK_*`；`.env.example` 同步。

2.3 降级包装：主供应商超时（默认 15s）/5xx → 自动切备用供应商，重试 1 次（指数退避）。

2.4 非对话能力（transcribe /vision）：阶段 2 保持占位，不接真实。

✅ 验收：改 `.env` 即可切换豆包 / DeepSeek；故障注入（错误 baseURL）验证降级生效；密钥不入日志。

### A3. 工具层（现有业务 → LangGraph tools）

3.1 抽取 service 层：把 F 任务里路由中的业务逻辑（opportunities /stories/resumes /account）抽为 `src/services/*`，路由与工具共用。

3.2 实现工具（zod 入参 schema + 执行函数 + 权限绑定）：



* `search_jobs(keywords, city, years)` → 岗位检索

* `add_opportunity(company, role, jd, ...)` → 新建机会

* `update_opportunity(id, stage, ...)` → 更新管线

* `list_stories()` / `add_story(title, bullets, ...)` → 经历库

* `get_user_profile()` → 用户画像

* `read_resume()` → 当前简历

* `generate_resume(target_role, jd)` → 简历生成（异步节点，见 A6）

  3.3 工具注册表：`export const agentTools = [...]`；注入图时用闭包绑定当前 `userId`，**工具内部不信任入参里的 user\_id**。

✅ 验收：每工具独立单测（无 LLM）；越权参数返回 403；工具输出结构稳定（供 LLM 消费）。

### A4. 记忆层（checkpointer + 画像 + 会话）

4.1 `PostgresSaver` 接入：checkpoint 表自动建表；会话 key = `userId + conversationId`。

4.2 消息落库：每轮 user/assistant/tool 消息写 `messages` 表（含 `tool_calls` JSONB）。

4.3 用户画像：首轮对话由 LLM 抽取（目标岗位 / 技能 / 经验年数 / 偏好）写 `user_profiles`；后续对话作为 system prompt 注入。

4.4 会话恢复：回访已有会话 → 从 checkpointer 恢复上下文继续对话。

✅ 验收：中断后 resume 上下文不丢；画像抽取字段抽查准确；会话切换互不串扰。

### A5. Agent 状态图（1 个 orchestrator + 4 条子工作流）

5.1 定义 `AgentState`：`messages[]` + `profile` + `memory` + `pendingTools` + `runMeta`。

5.2 `intent_router` 节点：LLM 分类（strategy /resume/interview /qa/chat）→ 条件边路由。

5.3 求职策略子图：`read_profile → search_jobs → evaluate_match → 推荐清单 →（用户确认）→ add_opportunity`。

5.4 简历子图：`list_stories → analyze_jd → generate_resume（异步）→ human-in-loop 确认 → save_resume`。

5.5 面试子图：`load_questions → ask_question → score_answer（Reflection）→ 复盘建议`。

5.6 问答子图：单步检索 + 回答（不落库状态）。

✅ 验收：5 条路由各 2 个测试用例（mock LLM）；意图路由准确率 ≥ 90%（抽查 20 条）；子图可独立执行。

### A6. 异步节点与 worker

6.1 引入队列（推荐 `bullmq` + Redis）：`generate_resume` 投队列。

6.2 worker 进程：消费任务 → 执行生成 → 结果写回（checkpointer + 任务表）→ 通知。

6.3 任务状态接口：`GET /api/agent/tasks/:id`（pending /running/done /failed）。

6.4 失败重试：任务失败自动重试 2 次 + 告警。

✅ 验收：简历生成期间用户可继续对话；任务状态流转正确；进程重启后任务可恢复。

### A7. Agent runtime API

7.1 `POST /api/agent/chat`：入参 `{ message, conversationId? }`；执行图；返回 `{ reply, traceSummary, conversationId }`。

7.2 流式输出（P2 增强，可后置）：SSE 推送节点进度。

7.3 安全：`requireAuth`；请求级限流（Redis）；每用户并发会话数上限 1。

7.4 错误处理：图执行异常 → 友好错误信息 + trace 落库（不泄露内部细节）。

✅ 验收：curl 冒烟全流程；未登录 401；并发超限 429；异常场景返回结构化错误。

### A8. 前端改造

8.1 助手页：对话 UI 接 `/api/agent/chat`；会话列表 / 切换（conversations 表）。

8.2 Agent 轨迹展示（可选折叠）：工具名 + 状态 + 耗时。

8.3 模拟面试页：底层改调面试子图，页面交互保持。

8.4 简历工作室：「生成」→ 异步任务轮询 → 产物回填。

✅ 验收：4 个页面端到端走通；会话切换后上下文正确；轨迹可见性符合预期（默认折叠）。

### A9. 可观测与计费

9.1 `agent_traces` 落库：每节点输入 / 输出 /token/cost/ 耗时 / 状态。

9.2 credits 计量：LLM token 用量 → 折算 credits → 写 `credits_tx`（流水可审计）。

9.3 日志：pino 结构化，`runId` 贯穿全链路；Sentry 捕获图异常。

✅ 验收：一次完整对话可在 traces 表复盘每一步；扣费与 token 用量一致；日志可按 runId 检索。

### A10. 测试与上线验收

10.1 单元测试：工具层 / 节点层；集成测试：子图（mock LLM 固定响应）。

10.2 安全测试：越权访问、prompt injection（工具注入）、限流、会话劫持。

10.3 性能：单图执行 P95 < 5s（非异步节点）；并发 20 会话稳定无内存泄漏。

10.4 上线检查清单：env 配置齐全、降级路径验证、监控告警生效、Sentry 接入。

✅ 验收：全部测试通过；灰度切真实供应商（先 10% 流量）；观察 24h 无异常后全量。



***

## 3. 数据模型增量（阶段 1 建表时同步创建）



```
\-- 会话（Agent 对话容器）

CREATE TABLE conversations (

&#x20; id         uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),

&#x20; user\_id    uuid NOT NULL REFERENCES users(id),

&#x20; title      text,

&#x20; created\_at timestamptz NOT NULL DEFAULT now(),

&#x20; updated\_at timestamptz NOT NULL DEFAULT now()

);

CREATE INDEX idx\_conv\_user ON conversations(user\_id, updated\_at DESC);

\-- 消息（每轮，含工具调用）

CREATE TABLE messages (

&#x20; id              uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),

&#x20; conversation\_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

&#x20; role            text NOT NULL CHECK (role IN ('user','assistant','tool','system')),

&#x20; content         text,

&#x20; tool\_calls      jsonb,

&#x20; tool\_results    jsonb,

&#x20; created\_at      timestamptz NOT NULL DEFAULT now()

);

CREATE INDEX idx\_msg\_conv ON messages(conversation\_id, created\_at);

\-- Agent 执行轨迹（调试 + 用户可见推理 + 计费）

CREATE TABLE agent\_traces (

&#x20; id               uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),

&#x20; run\_id           uuid NOT NULL,

&#x20; user\_id          uuid NOT NULL REFERENCES users(id),

&#x20; conversation\_id  uuid REFERENCES conversations(id),

&#x20; node             text NOT NULL,

&#x20; action           text,

&#x20; input            jsonb,

&#x20; output           jsonb,

&#x20; provider         text,

&#x20; model            text,

&#x20; prompt\_tokens    int,

&#x20; completion\_tokens int,

&#x20; cost             numeric(10,4),

&#x20; duration\_ms      int,

&#x20; status           text NOT NULL DEFAULT 'ok',

&#x20; created\_at       timestamptz NOT NULL DEFAULT now()

);

CREATE INDEX idx\_trace\_run ON agent\_traces(run\_id);

\-- 用户画像（Agent 长期记忆）

CREATE TABLE user\_profiles (

&#x20; user\_id          uuid PRIMARY KEY REFERENCES users(id),

&#x20; target\_roles     jsonb,

&#x20; skills           jsonb,

&#x20; experience\_years int,

&#x20; preferences      jsonb,

&#x20; raw              jsonb,

&#x20; updated\_at       timestamptz NOT NULL DEFAULT now()

);
```

## 4. Agent 模块目录结构（阶段 2 落位）



```
server/src/

├─ routes/            # 现有 6 路由（保持，业务逻辑已下沉 services）

├─ services/          # 业务逻辑层（阶段 1 F 抽取，路由与工具共用）

├─ lib/ai-gateway/    # 供应商配置层（阶段 2 收敛为 createChatModel + 配置）

└─ agent/

&#x20;  ├─ graph.ts        # StateGraph 定义 + 条件边

&#x20;  ├─ state.ts        # AgentState 类型

&#x20;  ├─ nodes/          # intentRouter · evaluateMatch · scoreAnswer ...

&#x20;  ├─ tools/          # searchJobs · addOpportunity ...（zod schema + 执行函数）

&#x20;  ├─ memory.ts       # PostgresSaver + 画像读写

&#x20;  ├─ runtime.ts      # /api/agent/chat 入口逻辑（图执行 + 消息落库）

&#x20;  └─ worker.ts       # 异步任务消费（bullmq）
```

## 5. 关键决策点（实施中需留意）



| #  | 决策          | 当前选择                                   | 备注                                      |
| -- | ----------- | -------------------------------------- | --------------------------------------- |
| D1 | 对话类 LLM 接入  | 统一 **OpenAI 兼容**（ChatOpenAI + baseURL） | 豆包方舟 / DeepSeek 均支持；避免 SDK 碎片化          |
| D2 | 异步队列        | **bullmq**（Redis）                      | 与现有 Redis 复用；如嫌重可换轻量方案，A6 前定            |
| D3 | 会话存储        | Postgres 为主，Redis 辅助                   | 百级用户 DB 足够；checkpointer 用 PostgresSaver |
| D4 | Agent 表建表时机 | **阶段 1 B 任务同步建**                       | 避免二次迁移（§3 SQL 直接用）                      |
| D5 | 前端轨迹展示      | 默认折叠、可选展开                              | 首版不强化，M3 后按反馈迭代                         |

## 6. 风险清单



| 风险                     | 影响        | 缓解                                        |
| ---------------------- | --------- | ----------------------------------------- |
| LangGraph 版本 / API 变动  | 代码返工      | 固定版本 + 只使用稳定 API（StateGraph/checkpointer） |
| 豆包 / DeepSeek 兼容端点差异   | 工具调用格式不一致 | A2 先做兼容性验证脚本再铺开                           |
| 意图路由准确率不足              | 用户体验差     | A5 用 mock 测试固化路由；上线后抽样调 prompt            |
| 长任务状态不一致               | 数据错误      | checkpointer + 任务表双写；A6 重启恢复验证            |
| 工具注入（prompt injection） | 越权 / 异常操作 | 工具绑定 userId、输出脱敏、A10 专项安全测试               |

## 7. 实施顺序建议（提交粒度）



```
阶段 1：A → B → C → D →（E ∥ F 并行）→ G → H        # 每个任务一个 commit，可独立验收

阶段 2：A1 → A2 → A3 → A4 → A5 → A6 → A7 → A8 → A9 → A10

&#x20;       \# A2 与 A3 可并行；A5 依赖 A2+A3+A4；A6 依赖 A5 的异步节点
```