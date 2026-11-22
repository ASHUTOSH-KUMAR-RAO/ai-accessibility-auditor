# AccessLens API + scan worker. Chromium comes from the official Playwright image.
# PW_VERSION MUST equal the exact "playwright" version in package.json (pinned, no caret),
# otherwise Playwright cannot find the browser build baked into the image.
ARG PW_VERSION=1.65.1

# ───────── build ─────────
FROM mcr.microsoft.com/playwright:v${PW_VERSION}-noble AS build
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src
# `build` = prisma generate && tsc  (a placeholder URL lets prisma.config.ts load; nothing connects at build time)
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build DIRECT_URL=postgresql://build:build@localhost:5432/build npm run build

# ───────── runtime ─────────
FROM mcr.microsoft.com/playwright:v${PW_VERSION}-noble
ENV NODE_ENV=production \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /app

# tini reaps Chromium's orphaned child processes and forwards SIGTERM
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && chown -R pwuser:pwuser /app

# Non-root: the Playwright image ships "pwuser" for exactly this.
USER pwuser
EXPOSE 4000
ENTRYPOINT ["/usr/bin/tini", "--", "./docker-entrypoint.sh"]
