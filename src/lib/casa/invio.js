// L'INVIO DELLA CODA DI CASA — dal telefono a Supabase di Casa.
//
// Per ogni voce, nell'ordine (lo stesso di annotaSpesaDaFoto):
//  1. il file in `documents/da-collocare/<chiave>.jpg`, con upsert: un invio
//     interrotto si rifa' sovrascrivendo lo stesso file, mai un secondo;
//  2. la spesa «da collocare» con la sola foto, dalla porta
//     annota_spesa_da_collocare con la stessa chiave: se c'era gia', il
//     database restituisce quella (20261011000004).
// Solo dopo la risposta del database la voce e' arrivata.
//
// Quando si prova a svuotare la coda: all'avvio, quando torna la rete,
// quando l'app torna in primo piano, dopo ogni foto nuova e ogni minuto
// mentre e' aperta. iOS non permette invii a app chiusa: per questo conta
// aprire Casa ogni tanto (o farla aprire dai Comandi, «quando arrivo a casa»).

import { supabase } from "../supabase";
import { ambienteCorrente } from "../ambiente";
import {
  STATI,
  arrivateDaTogliere,
  daInviare,
  dopoCasaIrraggiungibile,
  dopoLArrivo,
  dopoUnErrore,
  eDellaRete,
  percorsoFoto,
  voceNuova,
} from "../calcoli/codaCasa";
import { chiediDiTenereIDati, fotoDi, salvaVoce, togliVoci, tutteLeVoci } from "./coda";

const BUCKET = "documents";
// Una foto di 1-4 MB su una rete mobile lenta: un minuto e mezzo e' tanto,
// ma una richiesta appesa per sempre bloccherebbe tutta la coda.
const TEMPO_MASSIMO_MS = 90_000;

/** Una foto (gia' rimpicciolita da preparaFoto) entra nella coda. */
export async function mettiInCoda(pronta) {
  const byte = Uint8Array.from(atob(pronta.base64), (c) => c.charCodeAt(0));
  const voce = voceNuova({
    chiave: crypto.randomUUID(),
    foto: { byte: byte.buffer, tipo: pronta.tipo || "image/jpeg" },
  });
  await salvaVoce(voce);
  chiediDiTenereIDati();
  svuotaLaCoda();
  return voce;
}

function entro(promessa, ms) {
  let timer;
  const scadenza = new Promise((_, rifiuta) => {
    timer = setTimeout(() => rifiuta(Object.assign(new Error("tempo scaduto"), { rete: true })), ms);
  });
  return Promise.race([promessa, scadenza]).finally(() => clearTimeout(timer));
}

/** Un errore di Supabase, con l'indicazione se e' la rete a mancare. */
function errore(prefisso, e) {
  const err = new Error(`${prefisso}: ${e?.message || e}`);
  // Supabase avvolge il fetch fallito: la risposta che manca e' la rete.
  err.rete = eDellaRete(e) || eDellaRete(e?.originalError) || e?.name === "StorageUnknownError";
  return err;
}

async function inviaUna(voce) {
  const foto = await fotoDi(voce.chiave);
  if (!foto) throw new Error("la foto non c'e' piu' nel telefono");
  const percorso = percorsoFoto(voce.chiave);
  const corpo = new Blob([foto.byte], { type: foto.tipo });
  const caricato = await supabase.storage.from(BUCKET).upload(percorso, corpo, { upsert: true, contentType: foto.tipo });
  if (caricato.error) throw errore("la foto non e' arrivata", caricato.error);
  const { data, error } = await supabase.rpc("annota_spesa_da_collocare", {
    p_campi: { chiave: voce.chiave, foto_path: percorso, foto_nome: "ricevuta.jpg" },
  });
  if (error) throw errore("la spesa non e' stata scritta", error);
  return data;
}

let inCorso = null;
let ancora = false;
let forzaInAttesa = false;

/**
 * Prova a mandare tutto quello che aspetta. Uno alla volta, e mai due giri
 * insieme: se arriva una richiesta mentre un giro e' in corso (una foto
 * nuova, «Invia adesso»), a fine giro se ne fa un altro. Non lancia errori:
 * ogni voce si porta il suo.
 */
export function svuotaLaCoda({ forza = false } = {}) {
  if (ambienteCorrente().genere !== "casa") return Promise.resolve();
  if (inCorso) {
    ancora = true;
    forzaInAttesa ||= forza;
    return inCorso;
  }
  inCorso = (async () => {
    let forzaQuesto = forza;
    do {
      ancora = false;
      await unGiro(forzaQuesto);
      forzaQuesto = forzaInAttesa;
      forzaInAttesa = false;
    } while (ancora);
  })().finally(() => {
    inCorso = null;
  });
  return inCorso;
}

async function unGiro(forza) {
  let voci;
  try {
    voci = await tutteLeVoci();
    await togliVoci(arrivateDaTogliere(voci));
  } catch {
    return; // La coda non si legge (memoria del telefono): la pagina lo dira'.
  }
  const daMandare = daInviare(voci, { forza });
  if (!daMandare.length) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const { data } = await supabase.auth.getSession().catch(() => ({ data: null }));
  if (!data?.session) {
    // ⚠️ Senza accesso non parte niente, e va DETTO: altrimenti le foto
    // resterebbero «in coda» per sempre senza una ragione.
    for (const v of daMandare) {
      await salvaVoce(dopoCasaIrraggiungibile(v, "Serve rientrare in Casa col PIN: poi parte da sola."));
    }
    return;
  }

  for (const voce of daMandare) {
    // Si rilegge lo stato: nel frattempo un altro giro potrebbe averla mandata.
    const attuale = (await tutteLeVoci()).find((v) => v.chiave === voce.chiave);
    if (!attuale || attuale.stato !== STATI.IN_CODA) continue;
    try {
      const spesaId = await entro(inviaUna(attuale), TEMPO_MASSIMO_MS);
      await salvaVoce(dopoLArrivo(attuale, spesaId));
    } catch (e) {
      if (e?.rete) {
        // Casa non si raggiunge: si dice, senza allungare l'attesa, e non
        // ha senso provare le altre adesso.
        await salvaVoce(dopoCasaIrraggiungibile(attuale));
        break;
      }
      await salvaVoce(dopoUnErrore(attuale, e?.message));
    }
  }
}

let acceso = false;
/** Accende i momenti in cui la coda prova a svuotarsi da sola. Solo su Casa. */
export function accendiLInvioAutomatico() {
  if (acceso || ambienteCorrente().genere !== "casa") return;
  acceso = true;
  const prova = () => svuotaLaCoda();
  window.addEventListener("online", prova);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") prova();
  });
  setInterval(() => {
    if (document.visibilityState === "visible") prova();
  }, 60_000);
  prova();
}
