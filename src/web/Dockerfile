# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json ./

# Install dependencies with exact versions
RUN npm ci --production=false \
    && npm audit fix \
    && npm cache clean --force

# Copy source code
COPY . .

# Build production bundle
RUN npm run build \
    && npm prune --production

# Stage 2: Production stage
FROM nginx:1.25-alpine

# Install security updates and remove package cache
RUN apk upgrade --no-cache \
    && apk add --no-cache curl tzdata

# Create nginx user/group with restricted permissions
RUN addgroup -g 101 -S nginx \
    && adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Configure nginx with security headers and optimizations
COPY nginx.conf /etc/nginx/nginx.conf
COPY security-headers.conf /etc/nginx/security-headers.conf

# Set working directory
WORKDIR /usr/share/nginx/html

# Remove default nginx static assets
RUN rm -rf ./*

# Copy built assets from builder stage
COPY --from=builder /app/dist .

# Set correct permissions
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chown -R nginx:nginx /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/run/nginx.pid

# Configure nginx environment variables
ENV NGINX_WORKER_PROCESSES=auto
ENV NGINX_WORKER_CONNECTIONS=1024

# Expose port
EXPOSE 8080

# Switch to non-root user
USER nginx

# Set resource limits
RUN ulimit -n 65535

# Configure healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Apply security labels
LABEL vendor="MGA OS" \
    maintainer="DevOps Team <devops@mga-os.com>" \
    version="1.0.0" \
    security.credentials.readonly="true" \
    security.rootfs.readonly="true"