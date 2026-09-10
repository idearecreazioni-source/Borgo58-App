import { Link } from "react-router-dom";
import {
  avvisoDellElemento,
  candidatiDellElemento,
  impegnoScelto,
  nonDistinguibili,
  certezza,
  datiInChiaro,
  eta,
  quantiElementi,
  riassunto,
  perche,
  siPuoApprovare,
} from "../lib/calcoli/appunti";
import { perchéAspetta } from "../lib/calcoli/voce";
import { indirizzoAMano } from "../lib/calcoli/aMano";

// ⚠️ STA IN UN FILE SUO E NON DENTRO LA SCHERMATA, dal 06/09/2026, e la
//    ragione è misurata: la prova che lo guarda montava tutta la pagina
//    MEMO, e il peso faceva **scadere il tempo alle prove degli altri due
//    file** della stessa cartella — tre rosse che non c'entravano niente.
//    Togliendo il file tornavano verdi tutte. *Una prova che affama le
//    vicine le rende rosse per una ragione che non è la loro.*
// 🔴 L'UNITA' CHE SI APPROVA E' L'APPUNTO — SPEC-0013, 06/09/2026.
//
// Prima ogni riga detta aveva il suo «Sì, fallo». Adesso il sì e' uno solo e
// vale per tutto l'appunto: tre articoli detti per la stessa lista in tre
// momenti diversi si approvano insieme, due pagamenti restano due appunti e
// si approvano uno per uno.
//
// ⚠️ CIO' CHE SI VEDE PRIMA DI FIRMARE E' LA COSA CHE CONTA. «Approva» e' una
//    firma: se l'appunto riassumesse invece di mostrare, chi preme
//    autorizzerebbe una scrittura che non ha visto. Per questo ogni elemento
//    porta i **dati concreti** — quelli che finiranno nel gestionale — e non
//    una frase gentile.
function AppuntoDaApprovare({ appunto, occupato, esito, onApprova, onScarta, onScegli }) {
  const inCorso = esito?.stato === "in_corso" || occupato;
  const fatto = esito?.stato === "fatta";
  const fallito = esito?.stato === "fallita";
  const elementi = Array.isArray(appunto.elementi) ? appunto.elementi : [];
  const come = certezza(appunto);
  const approvabile = siPuoApprovare(appunto);

  return (
    <li className="rounded-lg border border-b58-cream-dark bg-b58-cream/40 p-3">
      {/* La riga che dice la verita' operativa: dove va e cosa ci finisce. */}
      <p className="testo-sala font-medium text-b58-charcoal">{riassunto(appunto)}</p>

      <p className="testo-sala mt-1 text-b58-charcoal-soft">
        {quantiElementi(appunto.quanti)} · aperto{" "}
        {eta(appunto.aperto_da_ore, appunto.aperto_da_giorni)}
      </p>

      {/* 🔴 TRE STATI, NON DUE, e si dicono con parole diverse perche' si
          curano in modi diversi: se MEMO non e' sicuro, si guarda il dato;
          se il gestionale non sa fare quella cosa, non c'e' niente da
          guardare e l'appunto e' un promemoria. Un solo colore per tutt'e
          due manderebbe a cercare un errore di ascolto che non c'e'. */}
      {/* 🔴 LA FRASE GENERALE SOLO SE L'APPUNTO NON NE HA UNA SUA —
          07/09/2026, dal collaudo a mano. Qui c'era sempre «il gestionale
          non sa ancora farlo», e su una riga di lista dettata senza dire in
          quale delle due era **falsa**: le due liste il gestionale le sa
          scrivere tutt'e due, quello che manca è sapere quale. Le due cose
          si curano in modi opposti — la prima manda a cercare una funzione
          che non c'è, la seconda si risolve con una parola in più.
          ⚠️ NON SI AGGIUNGE UNA SECONDA FRASE: il motivo vero l'elemento lo
          mostra già, qui sotto. Quello che si toglie è la riga che lo
          contraddiceva. *Due spiegazioni della stessa cosa, una falsa, sono
          peggio di una sola.*
          ⚠️ E resta dov'era per gli appunti che un gesto davvero non ce
          l'hanno: lì è vera, ed è l'unica cosa che si possa dire. */}
      {come === "senza_destinazione" && !perche(appunto) && (
        <p className="testo-sala mt-2 rounded-lg bg-b58-gold/15 px-3 py-2 text-b58-charcoal">
          Ho capito cosa vuoi, ma <strong>il gestionale non sa ancora farlo</strong>: questo
          appunto resta qui come promemoria finché non lo costruiamo.
        </p>
      )}
      {come === "incerto" && (
        <p className="testo-sala mt-2 rounded-lg bg-b58-terracotta/10 px-3 py-2 text-b58-terracotta-dark">
          <strong>Non sono sicuro di aver capito bene.</strong> Guarda i dati qui sotto prima di
          approvare.
        </p>
      )}

      <ul className="mt-2 space-y-2">
        {elementi.map((e) => (
          <ElementoDellAppunto
            key={e.id}
            elemento={e}
            inCorso={inCorso}
            onScegli={(sceltaId) => onScegli(e.id, sceltaId)}
          />
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {approvabile ? (
          <button
            type="button"
            onClick={onApprova}
            disabled={inCorso || fatto}
            className="tocco-riga rounded-lg bg-b58-olive px-4 testo-sala text-white disabled:opacity-60"
          >
            {/* 🔴 «…» non è un riscontro: chi non capisce che sta succedendo
                qualcosa ripreme. Le parole per intero, anche se occupano. */}
            {fatto
              ? "✓ Fatto"
              : inCorso
                ? "Lo sto scrivendo…"
                : fallito
                  ? "Riprova"
                  : elementi.length === 1
                    ? "Approva"
                    : `Approva tutte e ${elementi.length}`}
          </button>
        ) : (
          <span className="testo-sala text-b58-charcoal-soft">Non c&apos;è niente da approvare</span>
        )}
        <button
          type="button"
          onClick={onScarta}
          disabled={inCorso || fatto}
          className="tocco-riga rounded-lg px-4 testo-sala text-b58-terracotta-dark disabled:opacity-60"
        >
          Butta l&apos;appunto
        </button>
      </div>

      {/* 🔴 L'ESITO STA QUI, SULL'APPUNTO TOCCATO, e non in cima alla pagina:
          «un rifiuto lontano dal gesto è un rifiuto che non c'è» — lezione
          del 17/08, già pagata una volta in Cassa.

          🔴 E DICE PER PRIMA COSA CHE NON È STATO SCRITTO NIENTE — 06/09/2026,
             da un caso vero. Alessio ha premuto «Approva», il pulsante ha detto
             «Lo sto scrivendo…», poi in Lista della spesa non è comparso niente
             e l'appunto è rimasto lì. Il gestionale aveva ragione — non aveva
             scritto — ma chi guardava non poteva saperlo: **la stessa schermata
             è compatibile con «è andata storta» e con «ha scritto e non me lo
             mostra»**, e sono due cose che si curano in modo opposto.
          ⚠️ Per questo la prima riga è il fatto, non il motivo: il motivo lo si
             legge dopo, quando si è già smesso di temere il doppione. */}
      {fallito && (
        <div className="testo-sala mt-2 rounded-lg bg-b58-terracotta/10 px-3 py-2 text-b58-terracotta-dark">
          <p>
            <strong>Non è stato scritto niente.</strong> L&apos;appunto è ancora qui,
            intero: puoi riprovare.
          </p>
          <p className="mt-1">{esito.messaggio}</p>
        </div>
      )}
    </li>
  );
}

function ElementoDellAppunto({ elemento, inCorso, onScegli }) {
  const scelte = Array.isArray(elemento.scelte) ? elemento.scelte : [];
  const chiedeQuale = elemento.domanda === "scegli" && scelte.length > 0;
  // ⚠️ `manca` è il caso in cui nemmeno il gestionale sa cosa proporre: non
  //    c'è niente da toccare, e resta la via d'uscita — ridire, o farlo a mano.
  const chiedeAltro = elemento.domanda === "manca";
  const concreti = datiInChiaro(elemento.dati);
  const alternative = Array.isArray(elemento.alternative) ? elemento.alternative : [];
  // ⚠️ L'elenco di sola lettura resta come RIPIEGO, non come doppione: si
  //    mostra soltanto quando non c'e' niente da toccare — per esempio se
  //    tutti i candidati sono stati chiusi dopo che l'appunto era nato.
  //    Mostrarlo insieme ai pulsanti direbbe due volte la stessa cosa, e la
  //    seconda sembrerebbe un'altra.
  const candidati = chiedeQuale ? [] : candidatiDellElemento(elemento);
  const scelto = impegnoScelto(elemento);
  const gemelli = nonDistinguibili(elemento);

  return (
    <li className="rounded-lg bg-b58-parchment px-3 py-2">
      <p className="testo-sala text-b58-charcoal">{elemento.frase}</p>

      {/* 🔴 I DATI CHE VERREBBERO SCRITTI, non una sintesi. Se qui non ci
          fosse niente da mostrare lo si dice: «nessun dato» è
          un'informazione — vuol dire che approvando non si scrive nessun
          valore, ed è una cosa che va vista PRIMA di approvare. */}
      <p className="testo-sala mt-0.5 text-b58-charcoal-soft">
        {concreti === "" ? "nessun dato da scrivere" : concreti}
      </p>

      {/* 🔴 L'AVVISO SI LEGGE PER INTERO PRIMA DI FIRMARE — 10/09/2026.
          Quello che si approva qui non è un dato in tabella: è **un
          telefono che suonerà**. I due campi lo dicono già nella riga
          sopra («ti avviso il … · alle …»), e questa aggiunge la sola cosa
          che quei campi non possono dire da soli — che il messaggio parte
          da un giro che passa ogni cinque minuti.
          ⚠️ Non è una scusa scritta piccola: chi aspetta il Telegram alle
          15:00 spaccate e lo riceve alle 15:04 pensa che il gestionale
          funzioni male. Dirlo prima costa una riga; scoprirlo dopo costa
          la fiducia in tutti gli avvisi. */}
      {avvisoDellElemento(elemento) && (
        <p className="testo-sala mt-0.5 text-b58-olive-dark">
          📲 Ti mando una notifica su Telegram il{" "}
          <strong>{avvisoDellElemento(elemento).giorno}</strong> alle{" "}
          <strong>{avvisoDellElemento(elemento).ora}</strong> — o entro i cinque minuti dopo.
        </p>
      )}

      {perchéAspetta(elemento) && (
        <p className="testo-sala mt-0.5 text-b58-charcoal-soft">{perchéAspetta(elemento)}</p>
      )}

      {/* ⚠️ LE ALTRE STRADE CONSIDERATE. Senza, «non sono sicuro» è un dubbio
          che Alessio deve sciogliere da solo; con, è una scelta fra due cose
          che qualcuno ha già guardato. */}
      {alternative.length > 0 && (
        <p className="testo-sala mt-1 text-b58-charcoal-soft">
          Avevo pensato anche a:{" "}
          {alternative.map((a, i) => (
            <span key={`${a.destinazione}-${i}`}>
              {i > 0 ? "; " : ""}
              <strong>{a.destinazione}</strong>
              {a.perche ? ` (${a.perche})` : ""}
            </span>
          ))}
        </p>
      )}

      {/* 🔴 QUANDO GLI IMPEGNI POSSIBILI SONO DUE, SI DICE QUALI — 09/09/2026.
          MEMO non ne sceglie nessuno, ed e' giusto: fra due candidati
          altrettanto buoni non esiste nessun criterio onesto per preferirne
          uno, e sbagliare vuol dire chiudere l'impegno di un altro o
          spostare una scadenza che nessuno voleva toccare.
          ⚠️ MA «quale dei 2» senza dire quali mandava a cercarli in Agenda,
          cioe' a rifare a mano il lavoro appena fatto dal gestionale. Il
          giorno c'e' sempre perche' e' quello che li distingue: due titoli
          somiglianti senza data sono la stessa domanda, scritta piu' lunga.
          ⚠️ NON SI TOCCANO, e non e' una dimenticanza: un pulsante per
          sceglierli renderebbe approvabile un appunto che finche' i
          candidati sono due non deve esserlo. La via d'uscita e' qui
          sotto — ridirlo, o aprire l'Agenda. */}
      {candidati.length > 0 && (
        <div className="mt-1">
          <p className="testo-sala text-b58-charcoal-soft">Potrebbero essere questi:</p>
          <ul className="mt-0.5 space-y-0.5">
            {candidati.map((c, i) => (
              <li key={`${c.titolo}-${i}`} className="testo-sala text-b58-charcoal">
                <strong>{c.titolo}</strong>
                {c.quando ? ` — ${c.quando}` : " — senza scadenza"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 🔴 QUALE IMPEGNO E' STATO SCELTO, scritto per esteso — 09/09/2026.
          Il titolo compare anche nella riga grigia dei dati concreti, in
          mezzo agli altri campi. Ma qui si sta per firmare la chiusura di
          una riga di Agenda, e *quale* riga non e' un campo fra gli altri:
          e' la cosa. Compare SOLO se c'e' stata una scelta vera, perche'
          dirlo dove nessuno ha scelto sarebbe raccontare un gesto che non
          c'e' stato. */}
      {scelto && (
        <p className="testo-sala mt-1 rounded-lg bg-b58-sage/15 px-3 py-2 text-b58-charcoal">
          Hai scelto: <strong>{scelto}</strong>
        </p>
      )}

      {chiedeAltro && (
        <p className="testo-sala mt-1 text-b58-charcoal-soft">
          Ridillo a voce aggiungendo quello che manca, oppure fallo a mano qui sotto: quello che
          hai detto resta qui finché non fai una delle due.
        </p>
      )}

      {/* 🔴 LA VIA D'USCITA A MANO — decisione di Alessio del 27/08: *«mi
          aspetto che un collegamento mi porti dove si segnano le spese, coi
          campi noti già compilati»*. Il percorso arriva dal DATABASE
          (`azione_percorso`), non da una mappa scritta qui: il giorno che
          nasce un tipo nuovo, una mappa nel browser porterebbe da nessuna
          parte e nessuna verifica se ne accorgerebbe. */}
      {elemento.percorso && (
        <p className="testo-sala mt-1">
          <Link
            to={indirizzoAMano(elemento.percorso, elemento.id)}
            className="tocco-riga inline-flex items-center rounded-lg px-2 -mx-1 text-b58-terracotta hover:underline"
          >
            Fallo a mano →
          </Link>
        </p>
      )}

      {/* ⚠️ SCEGLIERE NON SCRIVE PIU' NIENTE (SPEC-0013): riempie il campo e
          l'appunto resta lì. Il sì è l'approvazione dell'appunto, e arriva
          dopo — perché nel frattempo dentro ci possono essere altre righe. */}
      {chiedeQuale && (
        <div className="mt-1">
          {/* ⚠️ «dei due» solo quando sono due: con tre candidati quella
              frase conterebbe male, e chi legge si fida del numero. */}
          <p className="testo-sala text-b58-charcoal">
            {scelte.length === 2 ? "Quale dei due?" : "Quale di questi?"}
          </p>

          {/* 🔴 QUANDO NON SI DISTINGUONO, LO SI DICE. Due righe gemelle
              offerte come una scelta fanno tirare a sorte credendo di
              decidere: e' la stessa forma dell'elenco vuoto che si legge
              «non c'e' niente». I pulsanti restano — lui puo' saperlo —
              ma non si finge che l'elenco basti. */}
          {gemelli && (
            <p className="testo-sala mt-0.5 rounded-lg bg-b58-terracotta/10 px-3 py-2 text-b58-terracotta-dark">
              <strong>Da qui non riesco a distinguerli.</strong> Hanno lo stesso nome, lo
              stesso giorno e tutto il resto uguale: se non sei sicuro, aprili in Agenda
              prima di scegliere.
            </p>
          )}

          <div className="mt-1 flex flex-wrap gap-2">
            {scelte.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onScegli(s.id)}
                disabled={inCorso}
                /* ⚠️ `tocco-scelta` mette un pavimento di 44 punti sotto la
                   misura in centimetri veri: su un monitor 1,05 cm fanno
                   39,7 punti, sotto la soglia del dito. `text-left` e
                   `py-2` servono ai nomi lunghi degli impegni, che vanno a
                   capo invece di uscire dallo schermo. */
                className="tocco-scelta flex max-w-full items-center rounded-lg bg-b58-charcoal px-4 py-2 text-left testo-sala text-b58-parchment disabled:opacity-60"
              >
                {s.nome}
              </button>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

export default AppuntoDaApprovare;
