FROM node:24.19.0-bookworm-slim AS web-build

WORKDIR /build/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run check && npm run build

FROM node:24.19.0-bookworm-slim AS server-dependencies

WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24.19.0-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production \
    PORT=8888 \
    KIKOERU_DATA_DIR=/data \
    KIKOERU_VOICEWORK_PATH=/media

COPY server/package.json server/package-lock.json ./
COPY server/src ./src
COPY LICENSE ./LICENSE
COPY --from=server-dependencies /build/server/node_modules ./node_modules
COPY --from=web-build /build/web/dist/pwa ./src/public

VOLUME ["/data", "/media"]
EXPOSE 8888

ENTRYPOINT ["tini", "--"]
CMD ["node", "src/app.js"]
