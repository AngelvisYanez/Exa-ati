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

  it("registerSchema exige confirmación coincidente", () => {
    const bad = registerSchema.safeParse({
      email: "a@b.com",
      password: "123456",
      confirmPassword: "xxxxxx",
    });
    expect(bad.success).toBe(false);

    const good = registerSchema.safeParse({
      email: "a@b.com",
      password: "123456",
      confirmPassword: "123456",
      nombre: "Ana",
    });
    expect(good.success).toBe(true);
  });

  it("registerApiSchema rechaza password corta", () => {
    const r = registerApiSchema.safeParse({
      email: "a@b.com",
      password: "123",
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
