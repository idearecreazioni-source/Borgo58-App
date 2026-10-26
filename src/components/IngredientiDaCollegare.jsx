import { useState } from "react";
import CampoAutosalvato from "./CampoAutosalvato";
import Didascalia from "./Didascalia";
import { aggiornaDaCollegare, collegaIngrediente, togliDaCollegare } from "../lib/api/ricettaDaCollegare";
import { quantitaDalCampo } from "../lib/calcoli/bozzeRicetta";

// GLI INGREDIENTI CHE NON SONO ANCORA PRODOTTI DEL MAGAZZINO — 25/10/2026.
//
// Richiesta di Alessio: *«vorrei poter già catalogare tutte le mie ricette
// fin d'ora… l'associazione solo quando si dovrà calcolare il food cost e
// mettere una ricetta fra le preparazioni o in menu»*. Quindi una ricetta
// può tenere ingredienti scritti a parole, e il collegamento si fa da qui,
// uno alla volta, quando il prodotto esiste.
//
// ⚠️ Il database decide quando il collegamento diventa obbligatorio
//    (pronta per la carta, in un menu, dentro un'altra ricetta): qui si
//    mostra soltanto, e il rifiuto arriva con la sua frase.
//
// ⚠️ L'esito di un gesto sta SULLA RIGA TOCCATA, mai in cima alla pagina
//    (lezione del 17/08, ripagata il 27/08).
export default function IngredientiDaCollegare({ righe, prodotti, unita, modificabile, onCambiato }) {
  const [esiti, setEsiti] = useState({});
  const [inCorso, setInCorso] = useState(null);
  const [daTogliere, setDaTogliere] = useState(null);

  if (!righe.length) return null;

  const dici = (id, testo) => setEsiti((e) => ({ ...e, [id]: testo }));

  const salva = async (id, campi) => {
    try {
      await aggiornaDaCollegare(id, campi);
      dici(id, "");
      await onCambiato();
    } catch (err) {
      dici(id, err.message);
    }
  };

  const collega = async (id, ingredientId) => {
    if (!ingredientId || inCorso) return;
    setInCorso(id);
    try {
      await collegaIngrediente(id, ingredientId);
      await onCambiato();
    } catch (err) {
      dici(id, err.message);
    } finally {
      setInCorso(null);
    }
  };

  const togli = async (id) => {
    if (inCorso) return;
    setInCorso(id);
    try {
      await togliDaCollegare(id);
      setDaTogliere(null);
      await onCambiato();
    } catch (err) {
      dici(id, err.message);
    } finally {
      setInCorso(null);
    }
  };

  const campo =
    "w-full tocco-bottone rounded-lg border border-b58-charcoal/15 bg-white px-2 testo-sala text-b58-charcoal";

  return (
    <div className="mt-4">
      <h3 className="testo-sala-grande font-medium text-b58-charcoal mb-2 flex items-center gap-2">
        Da collegare al magazzino ({righe.length})
        <Didascalia>
          Sono scritti come li hai scritti tu. Non entrano nel costo né negli allergeni finché non li
          colleghi a un prodotto del magazzino. Servono collegati per segnare la ricetta pronta per la
          carta, per metterla in un menu o per usarla dentro un'altra ricetta.
        </Didascalia>
      </h3>
      {/* 🔴 UNA VOLTA SOLA, NON SOTTO OGNI RIGA (25/10/2026, Alessio: «ci sono
          ancora molte didascalie inutilmente visibili»). Con il magazzino
          vuoto la frase era ripetuta sotto ogni ingrediente insieme a un
          menu «Collega a un prodotto…» che non aveva niente da proporre. */}
      {prodotti.length === 0 && modificabile && (
        <p className="testo-sala text-b58-charcoal-soft mb-2">Il magazzino è ancora vuoto: per ora non c'è niente da collegare.</p>
      )}
      <ul className="space-y-2">
        {righe.map((r) => (
          <li key={r.id} className="rounded-lg bg-white border border-dashed border-b58-charcoal/25 p-3">
            {modificabile ? (
              <div className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr] gap-2">
                <div className="col-span-2 sm:col-span-1">
                  <CampoAutosalvato
                    value={r.nome}
                    etichetta="Nome dell'ingrediente"
                    onSave={(t) => (t.trim() ? salva(r.id, { nome: t.trim() }) : null)}
                    className={campo}
                  />
                </div>
                <CampoAutosalvato
                  value={r.quantita ?? ""}
                  type="text"
                  etichetta="Quantità"
                  placeholder="Quantità"
                  onSave={(t) => salva(r.id, { quantita: quantitaDalCampo(t) })}
                  className={campo}
                />
                <select
                  aria-label="Unità"
                  value={unita.some((u) => u.value === r.unita) ? r.unita : ""}
                  onChange={(e) => salva(r.id, { unita: e.target.value || null })}
                  className={campo}
                >
                  <option value="">{r.unita ? `«${r.unita}»` : "Unità"}</option>
                  {unita.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
                <div className="col-span-2 sm:col-span-3 flex flex-wrap gap-2">
                  {prodotti.length > 0 && (
                  <select
                    aria-label={`Collega «${r.nome}» a un prodotto`}
                    value=""
                    disabled={inCorso === r.id}
                    onChange={(e) => collega(r.id, e.target.value)}
                    className={`${campo} flex-1 min-w-[12rem]`}
                  >
                    <option value="">{inCorso === r.id ? "Collego…" : "Collega a un prodotto…"}</option>
                    {prodotti.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  )}
                  {daTogliere === r.id ? (
                    <>
                      <button
                        onClick={() => togli(r.id)}
                        className="tocco-bottone rounded-lg bg-b58-terracotta text-b58-parchment testo-sala px-3"
                      >
                        Sì, togli
                      </button>
                      <button
                        onClick={() => setDaTogliere(null)}
                        className="tocco-bottone rounded-lg border border-b58-charcoal/15 testo-sala px-3"
                      >
                        No
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setDaTogliere(r.id)}
                      className="tocco-bottone rounded-lg border border-b58-charcoal/15 testo-sala text-b58-charcoal-soft px-3"
                    >
                      Togli
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="testo-sala text-b58-charcoal">
                {r.nome}
                {r.quantita != null && ` · ${Number(r.quantita).toLocaleString("it-IT")}`}
                {r.unita && ` ${r.unita}`}
              </p>
            )}
            {r.nota && <p className="testo-sala text-b58-charcoal-soft mt-1">{r.nota}</p>}
            {esiti[r.id] && <p className="testo-sala text-b58-terracotta mt-1">{esiti[r.id]}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
