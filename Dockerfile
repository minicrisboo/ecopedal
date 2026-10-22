FROM node:22-alpine AS api-dependencies
WORKDIR /app/backend
COPY backend/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund

FROM node:22-alpine AS api
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=api-dependencies --chown=node:node /app/backend/node_modules ./node_modules
COPY --chown=node:node backend/package.json ./package.json
COPY --chown=node:node backend/src ./src
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]

FROM nginx:1.27-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html styles.css /usr/share/nginx/html/
COPY js /usr/share/nginx/html/js
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
