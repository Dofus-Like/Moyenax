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

FROM node:22-alpine AS runner
WORKDIR /app
# openssl est necessaire au runtime pour charger le moteur Prisma (libquery_engine-linux-musl-openssl-3.0.x.so.node)
RUN apk add --no-cache openssl
COPY --from=builder /app/dist/apps/api ./dist
COPY --from=builder /app/api-runtime/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main.js"]
