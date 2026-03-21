FROM node:22-alpine AS builder
WORKDIR /app
# openssl est requis pour que prisma generate detecte correctement OpenSSL 3.x
# (sans ca, Prisma defaulte a openssl-1.1.x et le runtime crash sur alpine)
RUN apk add --no-cache openssl
COPY package.json yarn.lock .yarnrc ./
COPY .yarn ./.yarn
RUN yarn install --frozen-lockfile
COPY . .
# Generer les types Prisma AVANT le build NX pour que TypeScript ait acces aux types
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npx nx build api --configuration=production
RUN npx nx run api:prune
RUN mkdir -p /app/api-runtime
RUN cp dist/apps/api/package.json /app/api-runtime/package.json
RUN cp dist/apps/api/yarn.lock /app/api-runtime/yarn.lock
RUN if [ -d dist/apps/api/workspace_modules ]; then cp -R dist/apps/api/workspace_modules /app/api-runtime/workspace_modules; fi
RUN cd /app/api-runtime && yarn install --production --frozen-lockfile

# ── Outils devDep necessaires au runtime (absents du node_modules produit par prune) ──
# 1. prisma CLI — necessaire pour "prisma migrate deploy" au demarrage
RUN cp -r /app/node_modules/prisma /app/api-runtime/node_modules/prisma && \
    cp /app/node_modules/.bin/prisma /app/api-runtime/node_modules/.bin/prisma
# 2. Client Prisma genere (binary natif musl) — non regenere par yarn install --production
RUN cp -r /app/node_modules/.prisma /app/api-runtime/node_modules/.prisma
# 3. Compiler seed.ts -> seed.js (CommonJS) pour eviter ts-node en prod
RUN node_modules/.bin/tsc \
    --esModuleInterop \
    --module commonjs \
    --moduleResolution node \
    --target es2020 \
    --skipLibCheck \
    --noEmitOnError false \
    --outDir /tmp/seed \
    apps/api/prisma/seed.ts

FROM node:22-alpine AS runner
WORKDIR /app
# openssl est necessaire au runtime pour charger le moteur Prisma
RUN apk add --no-cache openssl
COPY --from=builder /app/dist/apps/api ./dist
COPY --from=builder /app/api-runtime/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
# seed.js compile depuis seed.ts — utilise par api-setup au premier demarrage
COPY --from=builder /tmp/seed/apps/api/prisma/seed.js ./seed.js
EXPOSE 3000
CMD ["node", "dist/main.js"]
