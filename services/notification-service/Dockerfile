FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY services/notification-service/package.json ./services/notification-service/package.json
RUN npm ci --workspace=services/notification-service --include-workspace-root=false --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/services/notification-service/node_modules ./services/notification-service/node_modules
COPY package.json package-lock.json ./
COPY services/notification-service ./services/notification-service
COPY proto ./proto

EXPOSE 50054 50064
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- "http://localhost:${NOTIFICATION_HEALTH_PORT:-50064}/health" >/dev/null || exit 1

CMD ["node", "services/notification-service/src/index.js"]
