// Etapa reutilizable: dependencias (con caché npm), lint, chequeo de tipos, tests y build del frontend React.
def call() {
    dir('frontend') {
        bat 'npm ci --cache "%CI_CACHE_DIR%\\npm"'

        // Análisis de calidad: ESLint (configurado en frontend/eslint.config.js).
        bat 'npm run lint'
        bat 'npx tsc -b'

        bat 'npm run test'
        bat 'npm run build'
    }
}
