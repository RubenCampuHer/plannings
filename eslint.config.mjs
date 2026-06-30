import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // L'app és en català: apòstrofs (l', d', s'...) i cometes són constants
      // dins del text JSX. Escapar-los a &apos;/&quot; embruta la prosa que el
      // Ruben edita sovint i no aporta res aquí. Desactivem la regla.
      "react/no-unescaped-entities": "off",
      // Fem servir setState dins d'effects de forma intencionada per sincronitzar
      // amb estat extern només a client: restaurar de localStorage en mount
      // (mode del xat, posició del copilot), detectar mòbil, i re-sincronitzar
      // l'estat optimista de la checklist amb els props després d'un
      // revalidatePath. Tots eviten hydration mismatch i no són render cascades.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
