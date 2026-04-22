FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/detector/package.json ./packages/detector/

RUN npm ci

COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/detector/tsconfig.json ./packages/detector/
COPY packages/shared/src ./packages/shared/src
COPY packages/detector/src ./packages/detector/src

RUN npm run build --workspace=packages/shared \
 && npm run build --workspace=packages/detector


FROM node:20-alpine AS production
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/detector/package.json ./packages/detector/

RUN npm ci --omit=dev

COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/detector/dist ./packages/detector/dist

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "packages/detector/dist/index.js"]
