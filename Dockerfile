FROM node:20-slim

WORKDIR /app

# Install frontend dependencies and build
COPY package.json package-lock.json* ./
RUN npm install

COPY vite.config.js index.html ./
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build

# Install server dependencies
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev

# Copy server source
COPY server/src/ ./server/src/

# Create uploads directory
RUN mkdir -p server/uploads

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/src/index.js"]
