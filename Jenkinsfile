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

        // CD: выполняется только для main. Без Docker — процесс перезапускается
        // напрямую менеджером процессов pm2 (устанавливается локально через npx,
        // глобальная установка на агенте не требуется).
        stage('Deploy') {
            when { branch 'main' }
            steps {
                dir('backend') {
                    sh '''
                        npx --yes pm2 delete $APP_NAME || true
                        PORT=$APP_PORT npx --yes pm2 start server.js --name $APP_NAME
                        npx --yes pm2 save
                    '''
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
