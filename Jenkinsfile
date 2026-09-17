pipeline {
    agent any

    environment {
        IMAGE_NAME     = "taskflow-backend"
        COMPOSE_PROJECT = "taskflow"
        APP_URL        = "http://localhost:8000"
    }

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                bat 'echo Branch: %BRANCH_NAME%'
            }
        }

        stage('Install dependencies') {
            steps {
                dir('backend') {
                    bat 'call npm ci || call npm install'
                }
            }
        }

        stage('Test') {
            steps {
                dir('backend') {
                    bat 'call npm test -- --ci --reporters=default --reporters=jest-junit'
                }
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'backend/junit.xml'
                }
            }
        }

        // Сборка образа приложения. Тегируем номером сборки (для истории версий)
        // и latest (его использует docker-compose при деплое).
        stage('Build Docker image') {
            steps {
                bat '''
                    docker build -t %IMAGE_NAME%:%BUILD_NUMBER% -t %IMAGE_NAME%:latest .\\backend
                    docker images %IMAGE_NAME%
                '''
            }
        }

        // CD: разворачиваем только из main.
        // docker compose пересоздаёт контейнеры backend + nginx.
        stage('Deploy') {
            when { branch 'main' }
            steps {
                bat '''
                    docker compose -p %COMPOSE_PROJECT% down --remove-orphans
                    docker compose -p %COMPOSE_PROJECT% up -d --build
                    docker compose -p %COMPOSE_PROJECT% ps
                '''
            }
        }

        // Проверяем, что развёрнутое приложение реально отвечает через nginx.
        stage('Smoke test') {
            when { branch 'main' }
            steps {
                bat '''
                    ping -n 15 127.0.0.1 > nul
                    curl -f %APP_URL%/api/health
                '''
            }
        }
    }

    post {
        success {
            echo "Pipeline finished OK for branch ${env.BRANCH_NAME}"
        }
        failure {
            echo "Pipeline FAILED for branch ${env.BRANCH_NAME} — see logs above"
        }
    }
}
