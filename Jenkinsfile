pipeline {
    agent any

    environment {
        IMAGE_NAME = "taskflow-backend"
        CONTAINER_NAME = "taskflow-app"
        APP_PORT = "3000"
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
                    bat 'npm ci || npm install'
                }
            }
        }

        stage('Test') {
            steps {
                dir('backend') {
                    bat 'npm test -- --ci --reporters=default --reporters=jest-junit'
                }
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'backend/junit.xml'
                }
            }
        }

        stage('Build Docker image') {
            when { branch 'main' }
            steps {
                bat 'docker build -t %IMAGE_NAME%:%BUILD_NUMBER% -t %IMAGE_NAME%:latest .'
            }
        }

        stage('Deploy') {
            when { branch 'main' }
            steps {
                bat '''
                    docker rm -f %CONTAINER_NAME% 2>nul || echo no-previous-container
                    docker run -d --name %CONTAINER_NAME% -p %APP_PORT%:3000 %IMAGE_NAME%:latest
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