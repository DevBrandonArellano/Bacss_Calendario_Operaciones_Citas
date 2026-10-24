// Notifica el resultado del build a GitHub (commit status), Telegram y correo.
// Cada canal va en su propio try/catch: si uno falla (credencial o plugin ausente) el build no se rompe.
// Estado esperado: 'PENDING', 'SUCCESS', 'FAILURE' o 'ABORTED'.
def call(String estado) {
    notificarGithub(estado)
    notificarTelegram(estado)
    notificarCorreo(estado)
}

private void notificarGithub(String estado) {
    String ghEstado = [PENDING: 'pending', SUCCESS: 'success', FAILURE: 'failure', ABORTED: 'error'][estado] ?: 'error'
    String repo = env.GITHUB_REPO ?: 'DevBrandonArellano/Bacss_Calendario_Operaciones_Citas'
    String sha = env.GIT_COMMIT ?: ''
    if (!sha) {
        echo 'GitHub: no hay GIT_COMMIT, se omite el commit status.'
        return
    }
    try {
        withCredentials([string(credentialsId: 'github-token', variable: 'GH_TOKEN')]) {
            withEnv([
                "GH_STATE=${ghEstado}",
                "GH_URL=https://api.github.com/repos/${repo}/statuses/${sha}",
                "GH_DESC=Build Jenkins ${estado}",
                "GH_TARGET=${env.BUILD_URL}"
            ]) {
                powershell(script: '''
                    $body = @{
                        state       = $env:GH_STATE
                        context     = 'jenkins/operaciones-citas'
                        description = $env:GH_DESC
                        target_url  = $env:GH_TARGET
                    } | ConvertTo-Json
                    Invoke-RestMethod -Method Post -Uri $env:GH_URL `
                        -Headers @{ Authorization = "Bearer $($env:GH_TOKEN)"; Accept = 'application/vnd.github+json' } `
                        -Body $body -ContentType 'application/json' | Out-Null
                ''')
            }
        }
        echo "GitHub: commit status '${ghEstado}' publicado."
    } catch (err) {
        echo "GitHub: no se pudo publicar el estado (${err.message})."
    }
}

private void notificarTelegram(String estado) {
    if (estado == 'PENDING') {
        return
    }
    try {
        withCredentials([
            string(credentialsId: 'telegram-bot-token', variable: 'TG_TOKEN'),
            string(credentialsId: 'telegram-chat-id', variable: 'TG_CHAT')
        ]) {
            withEnv(["TG_TEXT=Build ${env.JOB_NAME} #${env.BUILD_NUMBER} (${env.BRANCH_NAME}): ${estado}\n${env.BUILD_URL}"]) {
                powershell(script: '''
                    Invoke-RestMethod -Method Post `
                        -Uri "https://api.telegram.org/bot$($env:TG_TOKEN)/sendMessage" `
                        -Body @{ chat_id = $env:TG_CHAT; text = $env:TG_TEXT } | Out-Null
                ''')
            }
        }
        echo 'Telegram: notificación enviada.'
    } catch (err) {
        echo "Telegram: no se pudo enviar (${err.message})."
    }
}

private void notificarCorreo(String estado) {
    if (estado == 'PENDING' || !env.NOTIFY_EMAIL) {
        return
    }
    try {
        emailext(
            to: env.NOTIFY_EMAIL,
            subject: "[Jenkins] ${env.JOB_NAME} #${env.BUILD_NUMBER} - ${estado}",
            body: "Rama: ${env.BRANCH_NAME}\nResultado: ${estado}\nDetalle: ${env.BUILD_URL}"
        )
        echo 'Correo: notificación enviada.'
    } catch (err) {
        echo "Correo: no se pudo enviar (${err.message})."
    }
}
