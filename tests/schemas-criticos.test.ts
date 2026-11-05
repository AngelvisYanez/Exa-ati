import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerSchema,
  registerApiSchema,
  contactoSchema,
  vincularSriSchema,
  empleadoSchema,
} from "../src/lib/schemas";

describe("schemas críticos", () => {
  it("loginSchema acepta email/RUC y password", () => {
    const r = loginSchema.safeParse({
      email: "admin@ofsercont.com",
      password: "secret12",
    });
    expect(r.success).toBe(true);
  });

  it("loginSchema rechaza vacíos", () => {
    const r = loginSchema.safeParse({ email: "", password: "" });
    expect(r.success).toBe(false);
  });

  it("registerSchema exige confirmación coincidente y datos de empresa", () => {
    const bad = registerSchema.safeParse({
      email: "a@b.com",
      password: "123456",
      confirmPassword: "xxxxxx",
      nombre: "Ana",
      razonSocial: "Demo SA",
      planCodigo: "emprendedor",
    });
    expect(bad.success).toBe(false);

    const good = registerSchema.safeParse({
      email: "a@b.com",
      password: "123456",
      confirmPassword: "123456",
      nombre: "Ana",
      razonSocial: "Demo SA",
      planCodigo: "emprendedor",
      periodo: "mensual",
    });
    expect(good.success).toBe(true);
  });

  it("registerApiSchema rechaza password corta", () => {
    const r = registerApiSchema.safeParse({
      email: "a@b.com",
      password: "123",
      razonSocial: "Demo",
    });
    expect(r.success).toBe(false);
  });

  it("registerApiSchema fuerza USER y rechaza ADMIN en registro público", () => {
    const asAdmin = registerApiSchema.safeParse({
      email: "a@b.com",
      password: "123456",
      rol: "ADMIN",
      razonSocial: "Demo SA",
    });
    expect(asAdmin.success).toBe(false);

    const asUser = registerApiSchema.safeParse({
      email: "a@b.com",
      password: "123456",
      razonSocial: "Demo SA",
      nombre: "Ana",
    });
    expect(asUser.success).toBe(true);
    if (asUser.success) {
      expect(asUser.data.rol).toBe("USER");
    }
  });

  it("registerApiSchema exige razonSocial si no hay tenantId", () => {
    const r = registerApiSchema.safeParse({
      email: "a@b.com",
      password: "123456",
    });
    expect(r.success).toBe(false);
  });

  it("contactoSchema valida identificación y flags", () => {
    const r = contactoSchema.safeParse({
      tipoIdentificacion: "04",
      identificacion: "1790000000001",
      razonSocial: "Demo SA",
      esCliente: true,
      esProveedor: false,
    });
    expect(r.success).toBe(true);
  });

  it("contactoSchema rechaza email inválido no vacío", () => {
    const r = contactoSchema.safeParse({
      tipoIdentificacion: "05",
      identificacion: "1710034065",
      razonSocial: "Persona",
      email: "no-email",
      esCliente: true,
      esProveedor: false,
    });
    expect(r.success).toBe(false);
  });

  it("vincularSriSchema exige RUC 13 dígitos", () => {
    expect(
      vincularSriSchema.safeParse({ ruc: "123", password: "x" }).success
    ).toBe(false);
    expect(
      vincularSriSchema.safeParse({
        ruc: "1790000000001",
        password: "clave",
      }).success
    ).toBe(true);
  });

  it("empleadoSchema exige cédula 10 dígitos", () => {
    expect(
      empleadoSchema.safeParse({
        cedula: "123",
        nombres: "A",
        apellidos: "B",
        sueldo: 500,
        activo: true,
      }).success
    ).toBe(false);
    expect(
      empleadoSchema.safeParse({
        cedula: "1710034065",
        nombres: "Ana",
        apellidos: "Pérez",
        sueldo: 500,
        activo: true,
      }).success
    ).toBe(true);
  });
});
