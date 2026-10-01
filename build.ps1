# Сборка образов всех микросервисов (запускать из корня проекта в PowerShell)
docker build -t taskflow/users-service:1.0      ./services/users-service
docker build -t taskflow/categories-service:1.0 ./services/categories-service
docker build -t taskflow/tasks-service:1.0      ./services/tasks-service
docker build -t taskflow/frontend:1.0           ./frontend
docker images taskflow/*
