import { useEffect, useRef } from "react";

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
// LE DUE RUOTE DELL'ORA — 20/09/2026
// =====================================================================
// 🔴 TRE MODI DI USARLE, E NESSUNO E' UN RIPIEGO. Col dito si scorre e si
//    tocca la voce; con la rotella del mouse la ruota gira; con le frecce
//    si sale e si scende, e con Inizio/Fine si va ai capi. Un componente che
//    funzionasse solo col dito lascerebbe fuori il computer, e uno che
//    funzionasse solo col mouse lascerebbe fuori il servizio.
//
// ⚠️ LA VOCE SCELTA SI PORTA SOTTO L'OCCHIO DA SE' (`scrollIntoView`): una
//    ruota che mostra il valore scelto fuori schermo è una ruota che
//    nasconde meglio, non che evidenzia. È la stessa regola del giro D3.
//
// ⚠️ IL BERSAGLIO E' IN CENTIMETRI VERI (`tocco-bottone`, 0,85 cm) e non in
//    pixel: su un tablet un elenco dimensionato in pixel diventa minuscolo.

function Ruota({ etichetta, dataCampo, voci, valore, onScegli, disabled }) {
  const riferimento = useRef(null);

  useEffect(() => {
    const scelta = riferimento.current?.querySelector('[aria-selected="true"]');
    // ⚠️ `scrollIntoView` non esiste in jsdom: si chiama solo se c'è, così le
    //    prove di schermata non si rompono su una cosa che non riguarda loro.
    if (scelta?.scrollIntoView) scelta.scrollIntoView({ block: "nearest" });
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
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onKeyDown={disabled ? undefined : daTastiera}
      onWheel={
        disabled
          ? undefined
          : (e) => onScegli(scorriCircolare(valori, valore, e.deltaY > 0 ? 1 : -1))
      }
      ref={riferimento}
      className={`ruota-ora rounded-lg border border-b58-sand bg-white overflow-y-auto ${
        disabled ? "opacity-50" : ""
      }`}
    >
      {voci.map((v) => (
        <button
          key={v.valore}
          type="button"
          role="option"
          aria-selected={v.valore === valore}
          data-valore={v.valore}
          disabled={disabled}
          onClick={() => onScegli(v.valore)}
          className={`tocco-bottone testo-sala w-full px-2 text-center ${
            v.valore === valore ? "bg-b58-terracotta text-white" : "hover:bg-b58-sand-light"
          }`}
        >
          {v.etichetta}
        </button>
      ))}
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
  const ore = (value || "").slice(0, 2);
  const minuti = (value || "").slice(3, 5);
  const fascia = fasciaDi(value);

  return (
    <div className="flex flex-col gap-1" data-scelta-ora={dataCampo}>
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
            disabled={disabled}
            onClick={() => onChange(convertiFascia(value, f.id))}
            className={`tocco-bottone testo-sala px-2 rounded-lg border ${
              fascia === f.id
                ? "border-b58-terracotta bg-b58-terracotta text-white"
                : "border-b58-sand bg-white text-b58-charcoal-soft"
            }`}
          >
            {f.etichetta}
          </button>
        ))}
      </div>

      <div className="flex items-stretch gap-1">
        <Ruota
          etichetta={`Ore (${nome})`}
          dataCampo={dataCampo ? `${dataCampo}-ore` : undefined}
          voci={oreDellaFascia(fascia).map((h) => ({ valore: h, etichetta: h }))}
          valore={ore}
          disabled={disabled}
          // ⚠️ Scegliendo un'ora senza minuti si parte da :00, e si vede.
          onScegli={(h) => onChange(oraComposta(h, minuti || "00"))}
        />
        <span aria-hidden="true" className="self-center text-b58-charcoal-soft">
          :
        </span>
        <Ruota
          etichetta={`Minuti (${nome})`}
          dataCampo={dataCampo ? `${dataCampo}-minuti` : undefined}
          voci={minutiDaOfferire(minuti)}
          valore={minuti}
          // Senza un'ora non c'è niente da scegliere: un minuto da solo non
          // è un orario.
          disabled={disabled || !ore}
          onScegli={(m) => onChange(oraComposta(ore, m))}
        />
      </div>
    </div>
  );
}
