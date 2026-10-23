// Декларативный конвейер непрерывного обучения (Continuous Training) модели TaskFlow.
// Работает и на Windows (bat), и на Linux (sh).
def run(String cmd) { if (isUnix()) { sh cmd } else { bat cmd } }
def py() { isUnix() ? 'venv-ml/bin/python' : 'venv-ml\\Scripts\\python.exe' }

pipeline {
    agent any

    // Триггер: каждые 2 минуты Jenkins опрашивает GitHub; при новом коммите запускается сборка
    triggers { pollSCM('H/2 * * * *') }

    parameters {
        booleanParam(name: 'FORCE_TRAIN', defaultValue: false, description: 'Обучить модель без изменения данных')
    }

    environment {
        MLFLOW_TRACKING_URI = 'http://localhost:5000'
        ML_SERVICE_URL      = 'http://localhost:8081'
        MIN_DELTA           = '0.005'
        PYTHONIOENCODING    = 'utf-8'
        PYTHONUTF8          = '1'
    }

    options { disableConcurrentBuilds() }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                echo "Причина запуска: ${currentBuild.getBuildCauses().collect { it.shortDescription }}"
            }
        }

        stage('Dataset changed') {
            when { changeset 'data/**' }
            steps { echo 'Набор данных изменён в коммите -> переобучение модели' }
        }

        stage('Continuous Training') {
            when {
                anyOf {
                    changeset 'data/**'
                    changeset 'ml/params.json'
                    expression { params.FORCE_TRAIN }
                    triggeredBy 'UserIdCause'
                }
            }
            stages {
                stage('Setup ML env') {
                    steps {
                        script {
                            if (isUnix()) { sh 'test -d venv-ml || python3 -m venv venv-ml' }
                            else          { bat 'if not exist venv-ml python -m venv venv-ml' }
                        }
                        run "${py()} -m pip install -q -r ml/requirements.txt"
                    }
                }
                stage('Check MLflow') {
                    steps {
                        run "${py()} -c \"import urllib.request as u; print(u.urlopen('${env.MLFLOW_TRACKING_URI}/health').read())\""
                    }
                }
                stage('Validate data') { steps { run "${py()} ml/data_tool.py validate" } }
                stage('Train')         { steps { run "${py()} ml/train.py" } }
                stage('Quality gate')  { steps { run "${py()} ml/evaluate.py" } }
                stage('Deploy model')  { steps { run "${py()} ml/reload.py" } }
            }
        }
    }

    post {
        always { archiveArtifacts artifacts: 'reports/*.json', allowEmptyArchive: true }
        success { echo 'Конвейер выполнен успешно' }
        failure { echo 'Конвейер завершился с ошибкой (например, новая модель хуже текущей)' }
    }
}
