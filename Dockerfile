FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev && \
    npm cache clean --force

COPY --from=builder /app/dist ./dist

# Copy the JSON into the runtime image
COPY series-mapping.json /app/data/series-mapping.json

RUN mkdir -p /app/data && chown -R node:node /app

ENV NODE_ENV=production

EXPOSE 3000

USER node

CMD ["node", "dist/index.js"]
