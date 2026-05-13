FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/gateway/package.json ./apps/gateway/package.json
RUN npm ci --workspace=apps/gateway --include-workspace-root=false --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
# Copy the resolved workspace tree (node_modules is hoisted at the repo root).
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/gateway/node_modules ./apps/gateway/node_modules
COPY package.json package-lock.json ./
COPY apps/gateway ./apps/gateway
# Gateway needs read access to the shared proto contracts (NFR20).
COPY proto ./proto

EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- http://localhost:4000/health >/dev/null || exit 1

CMD ["node", "apps/gateway/src/index.js"]
