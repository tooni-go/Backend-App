# 1. Dependencias
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci

# 2. Compilación (Builder)
FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig*.json nest-cli.json* ./
COPY prisma ./prisma
COPY prisma.config.* ./
COPY src ./src
RUN npx prisma generate
RUN npm run build
RUN npm prune --production

# 3. Imagen final de ejecución (Runner)
FROM node:20-slim AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma.config.* ./

RUN mkdir -p /app/prisma /app/uploads

EXPOSE 3000
CMD npx prisma db push && (node dist/src/main.js || node dist/main.js)
