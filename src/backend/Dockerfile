# Stage 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Install build essentials and security tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    git \
    && rm -rf /var/cache/apk/*

# Set build environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    YARN_CACHE_FOLDER=/usr/src/app/.yarn-cache \
    TS_NODE_TRANSPILE_ONLY=true

# Copy package files with checksums verification
COPY package*.json yarn.lock ./
COPY --chown=node:node . .

# Install dependencies with yarn and cache optimization
RUN yarn install --frozen-lockfile --production=false \
    --cache-folder /usr/src/app/.yarn-cache \
    && yarn cache clean

# Run security scan on dependencies
RUN yarn security:audit

# Build TypeScript application with optimizations
RUN yarn build

# Prune development dependencies
RUN yarn install --frozen-lockfile --production=true \
    --cache-folder /usr/src/app/.yarn-cache \
    && yarn cache clean

# Stage 2: Production
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Create non-root user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Set production environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS='--max-old-space-size=2048' \
    NODE_CLUSTER_WORKERS=4

# Install production dependencies
RUN apk add --no-cache \
    curl \
    tini \
    && rm -rf /var/cache/apk/*

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/package.json ./

# Set security permissions and ownership
RUN chmod -R 550 /usr/src/app && \
    chmod -R 770 /usr/src/app/dist/logs && \
    chown -R nodejs:nodejs /usr/src/app

# Configure security options
RUN mkdir -p /usr/src/app/tmp && \
    chown -R nodejs:nodejs /usr/src/app/tmp && \
    chmod 1777 /usr/src/app/tmp

# Set up health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose application port
EXPOSE ${PORT}

# Set up logging
LABEL logging.driver="json-file" \
      logging.options.max-size="100m" \
      logging.options.max-file="3"

# Set up monitoring
LABEL metrics.enabled="true" \
      metrics.path="/metrics" \
      metrics.format="prometheus"

# Switch to non-root user
USER nodejs

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Define startup command with clustering
CMD ["node", "dist/server.js"]

# Security options
SECURITY_OPT no-new-privileges:true
SECURITY_OPT seccomp=unconfined

# Read-only root filesystem
VOLUME ["/usr/src/app/node_modules", "/usr/src/app/tmp"]
READONLY_ROOTFS true