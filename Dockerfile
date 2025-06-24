# Multi-stage build for production optimization
FROM node:20-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Create app directory with proper permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001
WORKDIR /app
RUN chown -R nextjs:nodejs /app

# Dependencies stage
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .

# Remove development files and create production build
RUN rm -rf test-cases/ .github/ *.md && \
    npm run lint:check && \
    npm test && \
    npm prune --production

# Production stage
FROM base AS production

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy production dependencies
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --from=build --chown=nextjs:nodejs /app/server.js ./
COPY --from=build --chown=nextjs:nodejs /app/public ./public/
COPY --from=build --chown=nextjs:nodejs /app/package.json ./

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads && \
    chown -R nextjs:nodejs /app/logs /app/uploads

# Security: Run as non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]

# Development stage (for local development)
FROM base AS development

ENV NODE_ENV=development

# Install all dependencies including dev dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Create development user
USER nextjs

# Expose port and debugger port
EXPOSE 3000 9229

# Start with nodemon for development
CMD ["npm", "run", "dev"]

# Testing stage
FROM development AS test

# Run tests
RUN npm test && npm run lint:check

# Default to production stage
FROM production 