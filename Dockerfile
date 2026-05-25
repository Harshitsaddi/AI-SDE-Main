FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
COPY src ./src
COPY README.md ROADMAP.md ./

EXPOSE 3000

CMD ["node", "src/server.js"]
