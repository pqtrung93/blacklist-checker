FROM node:20-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

ENV NODE_ENV=production
ENV PORT=7070
ENV DB_PATH=/data/blacklist.db

EXPOSE 7070

CMD ["node", "dist/index.js"]
