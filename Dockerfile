FROM node:lts-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:lts-alpine
WORKDIR /app
COPY --from=builder /usr/local/lib/node_modules/pnpm /usr/local/lib/node_modules/pnpm
COPY --from=builder /usr/local/bin/pnpm /usr/local/bin/pnpm
COPY --from=builder /app ./
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "pnpm run seed & pnpm run start"]
