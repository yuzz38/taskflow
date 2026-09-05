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
                sh 'echo "Branch: $BRANCH_NAME, commit: $(git rev-parse --short HEAD)"'
            }
        }

        stage('Install dependencies') {
            steps {
                dir('backend') {
                    sh 'npm ci || npm install'
                }
            }
        }

        stage('Test') {
            steps {
                dir('backend') {
                    sh 'npm test -- --ci --reporters=default --reporters=jest-junit'
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
                sh 'docker build -t $IMAGE_NAME:$BUILD_NUMBER -t $IMAGE_NAME:latest .'
            }
        }

        stage('Deploy') {
            when { branch 'main' }
            steps {
                sh '''
                    docker rm -f $CONTAINER_NAME || true
                    docker run -d --name $CONTAINER_NAME -p $APP_PORT:3000 $IMAGE_NAME:latest
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
