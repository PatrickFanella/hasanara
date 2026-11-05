# Keep the application builder unchanged; pin the patched NGINX runtime.
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS build

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ENV VITE_API_BASE=/api
RUN npm run build

FROM nginx:1.31.7-alpine@sha256:892bb2152464f0c5d8972593a5f5afaf8054552580b699d95f8ff4af08c2d33d

ARG GIT_COMMIT=unknown
ARG BUILD_DATE
LABEL org.opencontainers.image.revision=$GIT_COMMIT \
      org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.source="https://git.subcult.tv/subculture-collective/hasanara"

RUN apk add --no-cache python3 rsvg-convert font-dejavu
COPY --chmod=755 frontend/scripts/render-site-metadata.py /docker-entrypoint.d/40-site-metadata.sh

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf '{"source_commit":"%s"}\n' "$GIT_COMMIT" > /usr/share/nginx/html/build-info.json

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:80/ || exit 1
