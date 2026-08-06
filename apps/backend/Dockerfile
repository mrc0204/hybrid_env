FROM node:22-alpine

WORKDIR /app

# Build context is the repo root (npm workspaces need the whole tree to install).
COPY . .
RUN npm install

WORKDIR /app/apps/backend
EXPOSE 4000

CMD ["npm", "run", "dev"]
