/** Prefijos permitidos con plan vencido o pendiente de pago (cliente + docs). */
export const VENCIDO_ALLOWED_PREFIXES = [
  "/suscripcion",
  "/facturacion",
  "/registro",
  "/configuracion",
  "/iniciar-sesion",
];

export function isPathAllowedWhenVencido(pathname: string): boolean {
  return VENCIDO_ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/** Plan sin acceso operativo: vencido o pendiente de primer pago. */
export function isPlanBlocked(planEstado: string | null | undefined): boolean {
  return planEstado === "vencido" || planEstado === "pendiente";
}
