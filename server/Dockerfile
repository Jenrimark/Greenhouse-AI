# Greenhouse API 镜像：多阶段构建（TS 编译 → 精简运行）
# 注意：使用 slim（Debian/glibc）而非 alpine（musl），保证 argon2 原生模块预编译二进制可用
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
RUN npm ci --workspace server --include-workspace-root=false || npm ci

COPY server/tsconfig.json server/
COPY server/src server/src
RUN npm run build -w server

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
RUN npm ci --workspace server --omit=dev --include-workspace-root=false || npm ci --omit=dev
COPY --from=build /app/server/dist server/dist
COPY server/migrations server/migrations
COPY server/scripts server/scripts
COPY server/tsconfig.json server/tsconfig.json

# 默认入口为 API；worker 通过覆盖 command 启动
CMD ["npm", "run", "start", "-w", "server"]
