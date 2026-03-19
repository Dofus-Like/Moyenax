FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock .yarnrc ./
COPY .yarn ./.yarn
RUN yarn install --frozen-lockfile
COPY . .
# Generer les types Prisma AVANT le build NX pour que TypeScript ait acces aux types
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npx nx build api --configuration=production

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist/apps/api ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main.js"]
