/** Helpers de código de método de pago (safe para client y server). */

export function slugifyMetodoCodigo(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30);
}

export function isMetodoCodigo(value: string): boolean {
  return /^[A-Z0-9_]{2,30}$/.test(value);
}
