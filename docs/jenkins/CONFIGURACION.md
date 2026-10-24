# Pipeline Jenkins — Operaciones_Citas

## 1. Estrategia de ramas

| Rama | Propósito | Etapas que corren |
|---|---|---|
| `feature/*` | Trabajo individual, se integra por Pull Request a `staging` | 1 y 2 (integración, build, lint, tests) |
| `staging` | Pre-producción. Cada merge despliega a staging | 1, 2 y 3 (despliegue automático) |
| `main` | Producción. Solo entra código validado desde `staging` | 1, 2 y 3 (despliegue con aprobación manual) |

Flujo: `feature/*` → PR → `staging` (despliegue) → PR → `main` (aprobación y despliegue).

Ramas creadas localmente: `main` y `staging` (apuntan al mismo commit por ahora).

## 2. Estructura de archivos añadidos

```
Jenkinsfile                                   Pipeline principal (3 etapas + post)
jenkins-shared-library/vars/ciCambios.groovy  Ejecución selectiva (qué cambió)
jenkins-shared-library/vars/ciBackend.groovy  Etapa reutilizable: Django (ruff, migrate, pytest)
jenkins-shared-library/vars/ciFrontend.groovy Etapa reutilizable: React (eslint, tsc, vitest, build)
jenkins-shared-library/vars/ciNotificar.groovy Notificaciones: GitHub, Telegram, correo
docs/jenkins/CONFIGURACION.md                 Esta guía
```

## 3. Estrategias de optimización aplicadas

- **Ejecución paralela:** la etapa 2 corre Backend y Frontend al mismo tiempo (`parallel`).
- **Caché:** pip usa `PIP_CACHE_DIR=C:\jenkins-cache\pip` y npm usa `--cache C:\jenkins-cache\npm`. Las descargas se reutilizan entre builds.
- **Ejecución selectiva:** `ciCambios` hace `git diff` desde el último build exitoso; si solo cambió `frontend/`, no se ejecuta el backend (y viceversa). Un cambio en `Jenkinsfile` o en la librería ejecuta todo.
- **Por ramas:** `when { branch ... }` decide si la etapa 3 corre (solo `staging` y `main`).
- **Modular y reutilizable:** la lógica vive en la librería compartida (`vars/`). Otros proyectos pueden reutilizar `ciBackend()`, `ciFrontend()` y `ciNotificar()` sin copiar código.
- **Post:** `always` archiva reportes; `success`, `failure` y `aborted` notifican (GitHub commit status, Telegram y correo).

## 4. Requisitos en la máquina de Jenkins (Windows)

1. **Git** en el PATH (`git --version`).
2. **Python 3.11+**. Si el servicio de Jenkins no lo encuentra en el PATH, define la variable de entorno global `PYTHON_BIN` con la ruta completa (*Administrar Jenkins → System → Global properties → Environment variables*), por ejemplo `C:\Users\arebr\AppData\Local\Programs\Python\Python311\python.exe`.
3. **Node.js 20+** en el PATH (`node --version`).
4. **PostgreSQL 16 y Redis 7** accesibles en `localhost:5432` y `localhost:6379`, con usuario/base `operaciones_citas` (mismos valores que `.github/workflows/ci.yml`). La forma más fácil es levantarlos con Docker:

```bash
docker compose up -d db redis
```

5. Crear la carpeta de caché:

```bash
mkdir C:\jenkins-cache
```

## 5. Plugins de Jenkins necesarios

Desde **Administrar Jenkins → Plugins → Available**:

- Pipeline, Pipeline: Groovy, Pipeline: Shared Groovy Libraries
- Git, GitHub, GitHub Branch Source (para la rama/PR automática)
- Email Extension (`emailext`) — solo si usarás correo
- Timestamper (opcional, la opción `timestamps()` lo usa)

## 6. Configurar la librería compartida

**Administrar Jenkins → System → Global Trusted Pipeline Libraries** (o *Global Pipeline Libraries* en versiones anteriores):

- **Name:** `operaciones-citas-lib` (debe coincidir con `@Library('operaciones-citas-lib')` del Jenkinsfile)
- **Default version:** `main`
- **Load implicitly:** desmarcado
- **Retrieval method:** Modern SCM → Git
- **Project Repository:** la URL del repo (`https://github.com/DevBrandonArellano/Bacss_Calendario_Operaciones_Citas.git`)
- **Library Path:** `jenkins-shared-library`

Si el repo es privado, crea una credencial de tipo *Username with password* (usuario de GitHub + token) y selecciónala en *Credentials*.

## 7. Crear el job

1. **New Item → Multibranch Pipeline** (importante: sin esto `BRANCH_NAME` y los `when { branch }` no funcionan).
2. **Branch Sources → GitHub** (o Git) → apuntar al repositorio y elegir la credencial.
3. **Build Configuration → by Jenkinsfile**, *Script Path*: `Jenkinsfile`.
4. Guardar. Jenkins escaneará las ramas `main`, `staging` y `feature/*`.

## 8. Credenciales a crear

En **Administrar Jenkins → Credentials → (global) → Add Credentials**:

| ID | Tipo | Para qué |
|---|---|---|
| `github-token` | Secret text | Publicar el estado del commit en GitHub. Token de GitHub con permiso `repo:status` (o `Commit statuses` en tokens de grano fino). |
| `telegram-bot-token` | Secret text | Token del bot (se crea con @BotFather). Opcional. |
| `telegram-chat-id` | Secret text | ID del chat donde llegan los avisos. Opcional. |

Para correo, configura el SMTP en **System → Extended E-mail Notification** y pon la dirección en la variable `NOTIFY_EMAIL` del Jenkinsfile (o en *Configure* del job). Si un canal no está configurado, Jenkins solo deja un mensaje en el log y el build sigue.

## 9. Probar el pipeline

1. Crear una rama de prueba: `feature/prueba-jenkins` con un cambio pequeño en `frontend/` o `backend/`.
2. Verificar que solo corre la etapa 2 correspondiente y que el commit status aparece en GitHub.
3. Hacer merge a `staging`: deben correr las etapas 1, 2 y 3.
4. En `main`, la etapa 3 pide aprobación antes de desplegar.

## 10. Puntos a conocer

- El despliegue de la etapa 3 es un **placeholder** (`echo`). Reemplázalo por el comando real de tu entorno cuando lo tengas.
- Las etapas de lint y tests **fallarán si el código actual no cumple** `ruff format --check` o ESLint. Eso es el comportamiento esperado de un pipeline de calidad; corrige los errores o ajusta la regla.
- Cypress/Selenium no están incluidos: las pruebas de frontend actuales son Vitest. SonarQube tampoco, porque requiere un servidor propio.
- Validar el Jenkinsfile sin ejecutar un build (reemplaza `USUARIO:TOKEN` por tus datos; no lo compartas):

```bash
curl -u USUARIO:TOKEN -F "jenkinsfile=<Jenkinsfile" http://localhost:8080/pipeline-model-converter/validate
```
