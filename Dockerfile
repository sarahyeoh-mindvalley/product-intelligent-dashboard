FROM node:lts-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build
# Pre-seed SQLite during build so the container starts with data already loaded.
# This avoids the ~512MB memory spike that occurs when both the seed script and
# the API route try to decompress/parse the 178MB JSON simultaneously on cold start.
RUN mkdir -p data && pnpm run seed

FROM node:lts-alpine
WORKDIR /app
COPY --from=builder /usr/local/lib/node_modules/pnpm /usr/local/lib/node_modules/pnpm
COPY --from=builder /usr/local/bin/pnpm /usr/local/bin/pnpm
COPY --from=builder /app ./
ENV PORT=8080
EXPOSE 8080
CMD ["pnpm", "run", "start"]
