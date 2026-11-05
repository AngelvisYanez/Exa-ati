import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Directorios generados / de terceros fuera del alcance del app:
    "workers/**",
    "scripts/buster/**",
    ".wrangler/**",
    ".wwebjs_cache/**",
    ".wwebjs_auth/**",
    ".node-persist/**",
    ".vercel/**",
    "browser_session/**",
    "downloads/**",
    "logs/**",
    "tmp/**",
    "nginx/**",
    // Configuración / skills de agentes de terceros:
    ".github/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    ".cursor/**",
    ".impeccable/**",
    "scripts/tmp-*.ts",
    "scripts/tmp-*.tsx",
    "scripts/tmp-*.cjs",
    "scripts/scratch/**",
    "*.tgz",
  ]),
  {
    rules: {
      // Reglas estilísticas masivas del código existente: se mantienen
      // visibles como warning pero no bloquean el lint.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "prefer-const": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
