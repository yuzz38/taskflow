pipeline {
    agent any

    environment {
        IMAGE_NAME      = "taskflow-backend"
        COMPOSE_PROJECT = "taskflow"
        DOCKERHUB_USER  = "yuzz38"          
        DOCKERHUB_REPO  = "${DOCKERHUB_USER}/${IMAGE_NAME}"
        APP_URL         = "http://localhost:8000"
        DOCKER_HOST     = "tcp://127.0.0.1:2375" // Используем открытый порт
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
                        "C:\\Users\\levap\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe" build -t %IMAGE_NAME%:%BUILD_NUMBER% -t %IMAGE_NAME%:latest .
                        "C:\\Users\\levap\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe" images %IMAGE_NAME%
                    '''
                }
            }
        }
        stage('Push to registry') {
            when { branch 'main' }
            steps {
                dir('backend') {
                    withCredentials([usernamePassword(
                        credentialsId: 'dockerhub-creds',
                        usernameVariable: 'DH_USER',
                        passwordVariable: 'DH_TOKEN'
                    )]) {
                        bat '''
                            docker tag %IMAGE_NAME%:%BUILD_NUMBER% %DOCKERHUB_REPO%:%BUILD_NUMBER%
                            docker tag %IMAGE_NAME%:latest %DOCKERHUB_REPO%:latest
                            echo %DH_TOKEN% | docker login -u %DH_USER% --password-stdin
                            docker push %DOCKERHUB_REPO%:%BUILD_NUMBER%
                            docker push %DOCKERHUB_REPO%:latest
                            docker logout
                        '''
                    }
                }
            }
        }
      stage('Deploy') {
            when { branch 'main' }
            steps {
                bat '''
                    "C:\\Users\\levap\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker-compose.exe" -p %COMPOSE_PROJECT% down --remove-orphans
                    "C:\\Users\\levap\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker-compose.exe" -p %COMPOSE_PROJECT% up -d --build
                    "C:\\Users\\levap\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker-compose.exe" -p %COMPOSE_PROJECT% ps
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