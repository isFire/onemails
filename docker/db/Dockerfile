# ========================================
# Dependencies Stage: Install Dependencies
# ========================================
FROM oven/bun:alpine AS deps
WORKDIR /app

# Copy only package files needed for migrations
COPY package.json bun.lock turbo.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/tsconfig/base.json ./packages/tsconfig/base.json
COPY packages/tsconfig/package.json ./packages/tsconfig/

# Install dependencies per bun.lock in one layer (drizzle-kit is a devDependency, so no --omit dev)
RUN bun install --ignore-scripts

# ========================================
# Runner Stage: Production Environment
# ========================================
FROM oven/bun:alpine AS runner
WORKDIR /app

# Copy only the necessary files from deps
COPY --from=deps /app/node_modules ./node_modules
COPY packages/db/drizzle.config.ts ./packages/db/drizzle.config.ts
COPY packages/db/src ./packages/db/src
COPY packages/db/migrations ./packages/db/migrations
COPY packages/db/package.json ./packages/db/package.json

WORKDIR /app/packages/db