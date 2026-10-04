# Base images are pinned to the digests behind the tags core used. The nginx
# digest matches the base layers of the rc.18 web image hasanara.tv served
# before HasanAra built its own (core 19124a7, sha256:236cb873...).
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS build

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ENV VITE_API_BASE=/api
RUN npm run build

FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10

ARG GIT_COMMIT=unknown
ARG BUILD_DATE
LABEL org.opencontainers.image.revision=$GIT_COMMIT \
      org.opencontainers.image.created=$BUILD_DATE

RUN apk add --no-cache python3 rsvg-convert font-dejavu
COPY --chmod=755 frontend/scripts/render-site-metadata.py /docker-entrypoint.d/40-site-metadata.sh

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:80/ || exit 1
