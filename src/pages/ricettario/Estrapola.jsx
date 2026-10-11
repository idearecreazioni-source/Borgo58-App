import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listRecipes } from "../../lib/api/recipes";
import { listBozzeRicetta } from "../../lib/api/bozzeRicetta";
import { aggiungiEstrapolazione, estrapolaRicette } from "../../lib/api/estrapola";
import { notaDalleRicette, righeDaMettere, rigaDiRicetta } from "../../lib/calcoli/estrapola";
import { unaVoltaSola } from "../../lib/calcoli/voce";
import { qtaConUnita } from "../../lib/constants";
import DatoNonLetto from "../../components/DatoNonLetto";

// «ESTRAPOLA» — dalle ricette alla lista della spesa (R11, 11/10/2026).
//
// Tre passi, uno sotto l'altro: scegli le ricette e per quante porzioni →
// guarda gli ingredienti che servono, consolidati, e correggi → metti in
// lista quelli che tieni.
//
// 🔴 NIENTE ENTRA IN LISTA DA SOLO: la proposta si guarda, si corregge e si
//    conferma. Nessun ordine, nessuno scarico di magazzino.
// ⚠️ Le ricette di Alessio oggi vivono soprattutto nelle BOZZE (il ricettario
//    virtuale), quindi si scelgono anche quelle. Una bozza già diventata
//    ricetta non compare due volte: si sceglie la ricetta.
// ⚠️ Quello che il gestionale non sa — quantità q.b., prodotto non collegato,
//    unità diversa — si DICE riga per riga, in ambra. Non si inventa una
//    conversione e non si scrive zero.

const campo = "tocco-riga rounded-lg border border-b58-charcoal/20 bg-white px-3 text-b58-charcoal";

export default function Estrapola() {
  const [ricette, setRicette] = useState(null);
  const [bozze, setBozze] = useState(null);
  const [errLettura, setErrLettura] = useState("");
  const [scelte, setScelte] = useState({}); // chiave "tipo:id" -> porzioni (stringa)
  const [proposta, setProposta] = useState(null);
  const [tenute, setTenute] = useState({});
  const [quantita, setQuantita] = useState({});
  const [lavorando, setLavorando] = useState(false);
  const [errore, setErrore] = useState("");
  const [fatto, setFatto] = useState(null);
  const guardia = useRef(unaVoltaSola());

  const carica = () => {
    setErrLettura("");
    Promise.all([listRecipes({ selezioni: false }), listBozzeRicetta()])
      .then(([r, b]) => {
        setRicette(r ?? []);
        setBozze((b ?? []).filter((x) => !x.promossa_il && x.stato !== "scartata"));
      })
      .catch((e) => setErrLettura(e.message));
  };
  useEffect(carica, []);

  const voci = useMemo(() => {
    if (!ricette || !bozze) return [];
    return [
      ...ricette.map((r) => ({ chiave: `ricetta:${r.id}`, tipo: "ricetta", id: r.id, nome: r.name, resa: r.portions_yield, dove: "Ricetta" })),
      ...bozze.map((b) => ({ chiave: `bozza:${b.id}`, tipo: "bozza", id: b.id, nome: b.titolo, resa: b.porzioni, dove: "Bozza" })),
    ].sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  }, [ricette, bozze]);

  const scelteValide = Object.entries(scelte).filter(([, p]) => Number(String(p).replace(",", ".")) > 0);
  const sceltaSenzaPorzioni = Object.values(scelte).some((p) => !(Number(String(p).replace(",", ".")) > 0));

  const tocca = (v) => {
    setProposta(null);
    setFatto(null);
    setScelte((s) => {
      const n = { ...s };
      if (v.chiave in n) delete n[v.chiave];
      else n[v.chiave] = v.resa ? String(v.resa) : "";
      return n;
    });
  };

  const estrapola = async () => {
    setErrore("");
    setFatto(null);
    setLavorando(true);
    try {
      const righe = await estrapolaRicette(
        scelteValide.map(([k, p]) => {
          const [tipo, id] = k.split(":");
          return { tipo, id, porzioni: Number(String(p).replace(",", ".")) };
        })
      );
      setProposta(righe);
      // Si parte tenendo tutto quello che è un ingrediente: togliere è un gesto.
      setTenute(Object.fromEntries(righe.filter((r) => !rigaDiRicetta(r)).map((r) => [r.chiave, true])));
      setQuantita({});
    } catch (e) {
      setErrore(e.message);
    } finally {
      setLavorando(false);
    }
  };

  const daMettere = proposta ? righeDaMettere(proposta, tenute, quantita) : [];

  const mettiInLista = async () => {
    if (!daMettere.length || !guardia.current.prendi("lista")) return;
    setErrore("");
    setLavorando(true);
    try {
      const n = await aggiungiEstrapolazione(daMettere);
      setFatto(n);
      setProposta(null);
      setScelte({});
    } catch (e) {
      setErrore(e.message);
    } finally {
      guardia.current.lascia("lista");
      setLavorando(false);
    }
  };

  if (errLettura) {
    return (
      <div className="mx-auto max-w-3xl p-4 testo-sala-grande">
        <DatoNonLetto cosa="le ricette" nonVuolDire="che non ce ne siano" onRiprova={carica} />
      </div>
    );
  }
  if (!ricette || !bozze) return <p className="p-4 testo-sala-grande">Caricamento…</p>;

  const intere = (proposta ?? []).filter(rigaDiRicetta);
  const ingredienti = (proposta ?? []).filter((r) => !rigaDiRicetta(r));

  return (
    <div className="mx-auto max-w-3xl p-4 testo-sala-grande">
      <Link to="/ricettario" className="tocco-bottone inline-flex items-center text-b58-charcoal-soft">
        ← Ricettario
      </Link>
      <h1 className="mt-2 mb-4 font-display text-2xl md:text-3xl text-b58-charcoal">Estrapola la spesa</h1>

      {fatto != null && (
        <p className="mb-4 rounded-xl bg-b58-olive/10 p-3 text-b58-olive-dark">
          {fatto === 1 ? "Una riga è entrata" : `${fatto} righe sono entrate`} nella lista della spesa.{" "}
          <Link to="/magazzino/lista-spesa" className="underline">
            Apri la lista
          </Link>
        </p>
      )}

      {/* ---- 1. le ricette ---- */}
      <section className="mb-4 rounded-xl bg-b58-parchment p-4 ring-1 ring-b58-charcoal/10">
        <h2 className="mb-2 font-display font-semibold text-b58-charcoal">Quali ricette, e per quante porzioni</h2>
        {voci.length === 0 ? (
          <p className="text-b58-charcoal-soft/70">Non ci sono ancora ricette né bozze.</p>
        ) : (
          <ul className="divide-y divide-b58-charcoal/10">
            {voci.map((v) => {
              const scelta = v.chiave in scelte;
              return (
                <li key={v.chiave} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1">
                  <label className="tocco-riga flex min-w-0 flex-1 items-center gap-3">
                    <input type="checkbox" checked={scelta} onChange={() => tocca(v)} />
                    <span className="min-w-0">
                      <span className="text-b58-charcoal">{v.nome}</span>{" "}
                      <span className="testo-sala text-b58-charcoal-soft/70">· {v.dove}</span>
                    </span>
                  </label>
                  {scelta && (
                    <span className="inline-flex items-center gap-2">
                      <input
                        inputMode="decimal"
                        aria-label={`Porzioni di ${v.nome}`}
                        value={scelte[v.chiave]}
                        placeholder="quante?"
                        onChange={(e) => {
                          setProposta(null);
                          setScelte((s) => ({ ...s, [v.chiave]: e.target.value }));
                        }}
                        className={`${campo} w-24 text-right`}
                      />
                      porzioni
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!scelteValide.length || sceltaSenzaPorzioni || lavorando}
            onClick={estrapola}
            className="tocco-bottone rounded-lg bg-b58-azione px-5 font-medium text-b58-parchment hover:bg-b58-azione-dark disabled:opacity-50"
          >
            {lavorando && !proposta ? "Sto calcolando…" : "Estrapola"}
          </button>
          {sceltaSenzaPorzioni && (
            <span className="testo-sala text-b58-ambra-dark">Scrivi per quante porzioni, su ogni ricetta scelta.</span>
          )}
        </div>
      </section>

      {errore && <p className="mb-4 rounded bg-red-50 p-3 text-red-700">{errore}</p>}

      {/* ---- 2. la proposta ---- */}
      {proposta && (
        <section className="mb-4 rounded-xl bg-b58-parchment p-4 ring-1 ring-b58-charcoal/10" data-proposta>
          <h2 className="mb-2 font-display font-semibold text-b58-charcoal">Cosa serve</h2>

          {intere.length > 0 && (
            <ul className="mb-3 rounded-lg bg-b58-ambra/10 p-3 text-b58-ambra-dark">
              {intere.map((r) => (
                <li key={r.chiave}>
                  «{r.nome}»: {r.problema}.
                </li>
              ))}
            </ul>
          )}

          {ingredienti.length === 0 ? (
            <p className="text-b58-charcoal-soft/70">Nessun ingrediente da mettere in lista.</p>
          ) : (
            <ul className="divide-y divide-b58-charcoal/10">
              {ingredienti.map((r) => (
                <li key={r.chiave} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 py-2">
                  <input
                    type="checkbox"
                    className="mt-3"
                    aria-label={`Metti in lista ${r.nome}`}
                    checked={!!tenute[r.chiave]}
                    onChange={(e) => setTenute((t) => ({ ...t, [r.chiave]: e.target.checked }))}
                  />
                  <div className={`min-w-0 ${tenute[r.chiave] ? "" : "opacity-50"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        inputMode="decimal"
                        aria-label={`Quantità di ${r.nome}`}
                        value={
                          quantita[r.chiave] ??
                          (r.quantita == null ? "" : Number(r.quantita).toLocaleString("it-IT", { maximumFractionDigits: 3, useGrouping: false }))
                        }
                        placeholder="quanto"
                        onChange={(e) => setQuantita((q) => ({ ...q, [r.chiave]: e.target.value }))}
                        className={`${campo} w-28 text-right tabular-nums`}
                      />
                      <span className="text-b58-charcoal-soft">{r.unita ?? ""}</span>
                      <span className="font-medium text-b58-charcoal">{r.nome}</span>
                    </div>
                    <p className="testo-sala text-b58-charcoal-soft/80">{notaDalleRicette(r.da)}</p>
                    {r.gia_in_lista != null && (
                      <p className="testo-sala text-b58-charcoal-soft">
                        Già in lista: {qtaConUnita(r.gia_in_lista, r.unita)}.
                      </p>
                    )}
                    {r.problema && <p className="testo-sala text-b58-ambra-dark">{r.problema}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* ---- 3. in lista ---- */}
          {ingredienti.length > 0 && (
            <button
              type="button"
              disabled={!daMettere.length || lavorando}
              onClick={mettiInLista}
              className="tocco-bottone mt-3 rounded-lg bg-b58-azione px-5 font-medium text-b58-parchment hover:bg-b58-azione-dark disabled:opacity-50"
            >
              {lavorando
                ? "Sto mettendo in lista…"
                : daMettere.length === 1
                  ? "Metti in lista 1 riga"
                  : `Metti in lista ${daMettere.length} righe`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
