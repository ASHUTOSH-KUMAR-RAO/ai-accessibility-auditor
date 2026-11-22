# AccessLens API + scan worker: slim, Chromium-only image.
# The browser build is installed by the SAME Playwright version the app depends on (package.json pins it),
# so there is nothing to keep in sync. Only the headless shell + the OS libraries it needs are installed
# (the official Playwright image also ships Firefox and WebKit: 4.8 GB, vs ~1.8 GB here).

# ───────── build ─────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src
# `build` = prisma generate && tsc  (placeholder URLs let prisma.config.ts load; nothing connects at build time)
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build DIRECT_URL=postgresql://build:build@localhost:5432/build npm run build

# ───────── runtime ─────────
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app

# tini reaps Chromium's orphaned child processes and forwards SIGTERM; ca-certificates for TLS to Supabase/sites.
# /app is handed to the unprivileged "node" user up front, so no layer-doubling `chown -R` is needed later.
RUN apt-get update && apt-get install -y --no-install-recommends tini ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && chown node:node /app

USER node
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Chromium headless shell only + exactly the shared libraries/fonts it needs (apt needs root, so switch briefly)
USER root
RUN npx playwright install --with-deps --only-shell chromium \
    && rm -rf /var/lib/apt/lists/* /root/.cache \
    && chmod -R a+rX /ms-playwright

USER node
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node prisma.config.ts ./
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node --chmod=755 docker-entrypoint.sh ./
EXPOSE 4000
ENTRYPOINT ["/usr/bin/tini", "--", "./docker-entrypoint.sh"]
