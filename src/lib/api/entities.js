import { supabase } from "../supabase";

let cache = null;

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
  if (cache) return cache;
  const { data, error } = await supabase.from("entities").select("*");
  if (error) throw error;
  cache = {
    srls: data.find((e) => e.entity_type === "srls"),
    agricola: data.find((e) => e.entity_type === "azienda_agricola"),
    tasca: data.find((e) => e.entity_type === "tasca"),
  };
  return cache;
}
