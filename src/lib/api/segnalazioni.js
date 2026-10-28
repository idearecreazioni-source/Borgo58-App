// Il quaderno dei difetti (25/10/2026, tappa 1 del piano «MEMO che controlla»).
//
// 🔴 SI SCRIVE DRITTO DAL BROWSER: una segnalazione è una tabella sola e
//    non produce effetti altrove, quindi niente corridoio. La barriera è la
//    RLS: solo il titolare la vede e la scrive.
//
// ⚠️ Dopo la nascita si cambiano solo stato ed esito — il database non
//    concede altro. Testo e contesto sono la testimonianza del momento.
//
// ⚠️ L'IMMAGINE DELLA PAGINA (28/10/2026, 20261028000004): prima il file,
//    poi la riga — come le ricevute di MEMO (`speseDaCollocare.js`). Il
//    nome dipende dalla `chiave`, fatta una volta per riquadro: riprovando
//    dopo un errore non si carica una seconda copia. E togliendo, prima la
//    riga e poi il file: un file rimasto lo trova `npm run deposito:orfani`.

import { supabase } from "../supabase";
import { giaCaricata } from "../calcoli/daCollocare";

const BUCKET = "documents";
const CARTELLA = "segnalazioni";

/**
 * Scrive la segnalazione, con l'immagine se c'è.
 * Restituisce `{ id, immagineMancata }`: `immagineMancata` è la frase da
 * mostrare se l'immagine non è entrata. ⚠️ La segnalazione parte lo stesso:
 * il testo di chi segnala vale più dell'immagine, e perderlo per un file
 * sarebbe il guaio peggiore.
 */
export async function creaSegnalazione(riga, immagine = null, chiave = crypto.randomUUID()) {
  let immaginePath = null;
  let immagineMancata = null;
  if (immagine) {
    const path = `${CARTELLA}/${chiave}.jpg`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, immagine, { upsert: false, contentType: "image/jpeg" });
    // «Esiste già» vuol dire che il giro di prima l'aveva caricata.
    if (error && !giaCaricata(error)) {
      immagineMancata = `La segnalazione è salvata, ma senza l'immagine della pagina (${error.message}).`;
    } else {
      immaginePath = path;
    }
  }
  const { data, error } = await supabase
    .from("segnalazioni")
    .insert({ ...riga, immagine_path: immaginePath })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, immagineMancata };
}

export async function listSegnalazioni() {
  const { data, error } = await supabase
    .from("segnalazioni")
    .select("id, testo, provenienza, schermata, titolo_schermata, cosa_si_vedeva, immagine_path, stato, esito, creata_il, aggiornata_il")
    .order("creata_il", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ⚠️ Cinque minuti, non un'ora (dalla revisione di sicurezza): l'indirizzo
//    si chiede al tocco, e un link che vive poco non resta utile se finisce
//    nella cronologia o viene inoltrato.
export async function urlImmagineSegnalazione(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function cambiaStatoSegnalazione(id, stato, esito = undefined) {
  const campi = { stato };
  if (esito !== undefined) campi.esito = esito?.trim() ? esito.trim() : null;
  const { error } = await supabase.from("segnalazioni").update(campi).eq("id", id);
  if (error) throw error;
}

/**
 * Toglie la segnalazione e poi la sua immagine. Restituisce
 * `{ immagineRimasta }` se il file non si è tolto: la riga è già andata, e
 * il file lo trova il controllo degli orfani.
 */
export async function eliminaSegnalazione(id) {
  const { data, error } = await supabase
    .from("segnalazioni")
    .delete()
    .eq("id", id)
    .select("immagine_path");
  if (error) throw error;
  const path = data?.[0]?.immagine_path;
  if (path) {
    // ⚠️ Un file che le regole non lasciano togliere torna come elenco
    //    vuoto, senza errore: anche quello vuol dire «rimasto».
    const { data: tolti, error: errFile } = await supabase.storage.from(BUCKET).remove([path]);
    if (errFile || !tolti?.length) {
      return {
        immagineRimasta:
          "La segnalazione è tolta, ma la sua immagine è rimasta nel deposito: non dà fastidio, e la trova il controllo dei file orfani.",
      };
    }
  }
  return {};
}
