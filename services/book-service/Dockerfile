FROM node:20-alpine AS deps
WORKDIR /repo
ENV NPM_CONFIG_FETCH_TIMEOUT=600000
ENV NPM_CONFIG_FETCH_RETRIES=5
ENV NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000
COPY package.json package-lock.json ./
COPY services/book-service/package.json ./services/book-service/package.json
RUN npm ci --workspace=services/book-service --include-workspace-root=false --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY services/book-service ./services/book-service
COPY proto ./proto

EXPOSE 50052 50062
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- "http://localhost:${BOOK_HEALTH_PORT:-50062}/health" >/dev/null || exit 1

CMD ["node", "services/book-service/src/index.js"]
