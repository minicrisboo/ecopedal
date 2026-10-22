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

## Desplegar en Cloudflare Workers + D1

El despliegue completo usa un Cloudflare Worker para servir el frontend y la API desde el mismo origen, más D1 enlazada como recurso interno. D1 cifra los datos en reposo con AES-256 y el tráfico con TLS, administrados por Cloudflare. No se crea una URL pública para conectarse directamente a la base.

El código está en [github.com/minicrisboo/ecopedal](https://github.com/minicrisboo/ecopedal). Para publicar cambios futuros:

```powershell
git add .
git commit -m "Actualizar Ecopedal"
git push origin main
```

Para activar el despliegue automático:

1. En Cloudflare crea un API Token con permisos de **Workers Scripts: Edit**, **D1: Edit** y **Account Settings: Read**. No lo compartas ni lo guardes en este repositorio.
2. En GitHub abre **Settings > Secrets and variables > Actions** y añade los Secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` y `ECOPEDAL_ADMIN_PASSWORD`; añade la Variable `ECOPEDAL_ADMIN_EMAIL`.
3. Activa el subdominio `workers.dev` de tu cuenta Cloudflare. Luego ejecuta el workflow **Deploy Ecopedal to Cloudflare** desde **Actions**. El workflow crea D1 automáticamente, aplica `migrations/0001_initial.sql`, despliega frontend/API y configura las credenciales iniciales de administrador sin imprimirlas.

El plan gratuito de D1 no tiene una fecha de expiración programada como Render, pero **no es ilimitado ni una garantía perpetua**: incluye hasta 500 MB por base, 5 GB de almacenamiento por cuenta, 5 millones de filas leídas por día y 100.000 filas escritas por día. Si se exceden cuotas, D1 rechaza consultas; el límite de datos puede alcanzar 10 GB en planes pagos. El plan gratuito no incluye backups descargables y Time Travel conserva 7 días.

La D1 nueva se inicia con bicicletas y contenido de demostración; **las cuentas y reservas que están en Render no se copian automáticamente**. Mantén Render como respaldo mientras verificas Cloudflare y exportas los datos que necesites. Después podrás suspender/eliminar Render manualmente si ya confirmaste la migración.

GitHub Pages sigue activo como frontend estático; el flujo completo de login y base interna estará en la URL `workers.dev` que aparezca en el workflow de Cloudflare.

La aplicación no procesa pagos. Antes de aceptar reservas reales, integra un proveedor de pagos y define políticas de cancelación y protección de datos.
