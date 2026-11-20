# One image, three commands: the API (default), the worker, and migrations.
#   docker build -f backend/Dockerfile -t desmind-lands-backend .
#   docker run desmind-lands-backend                      # API on :4000
#   docker run desmind-lands-backend node dist/worker.js  # worker
#   docker run desmind-lands-backend node dist/migrate.js # migrations (SYSTEM_DATABASE_URL)
FROM node:24-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY backend/package.json backend/
RUN npm ci --workspace @lands/backend --include-workspace-root=false
COPY backend backend
RUN npm run build --workspace @lands/backend

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json package-lock.json ./
COPY backend/package.json backend/
RUN npm ci --workspace @lands/backend --include-workspace-root=false --omit=dev && npm cache clean --force
COPY --from=build /repo/backend/dist backend/dist
COPY backend/migrations backend/migrations
# Fonts for the PDFs the API draws (the signed agreements).
COPY backend/assets backend/assets
WORKDIR /repo/backend
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
