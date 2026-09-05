// Кроссплатформенный запуск команд: на Windows-агенте использует bat, на Linux/Mac — sh
def runCmd(String cmd) {
    if (isUnix()) {
        sh cmd
    } else {
        bat cmd
    }
}

pipeline {
    agent any

    // Требует плагин "NodeJS Plugin" и настроенный в
    // Manage Jenkins -> Tools -> NodeJS installations инструмент с именем Node22
    tools {
        nodejs 'Node22'
    }

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
                    script { runCmd('npm ci || npm install') }
                }
            }
        }

        stage('Test') {
            steps {
                dir('backend') {
                    script { runCmd('npm test -- --ci --reporters=default --reporters=jest-junit') }
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
        // отдельная глобальная установка не требуется).
        stage('Deploy') {
            when { branch 'main' }
            steps {
                dir('backend') {
                    script {
                        runCmd('npx --yes pm2 delete %APP_NAME% || npx --yes pm2 delete $APP_NAME || echo no-previous-process')
                        if (isUnix()) {
                            sh 'PORT=$APP_PORT npx --yes pm2 start server.js --name $APP_NAME'
                        } else {
                            bat 'set PORT=%APP_PORT% && npx --yes pm2 start server.js --name %APP_NAME%'
                        }
                        runCmd('npx --yes pm2 save')
                    }
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
