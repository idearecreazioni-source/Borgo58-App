// =====================================================================
// I DUE SUONI DI MEMO — 10/09/2026, Blocco 5 del mandato notturno
// =====================================================================
// 🔴 IL PROBLEMA È CHE IL MICROFONO NON SI VEDE. Chi detta guarda il
// telefono e non sa se sta registrando: la scritta a schermo la si legge
// solo se si sta guardando lo schermo, e chi detta ha quasi sempre le mani
// occupate e gli occhi altrove. Un suono lo si sente senza guardare.
//
// 🔴 E IL SUONO ARRIVA SOLO QUANDO IL MICROFONO È DAVVERO APERTO, non
// quando si preme il pulsante. È la parte che conta: un suono al tocco
// direbbe «sto registrando» anche quando il permesso è negato, il
// microfono è occupato da un'altra app, o la pagina non è su un indirizzo
// cifrato — e in tutti quei casi si parlerebbe a vuoto convinti del
// contrario. Il segnale è `onaudiostart`, cioè il momento in cui l'audio
// entra davvero.
//
// ⚠️ DUE SUONI DIVERSI, e non due volte lo stesso: aperto e chiuso sono
// due fatti opposti, e uno stesso «bip» due volte non dice quale dei due
// è appena successo. Il primo sale, il secondo scende.
//
// 🔴 NESSUN FILE ESTERNO, e non per risparmiare: un file audio è un
// allegato che qualcuno dovrà conservare, servire e ricordarsi di
// aggiornare, e sul telefono è anche una richiesta di rete in più prima
// che il suono si senta. Qui il suono lo costruisce il browser — due
// centesimi di secondo di onda — e non c'è niente da scaricare e niente
// da pagare.
//
// ⚠️ E SI PUÒ SPEGNERE, con la scelta che resta. Un suono che non si può
// togliere diventa un fastidio il giorno che si detta accanto a un
// cliente; e una preferenza che si dimentica a ogni ricarica è come non
// averla.

const CHIAVE = "borgo58.memo.suoni";

/**
 * I suoni sono accesi? La risposta vive nel browser di chi detta.
 *
 * ⚠️ IL PREDEFINITO È ACCESO, ed è una scelta: il suono esiste per dire
 * una cosa che senza di lui non si sa (il microfono è aperto davvero), e
 * una funzione che nasce spenta non la scopre nessuno.
 *
 * ⚠️ E OGNI LETTURA È PROTETTA: in una finestra anonima, o con i dati dei
 * siti bloccati, `localStorage` non solleva un valore vuoto — solleva un
 * errore. Una schermata che non si apre per una preferenza è peggio di una
 * preferenza dimenticata.
 */
export function suoniAccesi() {
  try {
    return globalThis.localStorage.getItem(CHIAVE) !== "no";
  } catch {
    return true;
  }
}

export function accendiSuoni(si) {
  try {
    globalThis.localStorage.setItem(CHIAVE, si ? "si" : "no");
  } catch {
    // Non si può ricordare: il suono funziona lo stesso per questa volta.
  }
}

// ⚠️ UN SOLO contesto audio per tutta la pagina: aprirne uno per ogni suono
//    esaurisce una risorsa che il browser conta, e dopo qualche decina di
//    dettature il suono smette di uscire — senza nessun errore.
let contesto = null;

/**
 * Prepara l'audio DENTRO il tocco che accende il microfono.
 *
 * 🔴 VA CHIAMATA LÌ E NON ALTROVE: i browser aprono l'audio solo dentro un
 * gesto di chi guarda. Creando il contesto al primo suono — che arriva da
 * `onaudiostart`, cioè da un evento del sistema e non da un dito — il
 * suono resterebbe muto sul telefono, e a schermo non si vedrebbe niente.
 */
export function preparaSuoni() {
  if (!suoniAccesi()) return;
  try {
    const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Audio) return;
    if (!contesto) contesto = new Audio();
    if (contesto.state === "suspended") contesto.resume();
  } catch {
    contesto = null;
  }
}

/**
 * Un suono breve: due note, e basta.
 *
 * ⚠️ Le frequenze non sono decorative: 660→880 sale, 880→660 scende, e la
 * direzione è la sola cosa che distingue «aperto» da «chiuso» per chi non
 * sta guardando. Durata 0,12 s: più corto non si sente in cucina, più
 * lungo si sovrappone alla prima parola.
 */
function suona(da, a) {
  if (!suoniAccesi() || !contesto) return;
  try {
    const ora = contesto.currentTime;
    const onda = contesto.createOscillator();
    const volume = contesto.createGain();
    onda.type = "sine";
    onda.frequency.setValueAtTime(da, ora);
    onda.frequency.exponentialRampToValueAtTime(a, ora + 0.1);
    // ⚠️ Il volume sale e scende invece di partire e fermarsi di colpo: un
    //    taglio netto su un'onda produce uno schiocco, che si sente come un
    //    difetto dell'altoparlante.
    volume.gain.setValueAtTime(0.0001, ora);
    volume.gain.exponentialRampToValueAtTime(0.08, ora + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, ora + 0.12);
    onda.connect(volume).connect(contesto.destination);
    onda.start(ora);
    onda.stop(ora + 0.14);
  } catch {
    // Un suono che non esce non deve fermare una dettatura.
  }
}

/** Il microfono è aperto davvero: si può parlare. */
export const suonoMicrofonoAperto = () => suona(660, 880);

/** La registrazione è finita: si può smettere di parlare. */
export const suonoMicrofonoChiuso = () => suona(880, 660);
