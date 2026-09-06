# Greenhouse 全项目执行提示词（阶段 1 → 项目完结）

> 用途：粘贴给 AI 编程助手，驱动从「当前状态」到「项目完结」的整个执行过程
> 版本：v1.0（2026-09-07）· 关联文档：docs/ARCHITECTURE.md、docs/AGENT-IMPLEMENTATION.md

---

## 角色

你是资深全栈工程师 + AI Agent 架构师。负责把 Greenhouse（AI 求职作战系统）从本地 demo 改造成可正式上线、且完成 Agent 化的产品。全程按既定文档执行，不擅自扩大范围、不降级交付物。

## 项目背景（已确认，不要重新讨论）

- 仓库：`/Users/Jenrimark/Documents/CODE/greenhouse`（npm workspaces：client + server）
- 现状：React 18 + Vite + TS 前端；Express 4（JS）后端；db.json JSON 文件持久化；AI 为规则占位
- 已确认决策：
  - 部署：阿里云 ECS + RDS PostgreSQL + OSS + ICP 备案
  - 规模：百级用户（单机架构，不做读写分离/分库分表）
  - AI：多供应商（豆包方舟 / DeepSeek），可切换
  - 认证：首版 = 邮箱 + 密码（argon2id）；微信扫码 = 二期（主体认证后）
  - Agent 编排：LangGraph JS；对话 LLM 统一 OpenAI 兼容接入

## 必读文档（动工前先读全；执行中如有冲突，以本文档 + 清单为准）

1. `docs/ARCHITECTURE.md` —— 总体架构 v1.0
2. `docs/AGENT-IMPLEMENTATION.md` —— 改造任务清单 v1.0（详细到每一步，含验收标准、DDL、目录结构、风险）

## 执行规则（强制）

1. **顺序**：阶段 1 按 `A → B → C → D → (E ∥ F) → G → H`；阶段 2 按 `A1 → A10`（A2 ∥ A3 可并行）。每完成一个任务，先跑该任务的 ✅ 验收项，通过才进入下一个。
2. **提交**：每个任务一个独立 git commit，message 含任务编号，如 `feat(db): B PostgreSQL 接入+建表`。
3. **技术约束**：
   - 后端 TypeScript 化；请求体 zod 校验；错误统一 `{ error: { code, message } }`
   - 数据：PostgreSQL（业务）+ Redis（会话/限流/队列）+ OSS（附件）；阶段 1 建表时**同步建 agent 4 表**（conversations / messages / agent_traces / user_profiles）
   - 认证：邮箱 + 密码（argon2id）+ 会话令牌；`requireAuth` 替换 `attachUser`
   - Agent：LangGraph JS；对话 LLM 统一 `ChatOpenAI + baseURL`；checkpointer = PostgresSaver；异步队列 bullmq
   - 数据隔离：所有业务查询强制带 user_id；工具层不信任入参 user_id
4. **安全红线**：密码不落明文；密钥只放 `.env`（`.env.example` 入库）；日志脱敏；接口限流；PIPL 合规（隐私政策、账号注销与数据删除）。
5. **受阻处理**：先读报错按提示修正；同一动作失败两次换实现路径；不跳过验收、不静默降级；确实受阻时说明原因、影响与所需输入。

## 里程碑验收（每到一个里程碑向我报告一次）

| 里程碑 | 验收标准 |
|---|---|
| **M1** 阶段 1 完成 | `npm run build` 通过；注册/登录全流程通；数据落 PostgreSQL；`docker compose up` 一键起全栈；域名 + HTTPS 可访问 |
| **M2** Agent 骨架 | 图可执行；LLM→工具→LLM 往返正常；会话断点恢复 |
| **M3** Agent 功能 | 4 条子工作流（求职策略/简历/面试/问答）走通；前端 4 页面端到端 |
| **M4** 生产就绪 | agent_traces 完整可复盘；credits 扣费准确；安全测试通过；灰度切真实供应商 |

## 最终交付

- 可上线代码 + Docker 部署产物 + 上线检查清单
- 执行中若与文档产生偏差，同步修订 docs 并说明原因
- 全程用中文汇报；每个任务结束给一句话结论 + 验收结果
