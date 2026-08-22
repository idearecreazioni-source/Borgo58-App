import { supabase } from "./supabase";
import { fraseDelGuasto } from "./calcoli/erroriDiRete";

// =====================================================================
// CHIAMARE UNA FUNZIONE ONLINE, E SAPERE COSA DIRE SE NON RISPONDE
// =====================================================================
// 🔴 NATO DA UN REPERTO DI ALESSIO (22/08): sul gestionale di prova
// «Compila con l'assistente» diceva *«sembra che manchi la connessione»*, e
// la connessione c'era. La funzione `schede-prodotto` semplicemente **non è
// installata** su quel progetto — misurato: là ce ne sono **2 su 9**.
//
// ⚠️ E DAL BROWSER I DUE CASI SONO LO STESSO ERRORE. Misurato nella pagina
// viva, non dedotto: una funzione che non esiste fa rispondere il gateway
// **404 senza intestazioni CORS**, il browser blocca, e `fetch` fallisce con
// `TypeError: Failed to fetch` — lo stesso identico errore del telefono in
// modalità aereo. Il browser non dice perché, ed è voluto: se lo dicesse,
// una pagina qualunque potrebbe scandagliare la rete di chi la guarda.
//
// 🔴 QUINDI LA DIFFERENZA NON SI LEGGE: SI MISURA. Se il gestionale in
// questo istante sta parlando col database, la rete c'è — e allora il
// guasto è di quel servizio, non della connessione.
//
// ⚠️ Questo file esiste anche per un secondo motivo: lo stesso identico
// blocco `try/catch` era ricopiato in **quattro** punti. Quattro copie di
// una regola sono quattro posti dove la prossima correzione può fermarsi a
// tre.
// =====================================================================

/**
 * La rete c'è davvero?
 *
 * ⚠️ **Qualunque risposta del database vale come sì, anche un rifiuto.** Se
 * il database dice «non hai il permesso», la rete c'è per definizione:
 * quella frase ha attraversato Internet per arrivare fin qui. L'unica cosa
 * che dimostra il contrario è un `fetch` che non parte.
 *
 * ⚠️ Per questo non si guarda `error` ma **il tipo** di errore: leggere
 * `error != null` come «rete morta» direbbe che la connessione è caduta ogni
 * volta che un permesso manca.
 *
 * Restituisce `true`, `false`, oppure `null` se la sonda stessa non si è
 * potuta fare — e `null` resta «non lo so», mai un `false` di comodo.
 */
export async function reteViva() {
  try {
    // La lettura più leggera possibile: si chiede il conto delle righe senza
    // portarsene indietro nessuna.
    const { error } = await supabase
      .from("service_settings")
      .select("id", { count: "exact", head: true });

    if (!error) return true;

    const nome = String(error.name || "");
    const m = String(error.message || "").toLowerCase();
    const nonPartita =
      nome === "TypeError" ||
      m.includes("failed to fetch") ||
      m.includes("networkerror") ||
      m.includes("network error") ||
      m.includes("load failed");

    // Il database ha risposto qualcosa: la rete c'è.
    return !nonPartita;
  } catch {
    // ⚠️ SILENZIO MOTIVATO: questa è una sonda diagnostica, e sta girando
    // mentre un guasto è già in corso. Se fallisce anche lei non si sa se la
    // rete c'è — e «non lo so» è la risposta onesta, che fa restare sulla
    // frase prudente invece di inventarne una precisa.
    return null;
  }
}

/**
 * Chiama una funzione online e, se non risponde, dice **in italiano e con la
 * causa giusta** cosa è rimasto indietro.
 *
 * @param nome  la funzione, es. "schede-prodotto"
 * @param corpo il corpo della richiesta
 * @param cosa  che cosa si stava facendo, in italiano: «compilare le schede
 *              dei prodotti». ⚠️ Serve: chi legge deve sapere che cosa non è
 *              riuscito, non solo che qualcosa è andato storto.
 */
export async function chiamaFunzione(nome, corpo, cosa) {
  const { data, error } = await supabase.functions.invoke(nome, { body: corpo });
  if (!error) return data;

  let dalCorpo = null;
  try {
    const risposta = await error.context?.json();
    if (risposta?.errore?.messaggio) dalCorpo = risposta.errore.messaggio;
  } catch {
    // ⚠️ SILENZIO MOTIVATO: una risposta senza corpo JSON è un caso
    // previsto — è esattamente ciò che succede quando la richiesta non è
    // partita. Chi decide la frase è `fraseDelGuasto`, che sotto ha già
    // tutto quello che serve.
  }

  // ⚠️ La sonda si fa SOLO qui, cioè solo quando un guasto c'è già: non
  // aggiunge un giro di rete al caso normale, che è quello che conta.
  const viva = dalCorpo ? null : await reteViva();

  throw new Error(fraseDelGuasto(error, cosa, dalCorpo, { reteViva: viva }));
}
