import { useEffect, useRef, useState } from "react";

import {
  FASCE,
  convertiFascia,
  fasciaDi,
  minutiDaOfferire,
  oraComposta,
  oreDellaFascia,
  scorriCircolare,
} from "../lib/calcoli/oraScelta";

// =====================================================================
// IL PANNELLO DELL'ORA — 20/09/2026
// =====================================================================
// 🔴 QUARTA FORMA IN UN GIORNO, e ognuna è caduta per una ragione diversa.
//    (1) Campo orario del browser: offriva tutti e sessanta i minuti e
//        rifiutava al salvataggio — un divieto che si incontra dopo.
//    (2) Due menu a tendina: giusti, ma due elenchi lunghi col dito.
//    (3) Due ruote in linea: si sceglieva mentre si scorreva, senza un
//        momento in cui dire «ho scelto» — e ogni tocco cambiava il valore
//        vero, quindi non c'era modo di ripensarci.
//    (4) Questo: un RIQUADRO che si apre, con la fascia, le due ruote, la
//        riga centrale evidenziata, **Annulla e Conferma**.
//
// 🔴 PERCHE' ANNULLA E CONFERMA CAMBIANO LA SOSTANZA: finché il pannello è
//    aperto si muove una BOZZA, non l'orario. Chi gira la ruota per vedere e
//    poi cambia idea esce com'era entrato. Senza quei due pulsanti «guardare»
//    e «scegliere» sono lo stesso gesto.
//
// ⚠️ E SULL'IPHONE SI USA LA STESSA RUOTA. Il selettore nativo si potrebbe
//    tenere solo potendo verificare che proponga davvero i soli scaglioni da
//    cinque: da qui **non si può verificare** — non c'è nessun iPhone in
//    questo ambiente, e `step` è un vincolo di validità, non una promessa su
//    cosa la rotella mostra. Quindi vale la regola: *mai un selettore che
//    mostri tutti i minuti per poi respingerne alcuni al salvataggio*.
//    Una sola strada, la stessa dappertutto, ed è anche l'unica che si può
//    provare senza un telefono in mano.

function Ruota({ etichetta, dataCampo, voci, valore, onScegli }) {
  const riferimento = useRef(null);

  useEffect(() => {
    const scelta = riferimento.current?.querySelector('[aria-selected="true"]');
    // ⚠️ `scrollIntoView` non esiste in jsdom: si chiama solo se c'è, così le
    //    prove di schermata non si rompono su una cosa che non riguarda loro.
    if (scelta?.scrollIntoView) scelta.scrollIntoView({ block: "center" });
  }, [valore, voci]);

  const valori = voci.map((v) => v.valore);

  const daTastiera = (e) => {
    const passo = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (passo) {
      e.preventDefault();
      return onScegli(scorriCircolare(valori, valore, passo));
    }
    if (e.key === "Home") {
      e.preventDefault();
      return onScegli(valori[0]);
    }
    if (e.key === "End") {
      e.preventDefault();
      return onScegli(valori[valori.length - 1]);
    }
  };

  return (
    <div
      role="listbox"
      aria-label={etichetta}
      data-campo={dataCampo}
      data-valore={valore || ""}
      tabIndex={0}
      onKeyDown={daTastiera}
      onWheel={(e) => onScegli(scorriCircolare(valori, valore, e.deltaY > 0 ? 1 : -1))}
      ref={riferimento}
      className="ruota-ora"
    >
      {/* ⚠️ Un po' di vuoto sopra e sotto: senza, la prima e l'ultima voce
          non possono mai arrivare in mezzo, e la riga evidenziata mentirebbe
          proprio ai due capi. */}
      <div className="ruota-vuoto" aria-hidden="true" />
      {voci.map((v) => (
        <button
          key={v.valore}
          type="button"
          role="option"
          aria-selected={v.valore === valore}
          data-valore={v.valore}
          onClick={() => onScegli(v.valore)}
          className={`ruota-voce testo-sala ${
            v.valore === valore ? "text-b58-charcoal font-semibold" : "text-b58-charcoal-soft"
          }`}
        >
          {v.etichetta}
        </button>
      ))}
      <div className="ruota-vuoto" aria-hidden="true" />
    </div>
  );
}

export default function SceltaOra({
  value,
  onChange,
  disabled = false,
  nome = "orario",
  "data-campo": dataCampo,
}) {
  const [aperto, setAperto] = useState(false);
  // 🔴 LA BOZZA: finché il pannello è aperto si muove questa, non l'orario.
  const [bozza, setBozza] = useState(value || "");

  const apri = () => {
    // Si parte da quello che c'è; se non c'è niente, dalle 09:00 — una
    // proposta che si vede, non una scelta fatta al posto suo.
    setBozza(value || "09:00");
    setAperto(true);
  };

  const ore = bozza.slice(0, 2);
  const minuti = bozza.slice(3, 5);
  const fascia = fasciaDi(bozza);

  return (
    <div className="inline-block" data-scelta-ora={dataCampo} data-valore={value || ""}>
      <button
        type="button"
        data-apri-ora
        disabled={disabled}
        aria-haspopup="dialog"
        aria-label={`Scegli l'ora (${nome})`}
        onClick={apri}
        className={`tocco-campo campo-ora testo-sala rounded-lg border border-b58-sand bg-white px-2 text-left ${
          disabled ? "opacity-50" : ""
        }`}
      >
        {value || "Scegli l'ora"}
      </button>

      {aperto && (
        <div
          role="dialog"
          aria-label={`Scegli l'ora (${nome})`}
          data-pannello-ora={dataCampo}
          className="mt-1 rounded-lg border border-b58-sand bg-white p-2 shadow-lg"
        >
          {/* 🔴 PRIMA LA FASCIA: dodici voci per ruota invece di ventiquattro.
              ⚠️ Cambiarla sposta l'ora di dodici e lascia stare i minuti —
                 «09:30 mattina» diventa «21:30», non ricomincia da capo. */}
          <div className="flex gap-1" role="group" aria-label={`Mattina o pomeriggio (${nome})`}>
            {FASCE.map((f) => (
              <button
                key={f.id}
                type="button"
                data-fascia={f.id}
                aria-pressed={fascia === f.id}
                onClick={() => setBozza(convertiFascia(bozza, f.id))}
                className={`tocco-bottone testo-sala flex-1 rounded-lg border px-2 ${
                  fascia === f.id
                    ? "border-b58-terracotta bg-b58-terracotta text-white"
                    : "border-b58-sand bg-white text-b58-charcoal-soft"
                }`}
              >
                {f.etichetta}
              </button>
            ))}
          </div>

          <div className="ruote-ora mt-2">
            {/* La riga centrale: è lì che si legge la scelta. */}
            <div className="riga-centrale" data-riga-centrale aria-hidden="true" />
            <Ruota
              etichetta={`Ore (${nome})`}
              dataCampo={dataCampo ? `${dataCampo}-ore` : undefined}
              voci={oreDellaFascia(fascia).map((h) => ({ valore: h, etichetta: h }))}
              valore={ore}
              onScegli={(h) => setBozza(oraComposta(h, minuti || "00"))}
            />
            <span aria-hidden="true" className="self-center text-b58-charcoal-soft">
              :
            </span>
            <Ruota
              etichetta={`Minuti (${nome})`}
              dataCampo={dataCampo ? `${dataCampo}-minuti` : undefined}
              voci={minutiDaOfferire(minuti)}
              valore={minuti}
              onScegli={(m) => setBozza(oraComposta(ore, m))}
            />
          </div>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              data-annulla-ora
              onClick={() => setAperto(false)}
              className="tocco-bottone testo-sala flex-1 rounded-lg border border-b58-sand bg-white px-2 text-b58-charcoal-soft"
            >
              Annulla
            </button>
            <button
              type="button"
              data-conferma-ora
              onClick={() => {
                onChange(bozza);
                setAperto(false);
              }}
              className="tocco-bottone testo-sala flex-1 rounded-lg bg-b58-terracotta px-2 text-white"
            >
              Conferma
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
