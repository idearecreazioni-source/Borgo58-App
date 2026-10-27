import { useState } from "react";
import { ALLERGENS, SEASONS, labelFor } from "../lib/constants";
import { aggiungiTag, cambiaAllergene, togliTag } from "../lib/calcoli/archivioRicette";
// ⚠️ La regola delle stagioni è quella della scheda ricetta (12/09/2026),
//    non una seconda: due regole per lo stesso pulsante divergono.
import { stagioneAccesa, stagioniDopoIlTocco, stagioniNormalizzate } from "../lib/calcoli/stagionalita";
import Didascalia from "./Didascalia";

// TAG, STAGIONI E ALLERGENI D'ARCHIVIO — 25/10/2026.
//
// Un pezzo solo per la bozza e per la ricetta: due copie di questi tre
// controlli, prima o poi, tratterebbero «nessun allergene» in due modi.
//
// 🔴 GLI ALLERGENI HANNO TRE STATI, e si vedono tutti e tre:
//    · `null` → «non ancora detti» (non «nessuno»: è la salute di qualcuno);
//    · `[]` → «nessun allergene», detto da qualcuno;
//    · un elenco.
//    E l'elenco dice SEMPRE da dove viene: «proposti da MEMO» finché non lo
//    tocchi o premi «Confermo»; qualunque gesto tuo lo fa «confermati».
//
// Chi lo usa passa i valori e le funzioni di salvataggio; `modifica` dice se
// i controlli si vedono o se si legge e basta. Senza `onStagioni` le stagioni
// si leggono ma non si toccano da qui (la scheda ricetta ha già i suoi
// pulsanti).

const chip = "rounded-full px-3 py-0.5 testo-sala";
const piena = `${chip} bg-b58-cream-dark text-b58-charcoal`;
const tenue = `${chip} bg-b58-charcoal/5 text-b58-charcoal-soft/70`;
const interruttore = (acceso) =>
  `tocco-bottone rounded-full border px-3 testo-sala ${
    acceso
      ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark-testo font-medium"
      : "border-b58-charcoal/15 text-b58-charcoal-soft"
  }`;

export function OrigineAllergeni({ origine }) {
  if (origine === "proposti") return <span className="testo-sala text-b58-ambra-dark-testo">proposti da MEMO, da confermare</span>;
  if (origine === "confermati") return <span className="testo-sala text-b58-olive-dark-testo">confermati da te</span>;
  if (origine === "prodotti") return <span className="testo-sala text-b58-charcoal-soft">dai prodotti del magazzino</span>;
  return null;
}

export function TagEStagioni({ tags, stagioni, modifica, suggeriti = [], onTags, onStagioni }) {
  const [nuovo, setNuovo] = useState("");
  const elenco = tags ?? [];
  const st = stagioni ?? [];

  if (!modifica) {
    if (!elenco.length && !st.length) return null;
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {stagioniNormalizzate(st).map((s) => (
          <span key={s} className={piena}>{labelFor(SEASONS, s)}</span>
        ))}
        {elenco.map((t) => (
          <span key={t} className={tenue}>#{t}</span>
        ))}
      </div>
    );
  }

  const aggiungi = () => {
    const dopo = aggiungiTag(elenco, nuovo);
    setNuovo("");
    if (dopo !== elenco) onTags(dopo);
  };

  return (
    <div className="mt-3 grid gap-3">
      {onStagioni && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Stagioni">
          {SEASONS.map((s) => (
            <button
              key={s.value}
              type="button"
              className={interruttore(stagioneAccesa(st, s.value))}
              aria-pressed={stagioneAccesa(st, s.value)}
              onClick={() => onStagioni(stagioniDopoIlTocco(st, s.value))}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {elenco.map((t) => (
          <button
            key={t}
            type="button"
            className={`tocco-bottone ${tenue}`}
            aria-label={`Togli il tag ${t}`}
            onClick={() => onTags(togliTag(elenco, t))}
          >
            #{t} ✕
          </button>
        ))}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            aggiungi();
          }}
        >
          <input
            value={nuovo}
            onChange={(e) => setNuovo(e.target.value)}
            list="tag-archivio"
            placeholder="nuovo tag"
            aria-label="Nuovo tag"
            className="tocco-riga w-40 rounded-lg border border-b58-charcoal/20 bg-b58-campo px-3 text-b58-charcoal"
          />
          <datalist id="tag-archivio">
            {suggeriti.filter((t) => !elenco.includes(t)).map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <button type="submit" disabled={!nuovo.trim()} className="tocco-bottone rounded-lg border border-b58-charcoal/20 px-3 disabled:opacity-50">
            Aggiungi
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Gli allergeni detti per la ricetta intera (archivio). `allergeni` può
 * essere null. `extra`: allergeni già contati dai prodotti collegati, che si
 * mostrano accanto e non si possono togliere da qui.
 */
export function AllergeniArchivio({ allergeni, origine, modifica, extra = [], onAllergeni }) {
  const elenco = allergeni ?? [];
  const tutti = [...new Set([...extra, ...elenco])];

  if (!modifica) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {allergeni == null && !extra.length ? (
          <span className={tenue}>allergeni non ancora detti</span>
        ) : tutti.length === 0 ? (
          <span className={piena}>nessun allergene</span>
        ) : (
          tutti.map((a) => (
            <span key={a} className={piena}>{labelFor(ALLERGENS, a)}</span>
          ))
        )}
        {allergeni != null && <OrigineAllergeni origine={origine} />}
        {origine === "proposti" && onAllergeni && (
          <button
            type="button"
            className="tocco-bottone rounded-lg border border-b58-olive/40 px-3 text-b58-olive-dark-testo"
            onClick={() => onAllergeni(elenco)}
          >
            Confermo
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Allergeni">
        {ALLERGENS.map((a) => {
          const daiProdotti = extra.includes(a.value);
          const acceso = daiProdotti || elenco.includes(a.value);
          return (
            <button
              key={a.value}
              type="button"
              disabled={daiProdotti}
              className={`${interruttore(acceso)} disabled:opacity-70`}
              aria-pressed={acceso}
              onClick={() => onAllergeni(cambiaAllergene(allergeni, a.value))}
            >
              {a.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {allergeni == null ? (
          <span className={tenue}>non ancora detti</span>
        ) : (
          <OrigineAllergeni origine={origine} />
        )}
        {allergeni == null || elenco.length > 0 ? (
          <button type="button" className="tocco-bottone rounded-lg border border-b58-charcoal/20 px-3" onClick={() => onAllergeni([])}>
            Nessun allergene
          </button>
        ) : null}
        {origine === "proposti" && (
          <button
            type="button"
            className="tocco-bottone rounded-lg border border-b58-olive/40 px-3 text-b58-olive-dark-testo"
            onClick={() => onAllergeni(elenco)}
          >
            Confermo
          </button>
        )}
        <Didascalia>
          Gli allergeni della ricetta intera, finché i suoi ingredienti non sono tutti collegati al magazzino: dopo
          valgono quelli dei prodotti. Quelli proposti da MEMO restano da confermare finché non li tocchi o premi
          «Confermo». Non arrivano mai sul menu: una ricetta con ingredienti da collegare non può andare in carta.
          {extra.length > 0 && " Quelli spenti vengono dai prodotti già collegati, e si cambiano dalla loro scheda."}
        </Didascalia>
      </div>
    </div>
  );
}
