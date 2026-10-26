# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
# Chạy migration rồi mới khởi động API (an toàn khi chạy lại: migration đã chạy sẽ được bỏ qua).
CMD ["sh", "-c", "npx typeorm migration:run -d dist/database/data-source.js && node dist/main.js"]
