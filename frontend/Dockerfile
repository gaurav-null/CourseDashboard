FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm install

COPY frontend ./frontend
RUN npm run build --workspace frontend

FROM node:20-alpine

WORKDIR /app/frontend
COPY --from=build /app/frontend/dist ./dist

EXPOSE 4173

CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "4173", "--strictPort"]
