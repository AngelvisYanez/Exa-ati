import { describe, it, expect } from "vitest";
import { renderTemplate, previewPlantilla } from "@/services/email/templates";

describe("email templates", () => {
  it("renderTemplate sustituye variables", () => {
    expect(renderTemplate("Hola {{nombre}}", { nombre: "Ana" })).toBe("Hola Ana");
    expect(renderTemplate("X {{faltante}} Y", {})).toBe("X  Y");
  });

  it("previewPlantilla produce asunto y html", () => {
    const preview = previewPlantilla({
      codigo: "bienvenida",
      nombre: "Bienvenida",
      descripcion: null,
      asunto: "Hola {{nombre}} — {{app_nombre}}",
      cuerpoHtml: "<p>{{email}}</p>",
      cuerpoTexto: "{{email}}",
      variables: ["nombre", "email", "app_nombre"],
      activo: true,
      updatedAt: null,
    });
    expect(preview.subject).toContain("María Pérez");
    expect(preview.html).toContain("maria@ejemplo.com");
  });
});
