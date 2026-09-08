import { Link } from "react-router-dom";

// =====================================================================
// LA RISPOSTA DI MEMO — fase 1, sola lettura (07/09/2026)
// =====================================================================
// ⚠️ STA IN UN FILE SUO E NON DENTRO LA SCHERMATA, per la ragione misurata
//    il 06/09: una prova che monta tutta la pagina MEMO affama le prove
//    vicine, e le rende rosse per una ragione che non è la loro. Qui si
//    monta solo questo riquadro.
//
// 🔴 QUESTO RIQUADRO NON HA NESSUN PULSANTE CHE SCRIVA, e non è una
//    dimenticanza: una domanda non cambia niente nel gestionale. Gli unici
//    gesti sono *scegli quale* (che rifà la stessa domanda, leggendo) e
//    *vai a guardare* (un collegamento).
//
// ⚠️ IL COLLEGAMENTO C'È SEMPRE, anche sotto un «non lo so»: è il gesto
//    d'uscita, e un rifiuto senza gesto d'uscita è un vicolo cieco. Serve
//    anche a un'altra cosa, che è il senso di tutta la fase 1 — quello che
//    MEMO dice si può **andare a controllare**, e se non combacia si vede.

const SEGNO = {
  risposta: null,
  // ⚠️ I tre casi storti si vedono che sono storti, e si vedono DIVERSI fra
  //    loro: «non lo so» non è «non ce n'è», e nessuno dei due è «dimmi di
  //    che cosa».
  non_lo_so: { icona: "⚠️", sfondo: "bg-b58-terracotta/10", testo: "text-b58-terracotta-dark" },
  chiarimento: { icona: "❓", sfondo: "bg-b58-gold/15", testo: "text-b58-charcoal" },
  scegli: { icona: "❓", sfondo: "bg-b58-gold/15", testo: "text-b58-charcoal" },
  non_so_farlo: { icona: "—", sfondo: "bg-b58-cream", testo: "text-b58-charcoal" },
};

function RispostaMemo({ titolo, testoDetto, risposta, onScegli, occupato }) {
  if (!risposta) return null;
  const segno = SEGNO[risposta.stato] ?? null;

  return (
    <div className="mt-6 rounded-xl border border-b58-cream-dark bg-white p-4 md:p-6">
      <h2 className="testo-sala-lontano font-medium text-b58-charcoal">{titolo}</h2>
      {testoDetto && (
        <p className="testo-sala mt-1 text-b58-charcoal-soft">Hai detto: «{testoDetto}»</p>
      )}

      {/* 🔴 NON HO SCRITTO NIENTE, DETTO SEMPRE E NON SOLO QUANDO SERVE.
          Chi ha appena parlato a MEMO è abituato a vedersi comparire un
          appunto da approvare: il silenzio si legge «forse ha segnato
          qualcosa». Una riga costa niente e toglie il dubbio. */}
      <p className="testo-sala mt-1 text-b58-charcoal-soft">
        Era una domanda: non ho scritto niente nel gestionale.
      </p>

      <div
        className={`mt-3 rounded-lg px-3 py-3 ${segno ? segno.sfondo : "bg-b58-olive/10"}`}
      >
        <p className={`testo-sala-lontano ${segno ? segno.testo : "text-b58-charcoal"}`}>
          {segno?.icona ? `${segno.icona} ` : ""}
          {risposta.frase}
        </p>

        {risposta.righe?.length > 0 && (
          <ul className="mt-2 space-y-1">
            {risposta.righe.map((r) => (
              <li key={r.chiave} className="testo-sala text-b58-charcoal">
                ·{" "}
                {r.a ? (
                  <Link to={r.a} className="text-b58-terracotta hover:underline">
                    {r.testo}
                  </Link>
                ) : (
                  r.testo
                )}
              </li>
            ))}
          </ul>
        )}

{/* 🔴 IL TAGLIO SI DICHIARA. Sei righe stanno in uno schermo; le
            sessantotto misurate col modello vero, no. Il numero nella frase
            resta quello vero, e qui si dice quante non si vedono e dove
            sono tutte.
            ⚠️ IL POSTO ARRIVA GIÀ SCRITTO (`dentro`), e non si ricava più
            tagliando l'articolo all'etichetta del pulsante: quella
            sostituzione conosceva «il», «lo» e «l'», e alla prima
            destinazione femminile — «Apri la Cassa» — avrebbe scritto «le
            trovi tutte in la Cassa». Nessun errore, una frase storta. */}
        {risposta.troppe > 0 && (
          <p className="testo-sala mt-2 text-b58-charcoal-soft">
            … e altre {risposta.troppe}: le trovi tutte{" "}
            {risposta.dentro ?? "nella sua schermata"}.
          </p>
        )}

        {/* ⚠️ IL LIMITE STA DENTRO LA RISPOSTA, non sotto in piccolo: «non
            manca niente» e «non manca niente FRA I PRODOTTI CHE HANNO UNA
            SCORTA MINIMA» sono due frasi diverse, e la seconda è quella
            vera. Un avviso staccato dal numero si legge dopo il numero, cioè
            quando la conclusione è già stata tratta. */}
        {risposta.limite && (
          <p className="testo-sala mt-2 text-b58-charcoal-soft">{risposta.limite}</p>
        )}
      </div>

      {/* 🔴 PIÙ CANDIDATI: SI CHIEDE, NON SI SCEGLIE. Toccare un nome rifà la
          stessa domanda con quel nome — un'altra lettura, nessuna scrittura. */}
      {risposta.candidati?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {risposta.candidati.map((c) => (
            <button
              key={c.chiave}
              type="button"
              onClick={() => onScegli?.(c)}
              disabled={occupato}
              className="tocco-riga rounded-lg bg-b58-charcoal px-4 testo-sala text-b58-parchment disabled:opacity-60"
            >
              {c.testo}
            </button>
          ))}
        </div>
      )}

      {risposta.a && (
        <p className="testo-sala mt-3">
          <Link to={risposta.a} className="text-b58-terracotta hover:underline">
            {risposta.apri} →
          </Link>
        </p>
      )}
    </div>
  );
}

export default RispostaMemo;
