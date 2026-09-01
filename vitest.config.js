import { defineConfig } from "vitest/config";

// LE PROVE CHE NON TOCCANO NIENTE — `npm run test`.
//
// 🔴 QUI DENTRO NON C'E' NESSUNA CONFIGURAZIONE DEL DATABASE, ed e' una
//    correzione del 01/09/2026. Prima questo file leggeva `.env` e
//    infilava le chiavi del progetto di prova in `test.env`, che vitest
//    applica a **tutte** le prove: quindi la configurazione delle prove
//    contro il database decideva anche l'ambiente di quelle pure, che col
//    database non c'entrano niente.
//
//    ⚠️ NON ERA UNA BRUTTEZZA: aveva gia' morso. Un `PROVA_SUPABASE_URL`
//    scritto male copriva il `VITE_SUPABASE_URL` buono e faceva fallire
//    `npm run test` con «Invalid supabaseUrl» — su prove che non aprono
//    nessun collegamento. Il difetto e' stato trovato da Alessio il
//    31/08 e curato mettendo un rifiuto piu' preciso; la cura vera e'
//    che le due cose non si tocchino, e sta nella separazione dei file.
//
//    La configurazione del progetto di prova vive ora in
//    `vitest.app.config.js`, che serve al solo `npm run test:app`.
//
// ⚠️ Le prove sulle date presumono l'orologio del locale (Europe/Rome):
//    e' esattamente il comportamento che l'app deve avere sui tablet.
export default defineConfig({
  test: {
    environment: "node",
    env: { TZ: "Europe/Rome" },
  },
});
