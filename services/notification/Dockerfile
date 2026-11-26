# Notification service (ADR-15 bước 1). Không có thư viện native nên dùng Alpine cho image nhỏ.
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
RUN apk upgrade --no-cache
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3200
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=10 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3200)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
