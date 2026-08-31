import { supabase } from "../supabase";

let cache = null;

// 🔴 LA CACHE NON SCADEVA MAI, e su questo gestionale non e' un dettaglio:
// il tablet resta acceso sul bancone e la pagina puo' non ricaricarsi per
// giorni (CLAUDE.md lo dice della sala). Un soggetto nato dopo l'apertura
// della pagina — ed e' esattamente quello che e' successo alla tasca,
// entrata in produzione all'01:06 di stanotte — **non sarebbe comparso mai**,
// e chi guarda vede un menu con due voci senza nessun errore.
// ⚠️ Mezz'ora e' lunga abbastanza da non pesare (i soggetti sono tre righe
// che non cambiano mai) e corta abbastanza da non far passare una giornata.
const DURATA_CACHE_MS = 30 * 60 * 1000;
let cacheScadeIl = 0;

// I soggetti sono seed fisse — poche letture, va bene una cache in-memory
// semplice invece di un context/provider dedicato.
//
// 🔴 DAL 30/08 SONO TRE, e il terzo NON e' una societa': «la tasca» e' il
//    contante che Alessio spende di suo per il progetto, senza documento.
// ⚠️ E QUESTA FORMA E' CIO' CHE LO TIENE FUORI DALLA PROIEZIONE FISCALE
//    SENZA NESSUN FILTRO DA RICORDARE: chi apre un menu a tendina nomina i
//    soggetti che vuole (`entities.srls`, `entities.agricola`), quindi le
//    diciannove schermate che esistevano prima di oggi **non possono**
//    offrirlo — non perche' qualcuno si e' ricordato di escluderlo, ma
//    perche' non lo nominano. E' la forma «per costruzione» che Alessio ha
//    chiesto al posto di un promemoria.
// ⚠️ Il divieto vero non sta comunque qui: sta nel database (migrazione
//    `20260830000012`), perche' una regola nella schermata la aggira
//    chiunque scriva da un'altra porta.
export async function getEntities() {
  if (cache && Date.now() < cacheScadeIl) return cache;
  const { data, error } = await supabase.from("entities").select("*");
  if (error) throw error;
  cache = {
    srls: data.find((e) => e.entity_type === "srls"),
    agricola: data.find((e) => e.entity_type === "azienda_agricola"),
    tasca: data.find((e) => e.entity_type === "tasca"),
  };
  cacheScadeIl = Date.now() + DURATA_CACHE_MS;
  return cache;
}
