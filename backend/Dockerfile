# ---- 构建阶段 ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --registry=https://registry.npmmirror.com
COPY . .
RUN npm run build

# ---- 运行阶段 ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev --registry=https://registry.npmmirror.com
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
