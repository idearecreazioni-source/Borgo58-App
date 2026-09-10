import { afterAll } from "vitest";

import { chiudiSessioniAperte } from "./aiuto";

// DOPO OGNI FILE DI PROVE SUL DATABASE, SI CHIUDONO LE SESSIONI APERTE.
//
// ⚠️ Gira per ULTIMO, dopo le pulizie del file: i ganci di chiusura si
//    eseguono in ordine inverso a quello in cui sono stati registrati, e
//    questo si registra prima di tutti. Le pulizie di un file usano ancora
//    le sue sessioni, quindi chiuderle prima le romperebbe.
//
// Il perché, coi numeri, è accanto a `chiudiSessioniAperte` in `aiuto.js`.
afterAll(async () => {
  await chiudiSessioniAperte();
});
