FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm install

COPY . .
RUN npm run build --workspace backend

EXPOSE 3001

CMD ["npm", "run", "start", "--workspace", "backend"]
