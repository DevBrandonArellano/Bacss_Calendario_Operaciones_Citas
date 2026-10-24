// Etapa reutilizable: dependencias (con caché pip), linter, formato, migraciones y tests del backend Django.
def call() {
    // El servicio de Jenkins no siempre ve el Python del usuario; PYTHON_BIN permite fijar la ruta.
    String python = env.PYTHON_BIN ?: 'python'
    dir('backend') {
        bat "if not exist .venv \"${python}\" -m venv .venv"
        bat '.venv\\Scripts\\python -m pip install --upgrade pip'
        bat '.venv\\Scripts\\python -m pip install -e ".[dev]"'

        // Análisis de calidad: linter y verificación de formato (ruff, configurado en pyproject.toml).
        bat '.venv\\Scripts\\ruff check .'
        bat '.venv\\Scripts\\ruff format --check .'

        bat '.venv\\Scripts\\python manage.py migrate'
        bat '.venv\\Scripts\\pytest --junitxml=reports\\pytest.xml'
    }
}
