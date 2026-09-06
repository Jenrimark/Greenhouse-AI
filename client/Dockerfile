# Greenhouse 前端镜像：构建静态产物 → nginx 托管
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
RUN npm ci --workspace client --include-workspace-root=false || npm ci

COPY client/ client/
RUN npm run build -w client

FROM nginx:1.27-alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
RUN chmod -R a+rX /usr/share/nginx/html   # 归一化静态文件权限（宿主 600 权限会导致 nginx 403）
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
