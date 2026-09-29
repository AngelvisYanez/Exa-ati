import { describe, expect, it } from "vitest";
import {
  consumeMobileCode,
  createMobileCode,
} from "@/services/sri-api/mobile-code-store";

describe("mobile-code-store", () => {
  it("crea código de un solo uso y lo consume una vez", () => {
    const code = createMobileCode({
      userId: "user-1",
      email: "a@b.com",
      rol: "ADMIN",
      tenantId: "tenant-1",
    });
    expect(code).toMatch(/^[a-f0-9]{32}$/);

    const first = consumeMobileCode(code);
    expect(first).toMatchObject({
      userId: "user-1",
      email: "a@b.com",
      rol: "ADMIN",
      tenantId: "tenant-1",
    });

    expect(consumeMobileCode(code)).toBeNull();
  });

  it("rechaza código inexistente", () => {
    expect(consumeMobileCode("no-existe")).toBeNull();
  });
});
