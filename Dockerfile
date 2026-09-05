FROM node:22-slim

WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

COPY backend ./backend
COPY frontend ./frontend

ENV PORT=3000
EXPOSE 3000

WORKDIR /app/backend
CMD ["node", "server.js"]
