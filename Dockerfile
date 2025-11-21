FROM node:20-slim AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Build Next.js app
RUN npm run build

# Build Custom Server
# We override tsconfig options to output commonjs for the server
RUN npx tsc server.ts --module commonjs --moduleResolution node --target es2019 --esModuleInterop --skipLibCheck --noEmit false --outDir .

# Production image
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package.json ./
RUN npm install --only=production

# Copy necessary files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.js ./server.js

EXPOSE 3000

CMD ["node", "server.js"]
