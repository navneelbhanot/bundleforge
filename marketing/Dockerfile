# BundleForge marketing site Dockerfile.
#
# Single-stage Node 20 alpine. No dependencies, no build step — just copies
# the static HTML and the tiny server.cjs and runs it. Image lands at
# ~50 MB on top of node:20-alpine.
#
# Railway service config:
#   Root Directory: marketing
#   Builder:        Dockerfile (auto-detected)
#   Start Command:  (default — CMD below)
#   Healthcheck:    /health   (configured via railway.json)

FROM node:20-alpine

WORKDIR /app

# Copy only what the runtime needs. No npm install — the server has zero
# runtime dependencies, and `npm ci` would error on a missing lockfile.
# When future static assets land (favicon, og:image, /privacy.html, etc.),
# add them to this COPY line.
COPY package.json server.cjs index.html ./

ENV NODE_ENV=production
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT:-8080}/health || exit 1

CMD ["node", "server.cjs"]
