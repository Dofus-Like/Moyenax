FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock .yarnrc ./
COPY .yarn ./.yarn
RUN yarn install --frozen-lockfile
COPY . .
# VITE_API_URL est une variable build-time (baked dans le bundle JS par Vite).
# La valeur par defaut /api/v1 est correcte en prod : nginx proxifie /api -> api:3000.
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npx nx build web --configuration=production

FROM nginx:alpine AS runner
COPY --from=builder /app/dist/apps/web /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
