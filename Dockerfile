# Stage 1: Build the frontend and backend bundles
FROM node:22-slim AS builder

WORKDIR /app

# Copy package descriptors and postinstall script
COPY package*.json ./
COPY scripts/ ./scripts/

# Install dependencies required for compilation
RUN npm ci || npm install

# Copy source code and build configurations
COPY . .

# Build Vite frontend assets and bundle Express backend into dist/server.cjs
RUN npm run build

# Remove development dependencies to keep the runtime image lean
RUN npm prune --omit=dev

# Stage 2: Minimal production runtime for Google Cloud Run
FROM node:22-slim AS runner

WORKDIR /app

# Cloud Run defaults: production environment and dynamic PORT
ENV NODE_ENV=production
ENV PORT=8080

# Copy runtime node_modules, package manifest, and build outputs
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts

# Copy Firebase applet configurations if present
COPY --from=builder /app/firebase-applet-config.json* ./
COPY --from=builder /app/firebase-blueprint.json* ./
COPY --from=builder /app/firestore.rules* ./

# Ensure data directory exists for local disk fallback
RUN mkdir -p /app/data

# Cloud Run ingress listens on the port defined by process.env.PORT (default 8080)
EXPOSE 8080

# Production start command
CMD ["node", "dist/server.cjs"]
