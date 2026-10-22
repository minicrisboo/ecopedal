const configuredApiUrl = document.querySelector('meta[name="ecopedal-api-url"]')?.content.trim().replace(/\/+$/, '') ?? '';
const unavailableMessage = configuredApiUrl
  ? 'La API de Ecopedal no responde. Comprueba que el servicio backend esté activo.'
  : 'Falta configurar la URL HTTPS de la API para GitHub Pages. Define la variable ECOPEDAL_API_URL en el repositorio.';

export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${configuredApiUrl}/api${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: {
        'X-Ecopedal-Client': 'web',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new Error(unavailableMessage);
  }
  if (response.status === 204) return null;
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(unavailableMessage);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error ?? 'No se pudo completar la solicitud.');
    error.status = response.status;
    throw error;
  }
  return payload;
}
