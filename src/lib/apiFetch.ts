/**
 * Wrapper sobre fetch para inyectar automáticamente el token de autorización
 * y el RUC seleccionado para los endpoints que requieren autenticación,
 * sin depender de sriClient que podría ser muy pesado.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const isClient = typeof window !== 'undefined';
  
  const token = isClient ? localStorage.getItem('sri_access_token') : null;
  const selectedRuc = isClient ? localStorage.getItem('sri_selected_ruc') : null;

  const headers = new Headers(init?.headers);

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (selectedRuc && !headers.has('x-selected-ruc')) {
    headers.set('x-selected-ruc', selectedRuc);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
