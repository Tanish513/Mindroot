FROM node:20-alpine

WORKDIR /app

# Copy package dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies including devDependencies for tsx / prisma execution
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy application source code
COPY . .

# Expose backend API / Socket.io port
EXPOSE 3000

# Push Prisma schema to DB on startup and start Express server
CMD ["sh", "-c", "npx prisma db push && npm start"]
