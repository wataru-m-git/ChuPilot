# Build stage
FROM node:20-bookworm AS builder

WORKDIR /app

# Ensure OpenSSL 3.0.x is available for Prisma
RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

# Copy dependency files
COPY package*.json ./
COPY prisma ./prisma

# Install dependencies
RUN npm ci

# Generate Prisma client with openssl-3.0.x binaries
RUN npx prisma generate

# Copy application code
COPY . .

# Build the Next.js app
RUN npm run build

# Runtime stage
FROM node:20-bookworm

WORKDIR /app

# Ensure OpenSSL 3.0.x is available for Prisma query engine
RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

# Copy from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma

# Create data directory
RUN mkdir -p /app/data

# Run Prisma migrations to ensure schema is in sync
RUN npx prisma migrate deploy --skip-generate || true

# Expose port
EXPOSE 3333

# Start the application
CMD ["npm", "start"]
