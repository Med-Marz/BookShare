FROM node:20-alpine AS deps
WORKDIR /repo
# Increase npm fetch timeouts/retries — protects parallel Docker builds from
# transient network slowness when several services run `npm ci` simultaneously.
ENV NPM_CONFIG_FETCH_TIMEOUT=600000
ENV NPM_CONFIG_FETCH_RETRIES=5
ENV NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000
COPY package.json package-lock.json ./
COPY apps/gateway/package.json ./apps/gateway/package.json
RUN npm ci --workspace=apps/gateway --include-workspace-root=false --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
# npm workspaces hoists every dep to /repo/node_modules at install time, so the
# runtime image only needs that one tree (no per-workspace node_modules).
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/gateway ./apps/gateway
# Gateway needs read access to the shared proto contracts (NFR20).
COPY proto ./proto

EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- http://localhost:4000/health >/dev/null || exit 1

CMD ["node", "apps/gateway/src/index.js"]
