FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache python3 make g++ && npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src

RUN npm run build && \
    npm prune --omit=dev --no-audit --no-fund && \
    find dist node_modules -type f \( -name '*.map' -o -name '*.d.ts' -o -name '*.d.cts' -o -name '*.d.mts' \) -delete

FROM node:24-alpine

WORKDIR /app

COPY --chown=node:node package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

RUN mkdir -p /app/data && chown node:node /app/data

ENV NODE_ENV=production

EXPOSE 3000

USER node

CMD ["node", "dist/index.js"]
