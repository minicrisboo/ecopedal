# Ecopedal

Marketplace P2P de bicicletas con frontend HTML/CSS/ES modules, API Node.js/Express y PostgreSQL. Docker Compose inicia la aplicación, el backend y la base de datos persistente.

## Requisitos

- Docker Desktop con Docker Compose v2.
- PowerShell, Terminal o una shell compatible.

## Ejecutar con Docker

Desde la carpeta raíz del proyecto:

```powershell
Copy-Item .env.example .env
```

Edita `.env` y reemplaza todos los valores `replace-with-...` por credenciales propias, únicas y seguras. Después inicia los servicios:

```powershell
docker compose up --build
```

Abre `http://localhost:8080`. Live Server sirve solo la interfaz mientras `index.html` no tenga una URL de API configurada; para probar el stack local usa Docker Compose.

El administrador inicial se crea con `ADMIN_EMAIL` y `ADMIN_PASSWORD` de `.env`. No hay selector público de perfiles: el registro permite crear cuentas de Cliente o Propietario. El Administrador puede asignar roles de Editor o Administrador desde su panel.

Para ejecutarlo en segundo plano usa `docker compose up --build -d`; consulta los registros con `docker compose logs -f web api db` y detén los servicios con `docker compose down`. La base de datos permanece en el volumen `ecopedal-db` al detener los contenedores. No uses `docker compose down -v` salvo que quieras borrar también los datos.

## Publicar el frontend en GitHub Pages

GitHub Pages solo ejecuta el frontend estático. La API y PostgreSQL deben estar publicados por separado en un proveedor que admita Node/Docker y una base de datos persistente. No subas `.env` ni credenciales al repositorio.

El código fuente está en [github.com/minicrisboo/ecopedal](https://github.com/minicrisboo/ecopedal). Para publicar cambios futuros desde esta carpeta:

```powershell
git add .
git commit -m "Actualizar Ecopedal"
git push origin main
```

1. Despliega `backend/` y PostgreSQL en un proveedor cloud que acepte contenedores. Usa `backend/Dockerfile` para el servicio API y configura `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` (mínimo 32 caracteres), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (mínimo 12 caracteres), `SESSION_COOKIE_SAME_SITE=none` y `FRONTEND_ORIGINS=https://TU_USUARIO.github.io`. Usa la URL HTTPS pública del backend.
2. En GitHub abre **Settings > Secrets and variables > Actions > Variables** y crea `ECOPEDAL_API_URL` con el origen HTTPS de la API, por ejemplo `https://api.tu-dominio.com` (sin `/api`).
3. Abre **Settings > Pages**, selecciona **GitHub Actions** como fuente. Después de subir cambios a `main`, el workflow `.github/workflows/deploy-pages.yml` publicará solo `index.html`, `styles.css` y `js/`.

El backend acepta únicamente los orígenes declarados en `FRONTEND_ORIGINS`; la API usa cookies `Secure`/`HttpOnly` y cabecera anti-CSRF. Para una sesión con cookies más fiable, usa un dominio propio para ambos servicios bajo el mismo dominio registrable, por ejemplo `app.tu-dominio.com` y `api.tu-dominio.com`. Algunos navegadores bloquean cookies entre `github.io` y otro dominio. La alternativa es servir frontend y API desde el mismo dominio con Docker Compose.

GitHub Pages no publica ni ejecuta el backend, y `localhost` nunca es una URL pública. Para que otras personas accedan, Pages y el backend deben quedar desplegados y la variable `ECOPEDAL_API_URL` debe apuntar a la API real. No expongas PostgreSQL directamente a Internet.

### Desplegar app, API y PostgreSQL en Render

El archivo `render.yaml` define la aplicación completa (frontend + API en el mismo origen) y PostgreSQL. En Render, crea un **Blueprint** desde `https://github.com/minicrisboo/ecopedal`; Render leerá esa definición y te pedirá `ADMIN_EMAIL` y `ADMIN_PASSWORD` directamente en su panel. No pegues esos valores en GitHub ni en este chat. El sitio estará en `https://ecopedal-app.onrender.com`; ahí el login usa cookies del mismo origen y no depende de cookies de terceros.

El Blueprint usa recursos gratuitos para una demostración. Render apaga el servicio web tras inactividad y su PostgreSQL gratuito vence a los 30 días; no lo uses para datos importantes. Para conservar cuentas y reservas, cambia la base de datos a un plan pagado antes de que venza y revisa los precios actuales de Render.

GitHub Pages sigue disponible como frontend estático; el login completo debe usarse desde el sitio Render. Si conectas Pages a la API, algunos navegadores pueden bloquear la cookie cross-site entre `github.io` y `onrender.com`.

La aplicación no procesa pagos. Antes de aceptar reservas reales, integra un proveedor de pagos y define políticas de cancelación y protección de datos.
