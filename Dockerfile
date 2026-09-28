FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates tini && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY --chown=node:node server ./server
COPY --chown=node:node shared ./shared
COPY --chown=node:node tsconfig.json ./
ENV NODE_ENV=production AUTH_MODE=supabase STUDIO_ALLOW_UNAUTHENTICATED=false PORT=8787
USER node
EXPOSE 8787
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "--import", "tsx", "server/index.ts"]
