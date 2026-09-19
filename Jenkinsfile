pipeline {
    agent any

    environment {
        IMAGE_NAME      = "taskflow-backend"
        COMPOSE_PROJECT = "taskflow"
        DOCKERHUB_USER  = "yuzz38"
        DOCKERHUB_REPO  = "${DOCKERHUB_USER}/${IMAGE_NAME}"
        APP_URL         = "http://localhost:8000"
        DOCKER          = "C:\\Users\\levap\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe"
        COMPOSE         = "C:\\Users\\levap\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker-compose.exe"
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
                        "%DOCKER%" build --cache-from %IMAGE_NAME%:latest -t %IMAGE_NAME%:%BUILD_NUMBER% -t %IMAGE_NAME%:latest .
                        "%DOCKER%" images %IMAGE_NAME%
                    '''
                }
            }
        }

       stage('Push to registry') {
            when {
                anyOf { branch 'main'; branch 'dev' }
            }
            steps {
                dir('backend') {
                    withCredentials([usernamePassword(
                        credentialsId: 'dockerhub-creds',
                        usernameVariable: 'DH_USER',
                        passwordVariable: 'DH_TOKEN'
                    )]) {
                        script {
                            def tag = (env.BRANCH_NAME == 'main') ? 'latest' : 'dev'
                            bat """
                                "%DOCKER%" tag %IMAGE_NAME%:%BUILD_NUMBER% %DOCKERHUB_REPO%:%BUILD_NUMBER% || exit /b 1
                                "%DOCKER%" tag %IMAGE_NAME%:latest %DOCKERHUB_REPO%:${tag} || exit /b 1
                                echo %DH_TOKEN%|"%DOCKER%" login -u %DH_USER% --password-stdin || exit /b 1
                                "%DOCKER%" push %DOCKERHUB_REPO%:%BUILD_NUMBER% || exit /b 1
                                "%DOCKER%" push %DOCKERHUB_REPO%:${tag} || exit /b 1
                                "%DOCKER%" logout
                            """
                        }
                    }
                }
            }
        }

        stage('Deploy') {
            when { branch 'main' }
            steps {
                bat '''
                    "%COMPOSE%" -p %COMPOSE_PROJECT% down --remove-orphans
                    "%COMPOSE%" -p %COMPOSE_PROJECT% up -d --build
                    "%COMPOSE%" -p %COMPOSE_PROJECT% ps
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