FROM node:22-alpine AS builder
WORKDIR /app

# OpenSSL is required so Prisma generates the correct Alpine-compatible client.
RUN apk add --no-cache openssl

COPY package.json yarn.lock .yarnrc ./
COPY .yarn ./.yarn
RUN yarn install --frozen-lockfile

COPY . .

# Generate Prisma types before building the API bundle.
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npx nx build api --configuration=production
RUN npx nx run api:prune

RUN mkdir -p /app/api-runtime
RUN cp package.json /app/api-runtime/package.json
RUN cp yarn.lock /app/api-runtime/yarn.lock
RUN mkdir -p /app/api-runtime/prisma
RUN cp apps/api/prisma/schema.prisma /app/api-runtime/prisma/schema.prisma
RUN if [ -d dist/apps/api/workspace_modules ]; then cp -R dist/apps/api/workspace_modules /app/api-runtime/workspace_modules; fi
RUN cd /app/api-runtime && yarn install --production --frozen-lockfile

# Prisma CLI is required at runtime for `prisma migrate deploy`.
RUN cp -r /app/node_modules/prisma /app/api-runtime/node_modules/prisma

# Generate the runtime Prisma client inside api-runtime to avoid shipping an uninitialized stub.
RUN cd /app/api-runtime && node node_modules/prisma/build/index.js generate --schema=./prisma/schema.prisma

# Compile seed.ts and its local imports to CommonJS for api-setup.
RUN rm -rf /tmp/seed-build && mkdir -p /tmp/seed-build && \
    node_modules/.bin/tsc \
    --esModuleInterop \
    --module commonjs \
    --moduleResolution node \
    --target es2020 \
    --rootDir apps/api \
    --skipLibCheck \
    --noEmitOnError false \
    --outDir /tmp/seed-build \
    apps/api/prisma/seed.ts && \
    test -f /tmp/seed-build/prisma/seed.js

FROM node:22-alpine AS runner
WORKDIR /app

# OpenSSL is required at runtime for the Prisma query engine.
RUN apk add --no-cache openssl

COPY --from=builder /app/dist/apps/api ./dist
COPY --from=builder /app/api-runtime/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/scripts ./scripts
COPY --from=builder /tmp/seed-build ./seed-build

ARG BUILD_SHA=unknown
ARG BUILD_TIME=unknown
ENV BUILD_SHA=${BUILD_SHA}
ENV BUILD_TIME=${BUILD_TIME}

EXPOSE 3000

CMD ["node", "dist/main.js"]
