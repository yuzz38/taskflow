# Многоступенчатая сборка не требуется: приложение на Node.js без этапа компиляции.
FROM node:22-slim

# Пакеты, необходимые для сборки нативного модуля better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Сначала копируем только манифесты — так слой с зависимостями кэшируется
# и не пересобирается при каждом изменении кода
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Затем копируем исходный код приложения
COPY . .

# Каталог для файла БД SQLite (монтируется как volume, чтобы данные
# переживали пересоздание контейнера)
RUN mkdir -p /app/data
ENV DB_PATH=/app/data/taskflow.db

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Проверка живости контейнера через health-эндпоинт приложения
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
