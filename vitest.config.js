import { defineConfig } from "vitest/config";
import { existsSync, readFileSync } from "node:fs";

// Carica le credenziali degli utenti di PROVA da .env.test (mai committato:
// coperto da .gitignore). Serve solo a `npm run test:app`; le prove di
// unità (`npm run test`) non ne hanno bisogno.
function credenzialiDiProva() {
  const out = {};
  if (existsSync(".env.test")) {
    for (const riga of readFileSync(".env.test", "utf8").split(/\r?\n/)) {
      const m = riga.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  }
  return out;
}

export default defineConfig({
  test: {
    environment: "node",
    // Le prove sulle date presumono l'orologio del locale (Europe/Rome):
    // e' esattamente il comportamento che l'app deve avere sui tablet.
    env: { TZ: "Europe/Rome", ...credenzialiDiProva() },
    // Le prove contro il database vero possono richiedere qualche secondo.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
