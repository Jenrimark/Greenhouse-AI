# 项目工作状态存档

> **存档时间**：2026-09-03  
> **存档人**：Crow5  
> **项目状态**：功能开发完成，待验证

---

## 项目概要

**Greenhouse** — Greenroom AI 求职作战系统的本地开发环境。  
前端 React + Vite + TypeScript，后端 Express + JSON 文件持久化，无需联网即可运行。

| 项 | 值 |
|---|---|
| 工作目录 | `/Users/Jenrimark/Documents/CODE/greenhouse` |
| 前端端口 | 5173（开发）/ 8787（生产） |
| 后端端口 | 8787 |
| Node 要求 | ≥ 18 |
| 数据库 | `server/data/db.json`（JSON 文件，防抖落盘） |

---

## 已完成内容

### 前端（client/）

| 模块 | 状态 | 说明 |
|---|---|---|
| 项目骨架 | ✅ | npm workspaces 单体仓库，Vite + React 18 + TS |
| 路由系统 | ✅ | react-router-dom v6，10 个路由（login + 9 个页面） |
| 应用外壳 | ✅ | AppLayout / AppRail（可折叠侧栏）/ TopBar |
| 国际化 | ✅ | 中英双语字典各 2975 条，localStorage 切换 |
| 主题系统 | ✅ | 浅色 / 深色 / 跟随系统，localStorage 持久化 |
| 命令面板 | ✅ | `⌘K / Ctrl+K` 触发 |
| 像素头像 | ✅ | 确定性算法（FNV-1a + mulberry32）替代 DiceBear |
| 样式层 | ✅ | 基于提取的编译 CSS 构建主题，overrides.css 补充懒加载屏与原生控件 |

**10 个页面**：

| 路由 | 页面 | 关键能力 |
|---|---|---|
| `/login` | 登录 | 免登录演示入口 |
| `/app` | 助手 | 分时段问候、输入框、建议 |
| `/app/pipeline` | 机会管线 | 分段 tab、表格/看板、添加岗位弹窗 |
| `/app/discover` | 找岗位 | 关键词/地点/经验/薪资/远程筛选 |
| `/app/atlas` | 岗位地图 | catalog.json 渲染行业→职能→岗位 |
| `/app/studio` | 简历工作室 | 新建路径、我的简历、12 套模板 |
| `/app/stories` | 经历库 | 空态 + 经历列表 |
| `/app/mock` | 模拟面试 | 选岗位/重点/风格/作答方式/题量 |
| `/app/live` | 实时助手 | 音频来源、轮次、第二屏、快捷键 |
| `/app/settings` | 设置 | 主题、语言、昵称 |

**6 个组件**：Button / Select / EmptyState / CommandPalette / AddRoleDialog / PixelAvatar

### 后端（server/）

| 模块 | 状态 | 说明 |
|---|---|---|
| Express 服务 | ✅ | 8787 端口，JSON body 8MB 限制 |
| 数据库 | ✅ | JSON 文件持久化，进程内缓存 + 120ms 防抖落盘 |
| 会话中间件 | ✅ | Cookie 认证，本地演示默认回落演示账号 |
| 静态资源托管 | ✅ | client/public + client/dist，7 天缓存 |
| SPA 回退 | ✅ | 非 /api 路径全部返回 index.html |

**6 个路由模块**：

| 路由文件 | 端点 | 说明 |
|---|---|---|
| `auth.js` | POST /api/auth/login, /guest, /logout | 登录/游客/登出 |
| `account.js` | GET/PATCH /api/me, GET /api/credits | 用户信息、Credits |
| `opportunities.js` | CRUD /api/opportunities, GET /summary | 机会管线 + 汇总统计 |
| `stories.js` | CRUD /api/stories | 经历库 |
| `discover.js` | POST /api/job-search | 按关键词确定性生成候选岗位 |
| `ai.js` | POST /api/agent, /mock, /answer, /gen, /transcribe, /vision | AI 能力占位接口 |

### 开发工具链

| 工具 | 状态 |
|---|---|
| `npm run dev` | ✅ 前后端并行启动（concurrently） |
| `npm run build` | ✅ 前端 tsc + vite build |
| `npm start` | ✅ 生产单端口运行 |
| Vite 代理 | ✅ /api → localhost:8787 |

---

## 待验证内容

| # | 项目 | 优先级 |
|---|---|---|
| 1 | `npm run build` 构建是否成功 | 🔴 高 |
| 2 | `npm run dev` 启动后各页面交互是否正常 | 🔴 高 |
| 3 | 数据库 CRUD + 防抖写入是否稳定 | 🟡 中 |
| 4 | 跨浏览器 CSS 一致性 | 🟡 中 |
| 5 | 大文件加载性能 | 🟢 低 |

---

## 下一步建议

### 短期
1. 运行 `npm run build` + `npm run dev` 验证构建与运行
2. 逐页面走查交互流程
3. 清理未使用导入、补充类型定义

### 中期
1. TypeScript 逐步启用严格模式
2. 引入轻量状态管理（Zustand）
3. 添加关键路径单元测试

### 长期
1. 接入真实大模型 API
2. 真实认证系统
3. Docker 容器化部署

---

## 技术债务

1. TypeScript `strict: false`，需逐步启用
2. 状态管理仅 Context + useState
3. `requireUser` 中间件未使用，生产需真实鉴权
4. 全局 CSS 无模块化

---

## 快速启动

```bash
npm install
npm run dev
# 浏览器打开 http://localhost:5173/app
```
