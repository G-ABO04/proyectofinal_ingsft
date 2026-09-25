FROM node:24-bookworm-slim
WORKDIR /app/service
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY scripts ./scripts
RUN mkdir -p /app/database && chown -R node:node /app
USER node
ENV NODE_ENV=production HOST=0.0.0.0
CMD ["node", "src/server.js"]
