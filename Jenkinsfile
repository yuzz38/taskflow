pipeline {
    agent any

    environment {
        IMAGE_NAME      = "taskflow-backend"
        COMPOSE_PROJECT = "taskflow"
        APP_URL         = "http://localhost:8000"
        DOCKER_HOST     = "tcp://127.0.0.1:2375" // Порт, который мы открыли ранее
        
        // Добавляем путь к Docker в системный PATH для Jenkins
        PATH            = "C:\\Program Files\\Docker\\Docker\\resources\\bin;C:\\Program Files\\Docker\\Docker\\resources;${env.PATH}"
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
                    bat '''
                        if exist node_modules rmdir /s /q node_modules
                        call npm ci || call npm install
                    '''
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

        stage('Build Docker image') {
            steps {
                dir('backend') {
                    bat '''
                        docker build -t %IMAGE_NAME%:%BUILD_NUMBER% -t %IMAGE_NAME%:latest .
                        docker images %IMAGE_NAME%
                    '''
                }
            }
        }

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
