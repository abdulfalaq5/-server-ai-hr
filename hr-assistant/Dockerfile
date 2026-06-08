# =============================================================================
# HR Assistant - Dockerfile
# =============================================================================
# Multi-stage build: builder → production
#
# Base: node:22-bookworm (full Debian 12)
# Required because fastembed uses onnxruntime-node which needs:
#   - ld-linux-x86-64.so.2  (glibc dynamic linker)
#   - libstdc++.so.6         (C++ standard library)
# These are present in bookworm but stripped from -slim variants.
# =============================================================================

# ── Stage 1: Build TypeScript ──────────────────────────────────────────────
FROM node:22-bookworm AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS production

# Install wget for healthcheck + libstdc++ for ONNX runtime (fastembed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# FastEmbed model cache directory (model downloaded on first startup)
RUN mkdir -p /tmp/fastembed-cache && chmod 777 /tmp/fastembed-cache

# Non-root security
RUN groupadd -r hrgroup && useradd -r -g hrgroup hruser
USER hruser

EXPOSE 9004

# Extra start-period for model download on first run
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
  CMD wget -qO- http://localhost:9004/health || exit 1

CMD ["node", "dist/index.js"]
