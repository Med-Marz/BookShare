FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY services/user-service/package.json ./services/user-service/package.json
RUN npm ci --workspace=services/user-service --include-workspace-root=false --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/services/user-service/node_modules ./services/user-service/node_modules
COPY package.json package-lock.json ./
COPY services/user-service ./services/user-service
COPY proto ./proto

# Default ports — actual values come from .env via docker compose.
EXPOSE 50051 50061
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- "http://localhost:${USER_HEALTH_PORT:-50061}/health" >/dev/null || exit 1

CMD ["node", "services/user-service/src/index.js"]
