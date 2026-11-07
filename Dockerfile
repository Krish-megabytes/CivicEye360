# CivicEye 360 — production image (API serves the built web client)
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Install dependencies (workspaces)
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci

# Build
COPY server ./server
COPY client ./client
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
# Install production dependencies (includes workspace deps)
RUN npm ci --omit=dev

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

# Uploads are stored on the local filesystem by default. Mount a persistent
# volume at /app/uploads (and keep UPLOAD_DIR=uploads) if your platform supports it;
# otherwise move attachments to object storage (S3/R2) for durability.
RUN mkdir -p /app/uploads

EXPOSE 4000
CMD ["node", "server/dist/index.js"]
