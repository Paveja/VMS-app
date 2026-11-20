FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production API_PORT=4173 DOCUMENT_ROOT=/app/.data/documents
EXPOSE 4173
CMD ["npm", "start"]
