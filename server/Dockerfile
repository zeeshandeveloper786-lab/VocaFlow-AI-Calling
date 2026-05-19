FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --legacy-peer-deps
RUN npx prisma generate

COPY . .

EXPOSE 3001
