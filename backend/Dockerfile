FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY backend/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund

COPY --chown=node:node backend/src ./src
COPY --chown=node:node index.html styles.css ./public/
COPY --chown=node:node js ./public/js
USER node

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]