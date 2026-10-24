// Pipeline CI/CD de Operaciones_Citas para Jenkins (agente Windows).
// Estrategia de ramas:
//   feature/*  -> solo etapas 1 y 2 (integración, build, lint y pruebas)
//   staging    -> etapas 1, 2 y 3 (despliegue automático a staging)
//   main       -> etapas 1, 2 y 3 (despliegue a producción con aprobación manual)
// Requiere un job "Multibranch Pipeline" para que BRANCH_NAME y los `when { branch }` funcionen.

@Library('operaciones-citas-lib') _

def cambios = [backend: true, frontend: true]

pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timeout(time: 45, unit: 'MINUTES')
    }

    environment {
        // Caché persistente entre ejecuciones (pip y npm) fuera del workspace.
        CI_CACHE_DIR = 'C:\\jenkins-cache'
        PIP_CACHE_DIR = 'C:\\jenkins-cache\\pip'
        // Variables de test: mismas que .github/workflows/ci.yml.
        DJANGO_SETTINGS_MODULE = 'config.settings.test'
        DB_HOST = 'localhost'
        DB_PORT = '5432'
        DB_NAME = 'operaciones_citas'
        DB_USER = 'operaciones_citas'
        DB_PASSWORD = 'operaciones_citas'
        REDIS_URL = 'redis://localhost:6379/0'
        DJANGO_ALLOWED_HOSTS = 'localhost,127.0.0.1'
    }

    stages {

        stage('1. Integración') {
            steps {
                checkout scm
                ciNotificar('PENDING')
                bat 'if not exist "%CI_CACHE_DIR%" mkdir "%CI_CACHE_DIR%"'
                script {
                    // Selective execution: solo se compila/testea lo que cambió.
                    cambios = ciCambios()
                    echo "Cambios detectados -> backend: ${cambios.backend}, frontend: ${cambios.frontend}"
                }
            }
        }

        stage('2. Compilación y pruebas') {
            // Ejecución paralela: backend y frontend corren a la vez en agentes/ejecutores distintos.
            parallel {
                stage('Backend (Django)') {
                    when { expression { cambios.backend } }
                    steps {
                        ciBackend()
                    }
                }
                stage('Frontend (React)') {
                    when { expression { cambios.frontend } }
                    steps {
                        ciFrontend()
                    }
                }
            }
        }

        stage('3. Calidad y despliegue') {
            when { anyOf { branch 'staging'; branch 'main' } }
            steps {
                script {
                    if (env.BRANCH_NAME == 'main') {
                        // Producción solo tras aprobación humana.
                        input message: '¿Desplegar a PRODUCCIÓN?', ok: 'Desplegar'
                    }
                }
                // Placeholder: sustituir por el despliegue real del entorno (docker compose, SSH, etc.).
                bat 'echo Desplegando rama %BRANCH_NAME% (sustituir por el comando real de despliegue)'
            }
        }
    }

    post {
        always {
            echo "Resultado final: ${currentBuild.currentResult}"
            archiveArtifacts artifacts: 'backend/reports/**, frontend/dist/**', allowEmptyArchive: true
        }
        success {
            ciNotificar('SUCCESS')
        }
        failure {
            ciNotificar('FAILURE')
        }
        aborted {
            ciNotificar('ABORTED')
        }
    }
}
