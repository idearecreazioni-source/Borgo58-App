import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  listChiamateTurno,
  listRepartoTickets,
  segnaChiamataStampata,
  setItemsPrepared,
} from "../../lib/api/orders";
import { bigliettiCucina, etichettaTurno } from "../../lib/calcoli/turni";
import { toccaSubito, toccaTutteSubito } from "../../lib/calcoli/tocco";
import { allergeniTolti, frasiSostituzioni, nomeRiga } from "../../lib/calcoli/righeComanda";
import { ALLERGENS, labelFor } from "../../lib/constants";

// CUCINA — postazione di stampa, non schermata di lavoro (§3.2.1).
//
// La cucina lavora SOLO di carta, per scelta deliberata: niente tablet,
// niente "segna pronto" digitale. Questa pagina è il ponte deciso da
// Alessio l'08/08: finché non ci sono mini-PC e stampante termica, ogni
// invio dalla Sala arriva qui come ticket già impaginato a 72 mm (la
// larghezza utile di una termica da 80 mm) e si stampa dal browser con un
// tocco. Quando arriverà l'hardware, questa pagina verrà sostituita dalla
// coda di stampa sul mini-PC (ARCHITETTURA §4.2) senza cambiare il ticket.
//
// Stato "stampato": si riusa prepared_at delle righe — qui NON significa
// "piatto pronto" (quello resta sulla carta, in cucina) ma "il ticket è
// uscito dalla stampante". È condiviso fra i dispositivi e sopravvive al
// ricarico; con la coda vera diventerà lo stato della coda.
//
// 🔴 DAL 21/08 I FOGLI SI RAGGRUPPANO PER TURNO, NON PER INVIO. Prima la
// chiave era `order_id + sent_at`: una comanda segnata tutta e mandata una
// volta usciva come **un foglio solo**, coi tre turni mescolati dentro.
// Adesso la regola vive in `src/lib/calcoli/turni.js` — pura, provabile
// senza browser e senza chiavi — e questa pagina la chiama invece di
// riscriverla.
//
// ⚠️ E I BIGLIETTI «AVANTI COL PROSSIMO TURNO» PASSANO DALLA STESSA CODA:
// sono un foglio come gli altri, con la stessa vita (da stampare → stampato
// → ristampabile). Il giorno del mini-PC la coda li prende senza doverli
// distinguere, perché non c'è niente da distinguere.
const POLL_MS = 10000;

export default function Cucina() {
  const [righe, setRighe] = useState([]);
  const [chiamate, setChiamate] = useState([]);
  const [error, setError] = useState("");
  const [letto, setLetto] = useState(false);
  const [stampaKey, setStampaKey] = useState(null);

  // ⚠️ Quanti salvataggi sono in volo. Finché è più di zero il ricarico
  // periodico NON applica ciò che legge: il database non ha ancora
  // ricevuto il tocco, quindi risponderebbe con lo stato di prima e il
  // foglio lampeggerebbe — e in cucina un lampeggio si legge «non ha
  // preso». Non è un lucchetto sull'interfaccia, è sul RICARICO.
  const inVolo = useRef(0);
  const conSalvataggioInVolo = async (azione) => {
    inVolo.current += 1;
    try {
      return await azione();
    } finally {
      inVolo.current -= 1;
    }
  };

  // ⚠️ Le due letture si chiedono INSIEME e o si applicano tutte e due o
  // nessuna: se le chiamate fallissero e le righe no, la cucina vedrebbe una
  // coda plausibile **senza i biglietti dei turni** — cioè un elenco che
  // sembra completo e non lo è (§8).
  const load = () =>
    Promise.all([listRepartoTickets("cucina"), listChiamateTurno()])
      .then(([r, c]) => {
        if (inVolo.current > 0) return; // c'è un tocco in volo: non lo si copre
        setRighe(r);
        setChiamate(c);
        setLetto(true);
        setError("");
      })
      // Un errore non va ingoiato: una pagina vuota per un problema di
      // rete è indistinguibile da una serata tranquilla.
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const fogli = bigliettiCucina(righe, chiamate);
  const daStampare = fogli.filter((g) => !g.stampato);
  const stampati = fogli.filter((g) => g.stampato);

  // Un foglio si marca allo stesso modo qualunque cosa contenga: è la
  // proprietà che permetterà alla coda del mini-PC di trattarli uguali.
  const segna = (g, stampato) =>
    g.tipo === "chiamata"
      ? segnaChiamataStampata(g.id, stampato)
      : setItemsPrepared(
          g.items.map((i) => i.id),
          stampato
        );

  // Stampa di un singolo foglio: la classe .stampa-ticket isola SOLO quel
  // foglio sulla carta (blocco @media print in index.css). Il timeout dà a
  // React il tempo di applicare la classe prima del dialogo di stampa, e
  // tiene la chiamata fuori dal ciclo di render (in sviluppo gli effetti
  // girano due volte: qui la stampa deve partire UNA volta).
  const stampa = (g, giaStampato) => {
    setStampaKey(g.chiave);
    setTimeout(async () => {
      window.print();
      setStampaKey(null);
      // ⚠️ Anche qui il foglio passa fra gli stampati SUBITO. Il dialogo
      // di stampa nasconde il ritardo solo finché resta aperto: appena si
      // chiude, chi guarda vede ancora il foglio nella colonna di
      // sinistra e non sa se la stampa è stata registrata.
      if (!giaStampato) await segnaSubito(g, true);
    }, 100);
  };

  // 🔴 IL FOGLIO CAMBIA SUBITO (25/08/2026). Misurato prima di
  // correggere: **322 ms in media** (242-460) fra il tocco e il cambio —
  // l'aggiornamento più la rilettura di tutta la coda — e nel frattempo
  // ogni pulsante era spento.
  //
  // ⚠️ QUI I FOGLI SONO DI DUE SPECIE e stanno in due elenchi diversi: le
  // comande (righe d'ordine, `prepared_at`) e le chiamate di turno
  // (`stampata_il`). L'ottimismo va applicato all'elenco giusto — su
  // quello sbagliato non cambierebbe niente e il tocco resterebbe muto
  // come prima.
  const segnaSubito = (g, stampato) =>
    conSalvataggioInVolo(() =>
      g.tipo === "chiamata"
        ? toccaSubito({
            righe: chiamate,
            id: g.id,
            cambio: { stampata_il: stampato ? new Date().toISOString() : null },
            mostra: setChiamate,
            avvisa: setError,
            salva: () => segna(g, stampato),
          })
        : toccaTutteSubito({
            righe,
            ids: g.items.map((i) => i.id),
            cambio: { prepared_at: stampato ? new Date().toISOString() : null },
            mostra: setRighe,
            avvisa: setError,
            salva: () => segna(g, stampato),
          })
    );

  const nonStampato = (g) => segnaSubito(g, false);

  const ora = (iso) =>
    new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  // Il foglio, identico a video e sulla carta: quello che si vede è quello
  // che esce (e domani uscirà dalla termica con questa stessa impaginazione).
  const Foglio = ({ g, giaStampato }) => (
    <div
      // ⚠️ `ticket-cucina` c'e' SEMPRE, non solo mentre si stampa: e' la
      // classe da cui il blocco @media print riconosce che questo foglio
      // va alla termica della cucina e vuole 6,8 mm invece di 3,2 (il
      // preconto, che condivide `stampa-ticket`, non la porta).
      className={`ticket-cucina ${stampaKey === g.chiave ? "stampa-ticket " : ""}bg-white border border-dashed border-b58-charcoal/25 rounded-lg p-3 font-mono border-t-4 ${
        g.tipo === "chiamata" ? "border-t-b58-gold-dark" : "border-t-b58-terracotta"
      } ${giaStampato ? "opacity-60" : ""}`}
    >
      {g.tipo === "chiamata" ? (
        // 🔴 IL BIGLIETTO DEL TURNO NON DICE QUALE TURNO (deciso da Alessio,
        // 21/08): è generico e senza limitazioni. La cucina ha già la comanda
        // completa e vede da sé cosa resta da cucinare — questo foglio dice
        // «adesso», e su quale tavolo.
        <>
          <div className="print:text-base text-center font-bold testo-sala-grande border-b border-dashed border-b58-charcoal/30 pb-1.5 mb-1.5">
            {g.tavolo}
            <div className="print:text-xs font-normal testo-sala">{ora(g.quando)}</div>
          </div>
          <div className="print:text-lg text-center testo-sala-grande font-bold leading-tight py-2">
            AVANTI COL PROSSIMO TURNO
          </div>
        </>
      ) : (
        <>
          {/* 🔴 UN FOGLIO SOLO, COI TURNI SEPARATI DENTRO (22/08). Il
              21/08 questa pagina stampava **un foglio per turno**: era una
              traduzione sbagliata della richiesta di Alessio, che aveva
              chiesto le righe di separazione dentro la comanda — *«io ho
              già la comanda completa e vedrò cosa devo ancora cucinare per
              quel tavolo»*.
              ⚠️ E il difetto di partenza resta chiuso: quello che mancava
              non era il foglio in più, era che **i turni non si vedevano**.
              Ora si vedono, con la stessa banda della schermata. */}
          <div className="print:text-base text-center font-bold testo-sala-grande border-b border-dashed border-b58-charcoal/30 pb-1.5 mb-1.5">
            CUCINA — {g.tavolo}
            <div className="print:text-xs font-normal testo-sala">{ora(g.quando)}</div>
          </div>

          {g.turni.map(({ turno, items }) => (
            <div key={turno}>
              {/* ⚠️ QUI LE TAGLIE SONO IN PIXEL E NON IN CENTIMETRI VERI, ed
                  è voluto: questo foglio è disegnato per la CARTA da 72 mm,
                  dove `--pxcm` non vuol dire niente. Misurato: 24px
                  diventano ~6,3 mm sulla stampa e 3,2 mm sullo schermo alla
                  calibrazione 74.
                  ⚠️ Niente banda nera piena come a schermo: una termica la
                  stampa male e consuma nastro. Le righe sopra e sotto fanno
                  lo stesso lavoro con l'inchiostro che una stampante di
                  reparto sa fare. */}
              <div className="text-2xl font-bold text-center border-y-2 border-b58-charcoal py-1 my-1">
                {etichettaTurno(turno)}
                {g.aggiunta && " · AGGIUNTA"}
              </div>
              {items.map((i) => (
                <div key={i.id} className="py-0.5">
                  <div className="print:text-base testo-sala-grande leading-tight">
                    {/* 🔴 IL NOME ARRIVA DAL POSTO UNICO (24/08): qui c'era
                        la quarta copia di `lineLabel`, l'unica che non
                        sapeva riconoscere un bis. Il bocconcino in più si
                        stampava col suo nome nudo, in mezzo agli altri
                        piatti — cioè indistinguibile da una portata. */}
                    <b>{i.quantity}×</b> {nomeRiga(i)}
                  </div>
                  {/* 🔴 LA SOSTITUZIONE, E IN GRASSETTO CON UN BORDO: è il
                      punto dove un errore fa male davvero. Non è una nota
                      fra le altre — una nota si può leggere di sfuggita, una
                      sostituzione di allergene no.
                      ⚠️ Sta PRIMA della nota libera: se una riga ha tutte e
                      due, quella che riguarda la salute si legge per prima. */}
                  {/* ⚠️ PIÙ GRANDE DEL NOME DEL PIATTO, e non è enfasi: sulla
                      carta il nome sta a `testo-sala-grande`, questa riga a
                      `testo-sala-titolo`. È l'unica riga del biglietto che, se non
                      viene letta, manda in ospedale qualcuno — e la regola
                      di Alessio è che 3,20 mm sono il minimo accettabile,
                      non l'obiettivo. A schermo sta a 6 mm.
                      ⚠️ La frase sotto resta più piccola: dice COME si fa,
                      e si legge dopo aver visto CHE si fa. */}
                  {allergeniTolti(i).length > 0 && (
                    <div className="print:text-lg testo-sala-lontano font-bold border-2 border-b58-charcoal rounded px-1.5 py-0.5 my-0.5 ml-5">
                      SENZA{" "}
                      {allergeniTolti(i)
                        .map((a) => labelFor(ALLERGENS, a).toUpperCase())
                        .join(" · ")}
                      <div className="print:text-sm testo-sala-grande font-normal">
                        {frasiSostituzioni(i).join(" · ")}
                      </div>
                    </div>
                  )}
                  {i.note && <div className="print:text-sm testo-sala italic pl-5">↳ {i.note}</div>}
                </div>
              ))}
            </div>
          ))}

          {g.notaTavolo && (
            <div className="print:text-sm testo-sala italic border-t border-dashed border-b58-charcoal/30 mt-1.5 pt-1.5">
              Nota tavolo: {g.notaTavolo}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto pb-6">
      <div className="flex items-center justify-between gap-3 mb-3 print:hidden">
        <div>
          <h1 className="font-display text-2xl text-b58-charcoal leading-none">Cucina — stampa</h1>
          <p className="testo-sala text-b58-charcoal-soft/70 mt-1">
            {daStampare.length === 0 ? "Niente da stampare" : `${daStampare.length} da stampare`}
          </p>
        </div>
        <div className="flex gap-1.5">
          <Link to="/comande" className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4">
            Sala
          </Link>
          <Link to="/comande/bar" className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4">
            Bar
          </Link>
        </div>
      </div>

      {error && (
        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3 print:hidden">
          Elenco non aggiornato: {error}. Quello che vedi potrebbe essere incompleto.
        </p>
      )}

      {/* 🔴 QUI C'ERA UNA DIDASCALIA (tolta il 22/08): «La cucina lavora di
          carta (§3.2.1)… Quando arriverà il mini-PC, la stampa partirà da
          sola.» È una **spiegazione**, non un avviso: dice come funziona una
          cosa che il pulsante «🖨 Stampa» dice già da sé, e promette una
          cosa futura.
          ⚠️ Il criterio è quello del 18/08: *una spiegazione a schermo la si
          legge una volta e poi diventa arredamento* — e questa sta su una
          schermata che si guarda in servizio, dove l'ingombro si paga in
          secondi. La regola resta scritta dove serve: nel commento in testa
          a questo file, che il mini-PC lo nomina per esteso. */}

      {/* ⚠️ «Non ho ancora letto» non è «non c'è niente»: finché la prima
          lettura non è tornata non si dichiara la serata vuota (§6). */}
      {!letto ? (
        <p className="testo-sala text-b58-charcoal-soft/60 text-center py-10 border border-dashed border-b58-charcoal/15 rounded-xl print:hidden">
          Sto leggendo la coda…
        </p>
      ) : fogli.length === 0 ? (
        <p className="testo-sala text-b58-charcoal-soft/60 text-center py-10 border border-dashed border-b58-charcoal/15 rounded-xl print:hidden">
          Nessuna comanda per la cucina.
        </p>
      ) : (
        <div className="space-y-3">
          {daStampare.map((g) => (
            <div key={g.chiave}>
              <Foglio g={g} giaStampato={false} />
              <button
                type="button"
                onClick={() => stampa(g, false)}
                className="tocco-azione w-full mt-1.5 rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark text-b58-parchment testo-sala-grande font-semibold print:hidden"
              >
                🖨 Stampa
              </button>
            </div>
          ))}

          {stampati.length > 0 && (
            <p className="testo-sala uppercase tracking-wide text-b58-charcoal-soft/50 pt-2 print:hidden">
              Già stampati
            </p>
          )}
          {stampati.map((g) => (
            <div key={g.chiave}>
              <Foglio g={g} giaStampato />
              <div className="flex gap-2 mt-1.5 print:hidden">
                <button
                  type="button"
                    onClick={() => stampa(g, true)}
                  className="tocco-azione flex-1 rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark text-b58-charcoal testo-sala font-medium"
                >
                  Ristampa
                </button>
                <button
                  type="button"
                    onClick={() => nonStampato(g)}
                  className="tocco-azione flex-1 rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark text-b58-charcoal-soft testo-sala"
                >
                  ↺ Segna non stampato
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
