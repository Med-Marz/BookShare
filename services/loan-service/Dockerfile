FROM node:20-alpine AS deps
WORKDIR /repo
ENV NPM_CONFIG_FETCH_TIMEOUT=600000
ENV NPM_CONFIG_FETCH_RETRIES=5
ENV NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000
COPY package.json package-lock.json ./
COPY services/loan-service/package.json ./services/loan-service/package.json
RUN npm ci --workspace=services/loan-service --include-workspace-root=false --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY services/loan-service ./services/loan-service
COPY proto ./proto

EXPOSE 50053 50063
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- "http://localhost:${LOAN_HEALTH_PORT:-50063}/health" >/dev/null || exit 1

CMD ["node", "services/loan-service/src/index.js"]
