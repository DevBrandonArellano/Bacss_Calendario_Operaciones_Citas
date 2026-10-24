// Devuelve qué áreas del repo cambiaron desde el último build exitoso.
// Si no se puede calcular el diff, ejecuta todo (modo seguro).
def call() {
    String base = env.GIT_PREVIOUS_SUCCESSFUL_COMMIT ?: ''
    String rango = base ? "${base} HEAD" : 'HEAD~1 HEAD'

    String salida
    try {
        salida = bat(script: "@git diff --name-only ${rango}", returnStdout: true).trim()
    } catch (err) {
        echo 'No se pudo calcular el diff; se ejecutan todas las etapas.'
        return [backend: true, frontend: true]
    }

    List<String> archivos = salida.readLines().findAll { it?.trim() }
    if (archivos.isEmpty()) {
        return [backend: true, frontend: true]
    }

    boolean compartido = archivos.any { it == 'Jenkinsfile' || it.startsWith('jenkins-shared-library/') }
    return [
        backend : compartido || archivos.any { it.startsWith('backend/') },
        frontend: compartido || archivos.any { it.startsWith('frontend/') }
    ]
}
