pipeline {
    agent any

    environment {
        APP_NAME = "taskflow-app"
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

        stage('Deploy') {
            when { branch 'main' }
            steps {
                dir('backend') {
                    bat 'npx --yes pm2 delete %APP_NAME% || echo no-previous-process'
                    bat 'set PORT=%APP_PORT% && npx --yes pm2 start server.js --name %APP_NAME%'
                    bat 'npx --yes pm2 save'
                }
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
