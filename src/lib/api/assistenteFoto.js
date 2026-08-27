// L'assistente che legge le foto — il lato del gestionale.
//
// 🔴 LA FOTO NON VIENE SALVATA DA NESSUNA PARTE. Vive qui dentro, nella
//    memoria del browser, fra lo scatto e la conferma della scheda: non
//    tocca il deposito dei documenti, non tocca il database, e alla
//    conferma se ne va con la schermata. Non e' una cancellazione da
//    verificare: e' che non c'e' nessun posto in cui sia stata scritta.
//
// ⚠️ SI RIMPICCIOLISCE PRIMA DI PARTIRE, e serve a due cose insieme: una
//    foto da telefono non ridimensionata non arriva nemmeno (la rete la
//    rifiuta), e ogni punto in piu' e' un pezzo di conto da pagare senza
//    che aggiunga un dettaglio leggibile. Le regole stanno in
//    `calcoli/foto.js` perche' si possano provare senza aprire una
//    schermata.

import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";
import {
  BYTES_MASSIMI,
  bytesDelBase64,
  misureRidotte,
  QUALITA_INIZIALE,
  qualitaSuccessiva,
  tipoAmmesso,
} from "../calcoli/foto";

/**
 * Rimpicciolisce una foto e la restituisce pronta da mandare.
 * Restituisce { base64, tipo, bytes, larghezza, altezza, ridotta }.
 */
export async function preparaFoto(file) {
  if (!tipoAmmesso(file.type)) {
    throw new Error("Questo tipo di immagine non si puo' leggere. Serve una foto.");
  }

  const immagine = await new Promise((risolvi, rifiuta) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      risolvi(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rifiuta(new Error("Questa foto non si riesce ad aprire."));
    };
    img.src = url;
  });

  const misure = misureRidotte(immagine.naturalWidth, immagine.naturalHeight);
  const tela = document.createElement("canvas");
  tela.width = misure.larghezza;
  tela.height = misure.altezza;
  tela.getContext("2d").drawImage(immagine, 0, 0, misure.larghezza, misure.altezza);

  // ⚠️ Si esce sempre in jpeg, anche se e' entrata una png: una foto non
  //    guadagna niente da un formato senza perdite, e una png di
  //    un'etichetta pesa parecchie volte tanto.
  let qualita = QUALITA_INIZIALE;
  let base64 = tela.toDataURL("image/jpeg", qualita).split(",")[1];

  while (bytesDelBase64(base64) > BYTES_MASSIMI) {
    const prossima = qualitaSuccessiva(qualita);
    if (prossima === null) {
      throw new Error(
        "Questa foto resta troppo pesante anche rimpicciolita. Rifalla piu' da vicino, inquadrando solo l'etichetta."
      );
    }
    qualita = prossima;
    base64 = tela.toDataURL("image/jpeg", qualita).split(",")[1];
  }

  return {
    base64,
    tipo: "image/jpeg",
    bytes: bytesDelBase64(base64),
    larghezza: misure.larghezza,
    altezza: misure.altezza,
    ridotta: misure.ridotta,
    // Serve solo a farla rivedere ad Alessio prima che confermi.
    anteprima: `data:image/jpeg;base64,${base64}`,
  };
}

/**
 * Manda la foto all'assistente.
 *
 * ⚠️ `genere` e' il CONTESTO, non la risposta: dalla schermata di un
 *    prodotto si dice «etichetta», dalla Dashboard «qualunque». Ma
 *    l'assistente resta libero di dire che sta guardando altro, ed e' il
 *    caso che questo mandato tiene aperto apposta.
 */
export async function leggiFoto({ base64, tipo, genere = "qualunque" }) {
  const { data, error } = await supabase.functions.invoke("leggi-foto", {
    body: { immagine: base64, tipo, genere },
  });

  if (error) {
    // ⚠️ IL CORPO DELL'ERRORE PORTA IL MOTIVO VERO, e senza leggerlo si
    //    perderebbe la differenza fra «ho finito i soldi del mese» e «e'
    //    caduta la rete» — che per chi guarda sono due cose molto diverse.
    let corpo = null;
    try {
      corpo = await error.context?.json?.();
    } catch {
      corpo = null;
    }
    if (corpo?.errore) {
      const e = new Error(corpo.errore.messaggio);
      e.codice = corpo.errore.codice;
      e.spesa = corpo.spesa ?? null;
      throw e;
    }
    // Nessun corpo: quasi sempre e' la rete. Non si drammatizza — in
    // cucina la rete cade, e la scheda si compila a mano come sempre.
    const e = new Error(
      "Non sono riuscito a mandare la foto: puo' essere la rete. La scheda si compila a mano come sempre."
    );
    e.codice = "rete";
    throw e;
  }

  return data;
}

/** Quanto si e' speso questo mese, e se il tetto blocca. */
export async function spesaAiDelMese() {
  const { data, error } = await supabase.rpc("spesa_ai_del_mese");
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function impostaTettoAi(euro) {
  const { data, error } = await supabase.rpc("imposta_tetto_ai", {
    p_euro: euro === "" || euro === null || euro === undefined ? null : Number(euro),
  });
  if (error) throw error;
  return data;
}

export async function sbloccaSpesaAi() {
  const { data, error } = await supabase.rpc("sblocca_spesa_ai");
  if (error) throw error;
  return data;
}

/**
 * Le ultime letture, per vedere dove sono finiti i soldi.
 *
 * 🔴 DICEVANO SOLO «etichetta — 0,02 €» (visto da Alessio il 27/08). Fra un
 * mese una riga così non dice niente: né SU COSA è stata spesa, né QUANDO.
 * ⚠️ Il nome del prodotto era già in tabella (`ingredient_id`) e nessuno lo
 * leggeva; la data c'era e non si mostrava. Non è stato aggiunto un dato:
 * sono stati letti due dati che c'erano già.
 * ⚠️ E resta vuoto quando la foto parte dalla Dashboard, dove un prodotto
 * non c'è: lì il nome non si inventa, resta il genere.
 */
export async function listLettureFoto(quante = 30) {
  const { data, error } = await supabase
    .from("letture_foto")
    .select("id, genere, riconosciuto, sicuro, esito, costo_euro, messaggio, creato_il, ingrediente:ingredients(name)")
    .order("creato_il", { ascending: false })
    .limit(quante);
  if (error) throw error;
  return data ?? [];
}

/**
 * Scrive nella scheda quello che l'assistente ha letto sull'etichetta.
 *
 * 🔴 PASSA DAL CORRIDOIO, e non e' una formalita': tocca due tabelle —
 *    gli allergeni sul prodotto e l'origine di ciascuno — e a meta'
 *    resterebbe un prodotto con gli allergeni cambiati e nessuna origine,
 *    cioe' un elenco che in sala si legge come una garanzia. E' la regola
 *    B4 del Contratto Architetturale, e qui era stata mancata: l'ha
 *    trovata la prova, non una rilettura.
 */
export async function applicaLetturaEtichetta(ingredientId, campi) {
  return eseguiOperazione("applica_lettura_etichetta", {
    p_ingredient_id: ingredientId,
    p_campi: campi,
  });
}

/**
 * Segna quali campi ha proposto l'assistente e Alessio ha lasciato
 * com'erano. Il confronto lo fa il modulo: il database non ha modo di
 * sapere se un valore e' quello proposto o quello riscritto sopra.
 */
export async function marcaCampiDallAssistente(ingredientId, campi) {
  const { data, error } = await supabase.rpc("marca_campi_dall_assistente", {
    p_ingredient_id: ingredientId,
    p_campi: campi,
  });
  if (error) throw error;
  return data;
}

/** Da dove viene ciascun allergene di un prodotto — serve in sala. */
export async function allergeniConOrigine(ingredientId) {
  const { data, error } = await supabase.rpc("allergeni_con_origine", {
    p_ingredient_id: ingredientId,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * Chi ha messo il tetto di spesa, e chi lo ha sbloccato — gia' in parole.
 *
 * ⚠️ La frase la compone il DATABASE e non la schermata: e' la stessa
 *    regola per cui `spesa_ai_del_mese()` restituisce il numero insieme
 *    alla frase che ne dichiara il limite. Una seconda schermata che
 *    mostrasse lo stesso dato erediterebbe la frase invece di riscriverla.
 */
export async function chiHaMessoIlTetto() {
  const { data, error } = await supabase.rpc("chi_ha_messo_il_tetto");
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
