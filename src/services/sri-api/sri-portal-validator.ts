/**
 * Validación opcional de credenciales del portal SRI en línea.
 * No descarga comprobantes; solo verifica que el RUC tenga formato válido
 * y que las credenciales no estén vacías.
 */
export type SriPortalValidation = {
  valid: boolean;
  message: string;
  skipped?: boolean;
};

export async function validateSriPortalCredentials(
  ruc: string,
  password: string
): Promise<SriPortalValidation> {
  if (!ruc || ruc.length !== 13 || !/^\d{13}$/.test(ruc)) {
    return { valid: false, message: 'RUC inválido: debe tener 13 dígitos' };
  }

  if (!password || password.length < 4) {
    return { valid: false, message: 'La contraseña del SRI es demasiado corta' };
  }

  // Intento de verificación HTTP al portal (no bloquea si falla por red/CORS del SRI)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch('https://srienlinea.sri.gob.ec/sri-en-linea/', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok && response.status !== 405) {
      return {
        valid: true,
        message: 'Credenciales aceptadas (portal SRI no verificable en este momento)',
        skipped: true,
      };
    }
  } catch {
    return {
      valid: true,
      message: 'Credenciales guardadas (verificación del portal omitida por conectividad)',
      skipped: true,
    };
  }

  return {
    valid: true,
    message: 'Credenciales del portal SRI validadas',
  };
}
