# BundleForge web + worker Dockerfile.
#
# Single-stage Node 20 alpine. We keep devDependencies in the runtime
# image because production runs `tsx src/...` (not pre-compiled JS) and
# also needs the Prisma CLI for `migrate deploy` on boot. Image lands at
# ~280 MB which is fine for Railway. A multi-stage build can come later
# once tsx-based runtime is replaced with a tsc-compiled emit.
#
# Override CMD per service:
#   web:    (default — npm run start:web)
#   worker: npm run start:worker

FROM node:20-alpine

WORKDIR /app

# Build dependencies for native modules + openssl for Prisma.
RUN apk add --no-cache libc6-compat openssl

# Copy manifests + the postinstall script first so the install layer
# caches across code changes. `scripts/install-extensions.cjs` is
# referenced by the root postinstall hook, so it must exist before
# `npm ci` runs — otherwise npm aborts with MODULE_NOT_FOUND.
# (The script itself is a no-op when `extensions/*/package.json`
# isn't present, which is the case at this point in the Docker
# build — Shopify Functions are built and deployed from the
# developer's machine, not from this image.)
COPY package.json package-lock.json .npmrc ./
COPY scripts ./scripts

# Install everything: vite, tsx, prisma CLI, etc. all needed at runtime.
RUN npm ci --include=dev

# Copy the rest of the source and build.
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

CMD ["npm", "run", "start:web"]
