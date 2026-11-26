# Assistant service (UC6, ADR-15, ADR-16). Debian slim vì onnxruntime-node (chạy EmbeddingGemma) cần glibc, không chạy
# trên Alpine (musl).
# ---- build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build
# Tải sẵn model vào image: lúc chạy service không gọi Hugging Face (allowRemoteModels = false).
# Nếu kho model đòi đăng nhập: docker build --secret id=hf_token,env=HF_TOKEN ...
ENV ASSISTANT_MODEL_DIR=/app/.model-cache
RUN --mount=type=secret,id=hf_token,required=false \
    sh -c 'if [ -f /run/secrets/hf_token ]; then export HF_TOKEN="$(cat /run/secrets/hf_token)"; fi; node dist/cli/download-model.js'
RUN npm prune --omit=dev

# ---- runtime ----
FROM node:20-bookworm-slim
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    ASSISTANT_MODEL_DIR=/app/.model-cache
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build --chown=node:node /app/.model-cache ./.model-cache
COPY package.json ./
USER node
EXPOSE 3100
HEALTHCHECK --interval=10s --timeout=3s --start-period=60s --retries=10 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3100)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
