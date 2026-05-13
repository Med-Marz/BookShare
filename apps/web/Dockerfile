# --- Build stage: install deps and produce a static bundle ---
FROM node:20-alpine AS build
WORKDIR /repo

# Copy the workspace manifest first so npm can resolve the workspace tree.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json

# Install only what apps/web needs (npm workspaces resolves the tree).
RUN npm ci --workspace=apps/web --include-workspace-root=false

COPY apps/web ./apps/web
RUN npm run build --workspace=apps/web

# --- Serve stage: tiny nginx that serves /usr/share/nginx/html ---
FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- http://localhost:8080/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
