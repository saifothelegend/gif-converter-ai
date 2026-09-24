# ── Build stage ───────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# ffmpeg = video/image -> GIF conversion. gifsicle = free, open-source GIF
# optimizer/compressor. Both are FOSS and installed from Debian's free repos
# at build time — no paid API or service involved.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg gifsicle \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

# Render (and most free hosts) inject $PORT at runtime; 3000 is just the
# documented default for local `docker run`.
EXPOSE 3000

CMD ["node", "dist/index.js"]
