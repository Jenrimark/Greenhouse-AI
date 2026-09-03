# Greenhouse — AI 求职作战系统

Greenroom 的本地开发环境（`https://greenroom.ungetsu.net`）：
前端使用 Vite + React + TypeScript 构建全部界面，后端使用 Express 提供本地数据与接口，
无需联网、无需真实账号即可运行。

> 说明：本项目用于本地学习与界面开发。**样式、界面文案、岗位目录数据、插画与字体**
> 参考了 Greenroom 的公开构建产物；涉及大模型的能力（对话、简历生成、语音转写等）在本地以规则/占位实现替代。

## 技术栈与目录结构

```
greenhouse/
├─ package.json            # npm workspaces 单体仓库（client + server）
├─ client/                 # 前端：Vite + React 18 + react-router-dom 6 + lucide-react
│  ├─ index.html
│  ├─ vite.config.ts       # 5173 端口，/api 代理到 8787
│  └─ src/
│     ├─ main.tsx          # 挂载 i18n / 全局数据 / 路由
│     ├─ App.tsx           # 路由表（/login 与 /app 下 9 个页面）
│     ├─ styles/
│     │  ├─ app.css        # 基于提取的编译样式构建
│     │  └─ overrides.css  # 少量补充：懒加载屏缺失样式、原生控件、工程新类
│     ├─ i18n/             # 从产物提取的中英字典（各 2975 条）+ Provider
│     ├─ data/             # catalog.json 岗位地图（43 行业 / 1443 岗位）、ladders.json
│     ├─ lib/              # api 封装、类型、主题偏好
│     ├─ components/       # Button / Select / EmptyState / 命令面板 / 添加岗位弹窗 / 像素头像
│     ├─ shell/            # 应用外壳：侧栏 AppRail、顶栏 TopBar、全局数据
│     └─ screens/          # 9 个页面
└─ server/                 # 后端：Express（ESM，零构建，node --watch 热更）
   └─ src/
      ├─ index.js          # 8787 端口；挂载 API、静态资源、生产环境 SPA 回退
      ├─ db.js             # JSON 文件持久化（server/data/db.json，防抖落盘）
      ├─ middleware.js     # 会话中间件（本地演示默认回落演示账号）
      └─ routes/           # auth / account / opportunities / stories / discover / ai
```

## 快速开始

```bash
# 1. 安装全部依赖（根目录 workspaces 会同时安装前后端）
npm install

# 2. 开发模式：同时启动后端(8787)与前端(5173)
npm run dev
# 然后浏览器打开 http://localhost:5173/app

# 3. 生产构建 + 单端口运行
npm run build      # 构建前端到 client/dist
npm start          # Express 在 8787 同时提供 API 与前端，打开 http://localhost:8787
```

也可以分开启动：`npm run dev:server` / `npm run dev:client`。

## 页面与路由

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/login` | 登录 | 支持「免登录体验演示数据」 |
| `/app` | 助手 | 分时段问候、输入框、建议 |
| `/app/pipeline` | 机会管线 | 分段 tab、表格/看板、添加岗位 |
| `/app/discover` | 找岗位 | 关键词/地点/经验/薪资/远程筛选，调 `/api/job-search` |
| `/app/atlas` | 岗位地图 | 用 catalog.json 渲染行业—职能—岗位 |
| `/app/studio` | 简历工作室 | 新建路径、我的简历、12 套模板 |
| `/app/stories` | 经历库 | 空态 + 经历列表 |
| `/app/mock` | 模拟面试 | 选岗位/重点/风格/作答方式/题量 |
| `/app/live` | 实时助手 | 音频来源、轮次、第二屏、快捷键、状态条 |
| `/app/settings` | 设置 | 主题（浅/深/跟随系统）、中英语言、昵称 |

`⌘K / Ctrl+K` 打开命令面板；侧栏可折叠；主题与语言持久化在 `localStorage`。

## 后端接口

| 方法 & 路径 | 作用 |
| --- | --- |
| `POST /api/auth/login` · `/guest` · `POST /logout` | 登录 / 游客 / 登出（本地演示） |
| `GET/PATCH /api/me` | 当前用户、改昵称 |
| `GET /api/credits` | Credits 余额（默认 300） |
| `GET/POST /api/opportunities`、`GET /summary`、`GET/PATCH/DELETE /:id` | 机会管线；新建时本地规则生成预测面试题 |
| `GET/POST /api/stories` | 经历库 |
| `POST /api/job-search` | 按关键词确定性生成候选岗位 |
| `POST /api/agent` · `/mock` · `/answer` · `/gen` · `/transcribe` · `/vision` | AI 能力的本地规则/占位实现 |

数据保存在 `server/data/db.json`（已 gitignore），删除后重启即恢复初始空态。

## 样式与数据来源

- **样式**：基于提取的编译 CSS 构建，React 组件沿用对应类名；
  懒加载屏（如简历工作室）与原生控件通过 `overrides.css` 补充。
- **文案**：从 i18n 分包导出完整中英字典（各 2975 条），运行时按 `gr_lang` 切换。
- **数据**：岗位地图使用 `catalog.json`（43 行业 / 1443 岗位）与职级通道 `ladders.json`。
- **资源**：插画（`/art`）、字体、图标、品牌字标放在 `client/public`。
- **头像**：自写确定性 `PixelAvatar`（FNV-1a + mulberry32，对称像素小人）。

## 已知简化

- 所有大模型能力为本地规则/占位，不联网、不产生真实生成结果；
- 登录不做真实鉴权，默认进入演示账号；
- 简历编辑器内部、支付、推荐、语音转写等深层流程仅保留入口与界面骨架。
