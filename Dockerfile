FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY server ./server
COPY shared ./shared
COPY web ./web
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server/database.sql ./dist/server/database.sql
COPY --from=build /app/web/dist ./web/dist
USER node
EXPOSE 4000
CMD ["sh", "-c", "node dist/server/migrate.js && exec node dist/server/index.js"]
