import { useRef, useState } from "react";
import { leggiFoto, preparaFoto } from "../lib/api/assistenteFoto";
import BarraDelPollice from "./BarraDelPollice";

// Scatta o scegli una foto, mandala all'assistente, mostra cosa ha visto.
//
// ⚠️ E' IL MOTORE, non la destinazione. Questo componente non sa niente di
//    etichette, di prodotti o di magazzino: prende una foto, la fa
//    leggere, e passa a chi lo usa quello che e' tornato. Le altre due
//    destinazioni che arriveranno — le bolle, le fatture — useranno
//    questo, non una copia.
//
// 🔴 LA FOTO RESTA QUI DENTRO. Vive nello stato di questo componente,
//    quindi fra lo scatto e la conferma; quando chi lo usa chiude, se ne
//    va con lui. Non viene salvata da nessuna parte, e per questo non c'e'
//    niente da cancellare.
//
// ⚠️ `capture="environment"` apre la fotocamera POSTERIORE sul telefono, e
//    lascia comunque la galleria: chi ha gia' la foto non deve rifarla.

// ⚠️ `gestoInBasso` è SPENTO di partenza, ed è la cosa importante: questo
//    componente vive in due posti diversi. Su «Fotografa» la foto **è** la
//    schermata, e il pulsante va dove arriva il pollice; sulla scheda di un
//    prodotto la foto è **uno dei tanti campi**, e un pulsante inchiodato in
//    fondo allo schermo direbbe che quello conta più del prezzo e degli
//    allergeni. Chi usa il componente sa in quale dei due casi si trova.
export default function ScattaFoto({
  genere = "qualunque",
  // 🔴 L'EMOJI STA NEL VALORE PREDEFINITO, non appiccicata a schermo —
  //    30/08, richiesta di Alessio: *«l'emoji della macchina fotografica
  //    accanto a "Fotografa", come il microfono sta accanto a "Premi e
  //    parla"»*.
  //    ⚠️ Chi passa un'etichetta sua (la scheda di un prodotto dice
  //       «Fotografa l'etichetta») decide anche il simbolo: appiccicarlo
  //       qui dentro lo metterebbe davanti a parole che non lo chiedono.
  etichettaPulsante = "📷 Fotografa",
  onLetto,
  disabilitato = false,
  gestoInBasso = false,
}) {
  const campo = useRef(null);
  const [foto, setFoto] = useState(null);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState(null);
  const [avviso, setAvviso] = useState(null);

  const scegli = async (e) => {
    const file = e.target.files?.[0];
    // Il campo si svuota subito: senza, riscegliere la stessa foto non
    // farebbe scattare niente.
    e.target.value = "";
    if (!file) return;

    setErrore(null);
    setAvviso(null);
    setInCorso(true);

    // 🔴 LA LETTURA PRECEDENTE DECADE SUBITO, appena si sceglie una foto
    //    nuova. Trovato guardando la schermata, non rileggendo: rompendo
    //    la rete a metà di una seconda foto, a schermo restavano insieme
    //    l'anteprima della foto NUOVA e il riquadro verde della lettura
    //    VECCHIA — che chi guarda legge come se parlasse della foto che
    //    vede. E quel riquadro dice da dove vengono gli allergeni: la cosa
    //    peggiore su cui lasciare un equivoco.
    //    ⚠️ I campi già compilati restano, ed è voluto: Alessio li ha
    //    visti e può averli corretti. Quello che decade è la PROMESSA che
    //    vengano da un'etichetta letta — perché quell'etichetta non è più
    //    quella a schermo. Nel dubbio non si promette.
    onLetto?.(null, null);

    try {
      const pronta = await preparaFoto(file);
      setFoto(pronta);
      const esito = await leggiFoto({ base64: pronta.base64, tipo: pronta.tipo, genere });

      if (esito?.esito !== "letta") {
        // ⚠️ Non e' un errore: e' una risposta. L'assistente ha guardato e
        //    ha detto che non sa dove metterla — e lo dice invece di
        //    incastrarla dove non va.
        setAvviso(esito?.messaggio ?? "Non ho riconosciuto questa foto.");
      }
      onLetto?.(esito, pronta);
    } catch (err) {
      setErrore(err.message);
      // ⚠️ La foto NON si butta quando la lettura fallisce: se e' caduta la
      //    rete, si riprova senza doverla rifare.
    } finally {
      setInCorso(false);
    }
  };

  const butta = () => {
    setFoto(null);
    setErrore(null);
    setAvviso(null);
    onLetto?.(null, null);
  };

  return (
    <div className="rounded-lg border border-stone-300 bg-stone-50 p-3">
      <input
        ref={campo}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={scegli}
        className="hidden"
      />

      <Forse dentro={gestoInBasso}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => campo.current?.click()}
          disabled={disabilitato || inCorso}
          // ⚠️ `tocco-azione` (1,2 cm) e non `tocco-bottone` (0,85): la
          //    soglia è il minimo accettabile, non l'obiettivo, e questo è
          //    il gesto principale della schermata — si preme col telefono
          //    in una mano e il barattolo nell'altra. Misurato a 390 punti:
          //    col minimo veniva 8,50 mm esatti, cioè al limite.
          // 🔴 LARGO QUANTO LO SCHERMO — decisione di Alessio del 29/08.
          //    Misurato prima, a 375 punti: era **85 punti su 375**, cioè il
          //    23% dello schermo, in basso a SINISTRA, con 274 punti vuoti
          //    alla sua destra. È il punto più scomodo da raggiungere con una
          //    mano sola — che è esattamente come si tiene il telefono mentre
          //    l'altra mano regge la confezione da fotografare.
          //    ⚠️ `flex-1` e non `w-full`: quando la foto c'è già, accanto
          //       compare «Togli», e con `w-full` finirebbe a capo su una
          //       riga sua facendo crescere la barra. Da solo, `flex-1`
          //       prende tutto lo spazio: è la stessa cosa.
          //    ⚠️ E SOLO SUL TELEFONO: sul computer la regola del pollice non
          //       vale, e senza `md:flex-none` il pulsante diventava largo
          //       710 punti su 1280 — misurato, non temuto.
          // 🔴 LO STESSO IDENTICO PULSANTE DI «PREMI E PARLA» — 30/08/2026,
          //    decisione di Alessio dopo aver guardato le due schermate
          //    affiancate: *«devono avere entrambi lo stile di quello di
          //    MEMO voce — quello scuro, pieno, largo»*.
          //    ⚠️ Cambiano solo la PAROLA e il SIMBOLO. Due gesti che si
          //       fanno nello stesso posto, con la stessa mano, nella stessa
          //       condizione (in piedi, con qualcosa nell'altra mano) non
          //       hanno nessuna ragione di vedersi diversi — e vedersi
          //       diversi fa cercare la differenza dove non c'e'.
          //    ⚠️ 1,5 cm veri (non 1,2) e testo da 6 mm: le due misure sono
          //       decise da lui e vivono in «index.css», non qui.
          className="tocco-azione-grande testo-sala-lontano flex flex-1 items-center justify-center rounded-xl bg-b58-charcoal px-4 py-2 font-medium text-white transition-colors hover:bg-b58-charcoal-soft disabled:opacity-50 md:flex-none md:justify-start"
        >
          {inCorso ? "Sto guardando…" : foto ? "📷 Rifai la foto" : etichettaPulsante}
        </button>

        {foto && !inCorso && (
          <button
            type="button"
            onClick={butta}
            className="tocco-bottone testo-sala rounded-md border border-stone-300 px-3 py-2 text-stone-700"
          >
            Togli
          </button>
        )}
      </div>
      </Forse>

      {/* ⚠️ L'anteprima resta finche' non si conferma: se un campo non
          torna, l'etichetta si riguarda invece di rifare la foto. */}
      {foto && (
        <div className="mt-3">
          <img
            src={foto.anteprima}
            alt="La foto appena scattata"
            className="max-h-64 w-auto rounded-md border border-stone-300"
          />
          <p className="testo-sala mt-1 text-stone-500">
            {foto.larghezza}×{foto.altezza} punti · {Math.round(foto.bytes / 1024)} kB
            {foto.ridotta ? " · rimpicciolita prima di partire" : ""}
          </p>
        </div>
      )}

      {avviso && (
        <p className="testo-sala mt-3 rounded-md bg-amber-50 p-2 text-amber-900">{avviso}</p>
      )}

      {/* ⚠️ Senza rete non si drammatizza: si dice che si fa a mano. In
          cucina la rete cade, e il lavoro non si ferma per questo. */}
      {errore && (
        <p className="testo-sala mt-3 rounded-md bg-stone-100 p-2 text-stone-700">{errore}</p>
      )}
    </div>
  );
}

// Avvolge nella barra del pollice solo quando serve.
//
// ⚠️ Esiste per non scrivere due volte la stessa fila di pulsanti — una
//    dentro la barra e una fuori. Due copie della stessa cosa divergono, e
//    quella che resta indietro è sempre quella che si guarda di meno.
function Forse({ dentro, children }) {
  return dentro ? <BarraDelPollice>{children}</BarraDelPollice> : children;
}
