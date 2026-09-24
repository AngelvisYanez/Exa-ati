/**
 * Critical-flow smoke tests against a running Next.js server.
 * Usage: node scripts/dev/api-smoke.mjs [baseUrl]
 * Default baseUrl: http://localhost:3000
 */
const BASE = process.argv[2] || process.env.SMOKE_BASE_URL || "http://localhost:3000";

const results = [];

function ok(name, detail) {
  results.push({ name, pass: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail) {
  results.push({ name, pass: false, detail });
  console.error(`FAIL  ${name} — ${detail}`);
}

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, text, json, status: res.status, headers: res.headers };
}

async function main() {
  console.log(`API smoke → ${BASE}\n`);

  // Health: login page renders
  {
    const { status, text } = await req("/login");
    if (status === 200 && (text.includes("Inicia sesión") || text.includes("login") || text.includes("OFSERCONT") || text.includes("EXA"))) {
      ok("GET /login", `status ${status}`);
    } else {
      fail("GET /login", `status ${status}, body length ${text.length}`);
    }
  }

  // Middleware: protected page without cookie → redirect to login
  {
    const { status, headers } = await req("/");
    const loc = headers.get("location") || "";
    if (status === 307 || status === 302 || status === 303) {
      if (loc.includes("/login")) ok("middleware redirects / → /login", `status ${status}`);
      else fail("middleware redirects / → /login", `location=${loc}`);
    } else if (status === 200) {
      // Client-side auth may still render shell; cookie gate might not apply if matcher missed
      fail("middleware redirects / → /login", `got 200 (expected redirect). Check middleware cookie gate.`);
    } else {
      fail("middleware redirects / → /login", `status ${status}`);
    }
  }

  // Login Zod validation
  {
    const { status, json } = await req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "", password: "" }),
    });
    if (status === 400 && (json?.message || json?.errors)) {
      ok("POST /api/auth/login empty → 400", json.message);
    } else {
      fail("POST /api/auth/login empty → 400", `status ${status} body=${JSON.stringify(json)}`);
    }
  }

  {
    const { status, json } = await req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "nobody@example.com", password: "wrong-password-xyz" }),
    });
    if (status === 401) {
      ok("POST /api/auth/login bad credentials → 401", json?.message);
    } else if (status === 500) {
      fail("POST /api/auth/login bad credentials → 401", `DB/server error: ${json?.message}`);
    } else {
      fail("POST /api/auth/login bad credentials → 401", `status ${status}`);
    }
  }

  // Register Zod validation
  {
    const { status, json } = await req("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email", password: "123" }),
    });
    if (status === 400) {
      ok("POST /api/auth/register invalid → 400", json?.message);
    } else {
      fail("POST /api/auth/register invalid → 400", `status ${status}`);
    }
  }

  // Contactos without auth
  {
    const { status, json } = await req("/api/contactos", { method: "GET" });
    if (status === 401) {
      ok("GET /api/contactos no auth → 401", json?.message);
    } else {
      fail("GET /api/contactos no auth → 401", `status ${status}`);
    }
  }

  {
    const { status, json } = await req("/api/contactos", {
      method: "POST",
      body: JSON.stringify({
        tipoIdentificacion: "04",
        identificacion: "1790000000001",
        razonSocial: "Test SA",
        esCliente: true,
        esProveedor: false,
      }),
    });
    if (status === 401) {
      ok("POST /api/contactos no auth → 401", json?.message);
    } else {
      fail("POST /api/contactos no auth → 401", `status ${status}`);
    }
  }

  // Contactos invalid body with fake bearer still 401 before parse... or 400 if auth mocked
  // Config endpoint without auth
  {
    const { status } = await req("/api/configuracion");
    if (status === 401 || status === 404) {
      ok("GET /api/configuracion protected", `status ${status}`);
    } else if (status === 500) {
      fail("GET /api/configuracion protected", "500 — possible unhandled auth");
    } else {
      // 200 without auth would be a problem
      if (status === 200) fail("GET /api/configuracion protected", "200 without auth");
      else ok("GET /api/configuracion protected", `status ${status}`);
    }
  }

  // robots.txt
  {
    const { status, text } = await req("/robots.txt");
    if (status === 200 && text.toLowerCase().includes("disallow")) {
      ok("GET /robots.txt", "has disallow rules");
    } else {
      fail("GET /robots.txt", `status ${status}`);
    }
  }

  // Register page
  {
    const { status } = await req("/register");
    if (status === 200) ok("GET /register", `status ${status}`);
    else fail("GET /register", `status ${status}`);
  }

  // Authenticated happy path (ephemeral user)
  const stamp = Date.now();
  const email = `smoke_${stamp}@example.com`;
  const password = `Smoke${stamp}!a`;
  let accessToken = null;

  {
    const { status, json } = await req("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        nombre: "Smoke Test",
      }),
    });
    if (status === 201 && json?.success) {
      ok("POST /api/auth/register create user", email);
    } else {
      fail("POST /api/auth/register create user", `status ${status} ${JSON.stringify(json)}`);
    }
  }

  {
    const { status, json, headers } = await req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const setCookie = headers.getSetCookie?.() || [];
    const cookieHeader = headers.get("set-cookie") || "";
    const hasHttpOnly =
      setCookie.some((c) => c.includes("sri_access_token") && /httponly/i.test(c)) ||
      (/sri_access_token/i.test(cookieHeader) && /httponly/i.test(cookieHeader));

    if (status === 200 && json?.accessToken) {
      accessToken = json.accessToken;
      ok("POST /api/auth/login success", `rol=${json.user?.rol}`);
      if (hasHttpOnly) ok("login sets httpOnly cookie", "sri_access_token");
      else fail("login sets httpOnly cookie", `set-cookie=${cookieHeader.slice(0, 120)}`);
    } else {
      fail("POST /api/auth/login success", `status ${status}`);
    }
  }

  if (accessToken) {
    {
      const { status, json } = await req("/api/contactos", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (status === 200 && Array.isArray(json?.data)) {
        ok("GET /api/contactos auth", `${json.data.length} items`);
      } else {
        fail("GET /api/contactos auth", `status ${status} ${JSON.stringify(json)?.slice(0, 200)}`);
      }
    }

    {
      const ident = String(stamp).slice(-10).padStart(10, "1");
      const { status, json } = await req("/api/contactos", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          tipoIdentificacion: "05",
          identificacion: ident,
          razonSocial: `Contacto Smoke ${stamp}`,
          esCliente: true,
          esProveedor: false,
        }),
      });
      if (status === 201 && json?.data?.id) {
        ok("POST /api/contactos auth create", json.data.id);
      } else if (status === 400 && json?.errors) {
        fail("POST /api/contactos auth create", `validation: ${JSON.stringify(json.errors)}`);
      } else {
        fail("POST /api/contactos auth create", `status ${status} ${JSON.stringify(json)?.slice(0, 300)}`);
      }
    }

    {
      const { status } = await req("/api/auth/logout", { method: "POST" });
      if (status === 200) ok("POST /api/auth/logout", `status ${status}`);
      else fail("POST /api/auth/logout", `status ${status}`);
    }
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Smoke runner error:", e.message);
  console.error("Is the Next.js server running? Try: npm run dev");
  process.exit(1);
});
