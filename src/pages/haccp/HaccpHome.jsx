import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/Icon";
import { riepilogoHaccpOggi } from "../../lib/api/haccp";

// 🔴 «OGGI» QUI VOLEVA DIRE UNA COSA DIVERSA DA «OGGI» NEL REGISTRO
// (24/08/2026). Fino a stanotte questa schermata contava le letture fuori
// range con `new Date().toDateString()` — il GIORNO DI CALENDARIO — mentre
// il registro delle temperature, riscritto poche ore fa, decide «oggi»
// con la SERATA DI SERVIZIO.
//
// ⚠️ Alle 03:00 la serata in corso è ancora il giorno prima: il badge
// diceva «0 fuori range oggi» mentre il registro sotto ne mostrava tre.
// Nessuna delle due parti era rotta — il difetto viveva **nello spazio
// fra le due**, che è il posto dove nessuna verifica guarda se non ce la
// si manda apposta. Ed è la famiglia del manuale HACCP che stampava
// «conforme» dove il database apriva una non conformità.
//
// ⚠️ E LA LETTURA ERA INTERA: per contare le letture di oggi si portavano
// a casa TUTTE le rilevazioni (732 sul progetto di prova) e si filtrava
// nel browser. Quella tabella cresce ogni giorno, e una lettura senza
// limite torna al massimo di mille righe senza dirlo — il badge avrebbe
// cominciato a contare su un pezzo, sempre verso il basso.
// *Un controllo chiede al database la risposta, non i dati su cui
// calcolarla.*

export default function HaccpHome() {
  const [oggi, setOggi] = useState(null);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    // Un errore qui non va ingoiato: "0 fuori range" per un problema di
    // rete è indistinguibile da una giornata a posto — e questo è un
    // modulo di sicurezza alimentare.
    riepilogoHaccpOggi()
      .then(setOggi)
      .catch((e) => setErrore(e.message));
  }, []);

  const openNc = Number(oggi?.non_conformita_aperte ?? 0);
  const nonCompliantToday = Number(oggi?.fuori_range_oggi ?? 0);
  const daLeggere = Number(oggi?.attrezzature_da_leggere ?? 0);
  const pulizieDovute = Number(oggi?.pulizie_dovute ?? 0);

  const cards = [
    {
      to: "/haccp/temperature",
      icon: "leaf",
      title: "Registro temperature",
      desc: "Attrezzature a temperatura controllata e rilevazioni.",
      // ⚠️ SI DICE ANCHE QUELLO CHE MANCA. Un badge che conta solo i
      // problemi TROVATI tace su quelli non ancora cercati: sei
      // frigoriferi mai letti oggi non danno nessun fuori range, e la
      // schermata sembrava a posto.
      alert:
        nonCompliantToday > 0
          ? `${nonCompliantToday} fuori range oggi`
          : daLeggere > 0
            ? `${daLeggere} da leggere oggi`
            : null,
    },
    {
      to: "/haccp/ricevimento",
      icon: "box",
      title: "Ricevimento merci",
      desc: "Controlli alla consegna: temperatura, imballaggio, conformità.",
    },
    // ⚠️ Subito dopo il ricevimento, e non è un ordine a caso: i lotti
    // NASCONO lì. Chi registra una consegna e poi vuole vedere cosa c'è in
    // casa con quel numero di lotto trova le due cose vicine.
    {
      to: "/haccp/tracciabilita",
      icon: "box",
      title: "Tracciabilità lotti",
      desc: "Ogni consegna registrata: fornitore, numero di lotto, scadenza.",
    },
    {
      to: "/haccp/pulizia",
      icon: "leaf",
      title: "Pulizia e disinfestazione",
      desc: "Attività di sanificazione e controllo infestanti.",
      alert: pulizieDovute > 0 ? `${pulizieDovute} da fare oggi` : null,
    },
    {
      to: "/haccp/non-conformita",
      icon: "receipt",
      title: "Non conformità",
      desc: "Segnalazioni e azioni correttive.",
      alert: openNc > 0 ? `${openNc} aperte` : null,
    },
    {
      to: "/haccp/raccolta-propria",
      icon: "leaf",
      title: "Raccolta propria",
      desc: "Erbe spontanee e prodotti autoraccolti.",
    },
  ];

  return (
    <div className="testo-sala max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          {/* 🔴 Sotto il titolo c'era «Piano di autocontrollo»: e la stessa cosa
              detta due volte — HACCP *e* il piano di autocontrollo.
              CANCELLATA, non nascosta: un segno che apre un sinonimo
              promette una spiegazione e non ne da una.
              🔴 LE DESCRIZIONI DELLE SEI CARD RESTANO, ed e una decisione:
              non sono didascalie sotto un titolo, sono l'unico modo di
              distinguere due destinazioni prima di premerle. Nasconderle
              vorrebbe dire aprire sei pannelli per scegliere dove andare. */}
          <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">HACCP</h1>
        </div>
        <Link
          to="/haccp/manuale"
          className="tocco-bottone inline-flex items-center rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala font-medium px-4"
        >
          Manuale completo (PDF)
        </Link>
      </div>

      {errore && (
        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          Contatori non aggiornati: {errore}. I numeri qui sotto potrebbero essere incompleti.
        </p>
      )}

      <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-6">
        Struttura pronta all'uso, ma le soglie di temperatura e le attività di pulizia vanno
        impostate — e validate con un consulente alimentare/tecnico HACCP — prima di affidarcisi
        in produzione.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            /* 🔴 ERA `inline-flex items-center` (25/08/2026, segnalato da
               Alessio: *«le scritte sono attaccate e fuori riga»*). Quella
               riga metteva icona, contatore, titolo e descrizione **in
               fila orizzontale**, e da lì venivano tutti e tre i sintomi
               in una volta: «Tracciabilità lotti» toccava la sua
               descrizione perché le erano affiancate, il contatore si
               infilava fra icona e titolo perché era il secondo della
               fila, e la pagina sbordava di 54 punti (444 su 390) perché
               tre blocchi affiancati in un telefono non ci stanno.
               ⚠️ Misurato nel browser alla calibrazione del dispositivo,
               non dedotto dal codice: erano le tre descrizioni a uscire
               dal bordo destro, fino a 444. */
            className="tocco-bottone flex flex-col rounded-xl bg-b58-parchment p-6 ring-1 ring-b58-charcoal/10 hover:ring-b58-terracotta/50 hover:shadow-sm transition-all"
          >
            {/* `w-full` perché il contatore vada al bordo destro della
                scheda: senza, `justify-between` non ha spazio da dividere
                e i due si accostano. */}
            <div className="flex w-full items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-b58-cream-dark flex items-center justify-center text-b58-terracotta mb-3">
                <Icon name={c.icon} className="w-5 h-5" />
              </div>
              {c.alert && (
                <span className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-full px-2 py-0.5">
                  {c.alert}
                </span>
              )}
            </div>
            <h3 className="font-display testo-sala-grande text-b58-charcoal">{c.title}</h3>
            {/* ⚠️ `mt-2` e non `mt-1`: quattro punti di stacco sono 0,63 mm
                veri alla calibrazione del tablet, e a quella distanza il
                titolo e la sua descrizione **si leggono attaccati** anche
                quando sono su righe diverse. Otto punti fanno 1,25 mm. */}
            <p className="testo-sala text-b58-charcoal-soft mt-2">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
