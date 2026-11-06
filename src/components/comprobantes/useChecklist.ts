export interface ReglaChecklist {
  label: string;
  ok: boolean;
}

export interface ChecklistEstado {
  items: readonly ReglaChecklist[];
  completados: number;
  total: number;
  /** De 0 a 100. */
  progreso: number;
  ready: boolean;
}

export function useChecklist(reglas: readonly ReglaChecklist[]): ChecklistEstado {
  const completados = reglas.filter((regla) => regla.ok).length;
  const total = reglas.length;
  return {
    items: reglas,
    completados,
    total,
    progreso: total === 0 ? 0 : (completados / total) * 100,
    ready: total > 0 && completados === total,
  };
}

export interface PasoInput {
  label: string;
  done: boolean;
}

export type EstadoPaso = "completo" | "actual" | "pendiente";

export interface Paso extends PasoInput {
  /** Número visible, desde 1. Coincide con el id `paso-{n}` de su sección. */
  n: number;
  estado: EstadoPaso;
}

export interface StepperEstado {
  steps: Paso[];
  /** Número del paso actual: el primero sin completar, o el último si todos lo están. */
  actual: number;
  progreso: number;
  ready: boolean;
}

export function useStepper(pasos: readonly PasoInput[]): StepperEstado {
  const pendiente = pasos.findIndex((paso) => !paso.done);
  const actual = pendiente === -1 ? pasos.length : pendiente + 1;
  const completados = pasos.filter((paso) => paso.done).length;
  const steps = pasos.map((paso, index): Paso => {
    const n = index + 1;
    const secuenciaLista = pasos.slice(0, index + 1).every((item) => item.done);
    const estado: EstadoPaso = n === actual ? "actual" : secuenciaLista ? "completo" : "pendiente";
    return { ...paso, n, estado };
  });
  return {
    steps,
    actual,
    progreso: pasos.length === 0 ? 0 : (completados / pasos.length) * 100,
    ready: pasos.length > 0 && completados === pasos.length,
  };
}
