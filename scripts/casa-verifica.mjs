// LA VERIFICA DI CASA — `npm run casa:verifica`
//
// Non scrive niente. Controlla che Casa sia ancora come la costruzione l'ha
// lasciata: registro delle migrazioni completo, lavori pianificati spenti,
// nessun indirizzo del cloud dentro il database, il blocco del cloud nel
// database, le porte verso il cloud chiuse, le porte di Casa solo sul PC,
// un titolare. La stessa verifica gira alla fine di `npm run casa:costruisci`
// e a ogni `npm run casa:accendi`.
//
// ⚠️ Se dice «raggiungibile dal database», il contenitore e' stato
// riavviato o ricreato e /etc/hosts e' tornato quello di fabbrica: si
// richiude con `npm run casa:accendi`.

import { fermati, titolo } from "./comune.mjs";
import { esitoRegistro } from "./ricostruzione-regole.mjs";
import { pretendiCasa, problemiDiCasa } from "./casa-comune.mjs";

titolo("Verifico Casa");
pretendiCasa();
const { problemi, registrate } = problemiDiCasa({ esitoRegistro });
if (problemi.length > 0) fermati("Casa NON e' a posto:", ...problemi.map((p) => `  · ${p}`));
console.log(`   a posto: ${registrate} migrazioni registrate, lavori spenti, niente cloud dentro, porte chiuse`);
