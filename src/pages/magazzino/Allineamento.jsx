import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  allineaGiacenza,
  daAllineare,
  foodCostReale,
  scostamentiPerProdotto,
} from "../../lib/api/stock";
import DatoNonLetto from "../../components/DatoNonLetto";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import { formatEUR, formatQta, oggiLocale, primoDelMeseLocale } from "../../lib/constants";
import { propostaLeggibile } from "../../lib/calcoli/quantita";
import ElencoAdattivo from "../../components/ElencoAdattivo";
import { useDaVoce } from "../../lib/daVoce";
import { StriscaDallaVoce } from "../../components/StriscaDallaVoce";

// L'ALLINEAMENTO DEL MAGAZZINO — 20/08/2026.
//
// 🔴 SI APRE SULL'ELENCO, NON SUL RAPPORTO, ed è una scelta di Alessio: *si
// entra per fare una cosa, non per leggere un rapporto*. In cima ci sono i
// prodotti in esaurimento, perché quello è il momento in cui il numero serve
// per decidere — *«devo ordinare gli spaghetti, il gestionale dice 5 kg e
// invece ne ho 4»*.
//
// ⚠️ E il trend sta SOTTO, da aprire: Alessio non vuole avvisi — *«mi rendo
// conto da solo man mano che aggiorno le giacenze»*.
export default function Allineamento() {
  const [righe, setRighe] = useState([]);
  const [aperta, setAperta] = useState(null);
  const [quanto, setQuanto] = useState("");
  const [esito, setEsito] = useState("");
  const [errore, setErrore] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mostraTrend, setMostraTrend] = useState(false);
  const [dal, setDal] = useState(primoDelMeseLocale());
  const [al, setAl] = useState(oggiLocale());
  const [costi, setCosti] = useState(null);
  const [dettaglio, setDettaglio] = useState([]);

  // 🔴 ARRIVATO QUI DA UNA GIACENZA DETTATA: si apre la riga di quel
  //    prodotto col numero già scritto. Quando il prodotto non è stato
  //    riconosciuto arriva solo il numero, e la riga la sceglie lui.
  const venuto = useDaVoce((c) => {
    if (c.prodotto) setAperta(c.prodotto);
    if (c.quanto) setQuanto(String(c.quanto));
  });

  const carica = () => leggi(daAllineare()).then(setRighe);

  useEffect(() => {
    carica();
  }, []);

  useEffect(() => {
    if (!mostraTrend) return;
    leggi(foodCostReale(dal, al)).then(setCosti);
    leggi(scostamentiPerProdotto(dal, al)).then(setDettaglio);
  }, [mostraTrend, dal, al]);

  const elenco = useMemo(() => (nonLetto(righe) ? [] : righe), [righe]);
  // ⚠️ Qui si contavano i prodotti sotto scorta, per la frase in cima che
  // il 29/08 è uscita. Il dato `sotto_soglia` continua ad arrivare e non è
  // stato tolto: lo guarda la Lista della spesa, che è dove serve a
  // decidere cosa ordinare.

  const conferma = async (r) => {
    setSalvando(true);
    setErrore("");
    setEsito("");
    try {
      const esitoVero = await allineaGiacenza(r.ingredient_id, quanto);
      // ⚠️ La frase arriva dal database insieme ai numeri: composta qui
      // sarebbe un secondo posto dove dire la stessa cosa, e i due posti
      // prima o poi direbbero due cose diverse.
      setEsito(esitoVero.frase);
      // 🔴 Solo se è il prodotto che aveva detto: allineandone un altro,
      //    quella cosa detta non è stata fatta.
      const suo = venuto.azione?.campi?.prodotto;
      if (!suo || suo === r.ingredient_id) await venuto.chiudi();
      setAperta(null);
      setQuanto("");
      await carica();
      if (mostraTrend) {
        setCosti(await leggi(foodCostReale(dal, al)));
        setDettaglio(await leggi(scostamentiPerProdotto(dal, al)));
      }
    } catch (e) {
      setErrore(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  return (
    <div className="testo-sala max-w-3xl mx-auto pb-16">
      <Link to="/magazzino" className="tocco-bottone inline-flex items-center testo-sala text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Magazzino
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-1">Allineamento magazzino</h1>
      {/* 🔴 LA PAROLA, e va detta una volta qui perché è il senso della
          schermata: quel numero è una previsione, non una giacenza. Detta
          dove sta il dubbio, non in cima a ogni riga. */}
      <p className="testo-sala text-b58-charcoal-soft mb-6">
        Il gestionale calcola quanto <em>dovrebbe</em> esserci, seguendo le ricette al grammo.
        Quando apri la dispensa e il conto non torna, scrivi qui quanto ce n&apos;è davvero.
      </p>

      <StriscaDallaVoce venuto={venuto} />

      {errore && (
        <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {errore}
        </p>
      )}
      {esito && (
        <p className="testo-sala text-b58-charcoal bg-b58-olive/10 rounded-lg px-3 py-2 mb-4">{esito}</p>
      )}

      {nonLetto(righe) ? (
        <DatoNonLetto
          cosa="cosa c'è da allineare"
          nonVuolDire="Non vuol dire che è tutto a posto: vuol dire che non lo so."
          onRiprova={carica}
        />
      ) : elenco.length === 0 ? (
        <p className="testo-sala text-b58-charcoal-soft">
          Non c&apos;è niente in dispensa da allineare: nessun prodotto ha una scorta o una soglia.
        </p>
      ) : (
        <>
          {/* 🔴 QUI C'ERA «In cima ci sono i 55 prodotti in esaurimento»
              (tolta il 29/08). Diceva due cose, tutte e due sbagliate:
              l'elenco e' in ordine ALFABETICO — Aceto, Agnello, Amido… —
              quindi non c'era nessun «in cima»; e «in esaurimento»
              compariva anche sull'agnello a **0 kg**, che non e' in
              esaurimento: e' finito.
              ⚠️ Il segno «in esaurimento» e' uscito da ogni riga per
              richiesta esplicita di Alessio. Chi guarda questa schermata
              sta contando quello che ha davanti, non decidendo cosa
              ordinare: quella decisione si prende dalla Lista della spesa,
              che la soglia la guarda gia'. */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 divide-y divide-b58-charcoal/5">
            {elenco.map((r) => (
              <div key={r.ingredient_id} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setAperta(aperta === r.ingredient_id ? null : r.ingredient_id);
                    // ⚠️ Il campo si apre col numero che il gestionale dice:
                    // chi deve solo confermare non riscrive niente, e chi
                    // corregge parte da lì. Scriverlo vuoto farebbe ridigitare
                    // un numero che è già a schermo.
                    setQuanto(propostaLeggibile(r.atteso, r.unita));
                    setEsito("");
                  }}
                  className="tocco-riga w-full flex items-center justify-between gap-3 text-left"
                >
                  {/* 🔴 IL NOME GROSSO, IL NUMERO ACCANTO (29/08/2026).
                      Prima il nome e la giacenza avevano lo stesso peso, e
                      davanti allo scaffale si cerca il NOME: e' l'unica
                      cosa che si sta confrontando con la merce in mano. */}
                  <span className="testo-sala-titolo text-b58-charcoal">{r.nome}</span>
                  {/* 🔴 «dovrebbe essercene» ERA SU OGNI RIGA — 121 volte,
                      misurate. Tre parole ripetute centoventun volte non
                      informano: riempiono. Restano il numero e l'unita', e
                      cosa vogliano dire sta scritto UNA VOLTA in cima. */}
                  <span className="testo-sala-grande text-b58-charcoal-soft">
                    {formatQta(r.atteso)} {r.unita}
                    {/* 🔴 IL SEGNO CHE LA RIGA SI APRE (23/08/2026). Il campo
                        per scrivere quanto ce n'è davvero **c'era già** — è
                        dentro la riga — ma la pagina si apriva con **zero
                        campi visibili**, e la promessa in cima («scrivi qui
                        quanto ce n'è davvero») non aveva niente su cui
                        posarsi. Un gesto che esiste e non si annuncia è un
                        gesto che nessuno fa.
                        ⚠️ Il segno non è inventato qui: è la stessa coppia
                        ▸ / ▾ che l'Agenda e la Posta in arrivo usano già per
                        le righe che si aprono. */}
                    <span className="ml-2 text-b58-charcoal-soft/70">
                      {aperta === r.ingredient_id ? "▾" : "▸"}
                    </span>
                  </span>
                </button>

                {aperta === r.ingredient_id && (
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <div className="w-40">
                      <label className="block testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1">
                        Quanto ce n&apos;è ({r.unita})
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        autoFocus
                        value={quanto}
                        onChange={(e) => setQuanto(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={salvando || quanto === ""}
                      onClick={() => conferma(r)}
                      className="tocco-bottone rounded-lg bg-b58-olive hover:bg-b58-olive-dark text-b58-parchment testo-sala px-4 disabled:opacity-60"
                    >
                      {salvando ? "…" : "È questo"}
                    </button>
                    {/* ⚠️ La differenza NON si chiede: la calcola il gestionale.
                        Davanti allo scaffale non si fanno conti. */}
                    <p className="testo-sala text-b58-charcoal-soft basis-full">
                      Scrivi quanto ce n&apos;è, non quanto togliere: la differenza la faccio io.
                      {r.giorni_da_allora != null && (
                        <> Ultimo allineamento {r.giorni_da_allora} giorni fa.</>
                      )}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* IL TREND — si apre, non compare. Alessio non vuole avvisi. */}
      <button
        type="button"
        onClick={() => setMostraTrend((v) => !v)}
        className="tocco-bottone testo-sala text-b58-charcoal-soft underline hover:text-b58-terracotta mt-8"
      >
        {mostraTrend ? "Nascondi come sta andando" : "Come sta andando"}
      </button>

      {mostraTrend && (
        <div className="mt-4 rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5">
          <div className="flex flex-wrap gap-3 mb-4">
            <div>
              <label className="block testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1">Dal</label>
              <input type="date" value={dal} onChange={(e) => setDal(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1">Al</label>
              <input type="date" value={al} onChange={(e) => setAl(e.target.value)} className={inputClass} />
            </div>
          </div>

          {nonLetto(costi) ? (
            <DatoNonLetto cosa="il food cost del periodo" />
          ) : (
            costi && (
              <>
                {/* 🔴 I DUE NUMERI RESTANO DISTINTI E RICONOSCIBILI: sullo
                    stimato Alessio decide i prezzi del menu, il reale è quello
                    che sta vivendo. Fusi in uno «aggiornato», i prezzi si
                    farebbero su un numero che si muove da sé. */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 testo-sala">
                  <div>
                    <div className="testo-sala uppercase tracking-wide text-b58-charcoal-soft">
                      Dalle ricette
                    </div>
                    <div className="text-b58-charcoal">{formatEUR(costi.stimato)}</div>
                  </div>
                  <div>
                    <div className="testo-sala uppercase tracking-wide text-b58-charcoal-soft">
                      Quello che è successo
                    </div>
                    <div className="testo-sala-grande text-b58-charcoal font-medium">{formatEUR(costi.reale)}</div>
                  </div>
                  <div>
                    <div className="testo-sala uppercase tracking-wide text-b58-charcoal-soft">Differenza</div>
                    <div
                      className={
                        Number(costi.scostamento) > 0 ? "text-b58-terracotta-dark" : "text-b58-charcoal"
                      }
                    >
                      {Number(costi.scostamento) > 0 ? "+" : ""}
                      {formatEUR(costi.scostamento)}
                    </div>
                  </div>
                  <div>
                    <div className="testo-sala uppercase tracking-wide text-b58-charcoal-soft">In percentuale</div>
                    {/* ⚠️ Vuoto, non zero: senza piatti venduti quella
                        percentuale non esiste, e uno zero si legge «in linea». */}
                    <div className="text-b58-charcoal">
                      {costi.scarto_percento == null ? "—" : `${Number(costi.scarto_percento)}%`}
                    </div>
                  </div>
                </div>
                {/* ⚠️ L'avvertenza viaggia coi numeri e arriva dal database:
                    un limite scritto nel testo di una schermata non protegge
                    la seconda che mostra lo stesso numero. */}
                <p className="testo-sala text-b58-charcoal-soft mt-3 leading-relaxed">
                  {costi.avvertenza}
                </p>
              </>
            )
          )}

          {/* SOTTO, CHI SCAPPA — prodotto per prodotto. */}
          {nonLetto(dettaglio) ? (
            <DatoNonLetto cosa="il dettaglio per prodotto" className="mt-4" />
          ) : dettaglio.length > 0 ? (
            <ElencoAdattivo
              righe={dettaglio}
              chiave={(d) => d.ingredient_id}
              titolo={(d) => d.nome}
              intestazioneTitolo="Prodotto"
              campi={(d) => [
                {
                  chiave: "differenza",
                  etichetta: "Differenza",
                  valore: `${Number(d.differenza) > 0 ? "+" : ""}${formatQta(d.differenza)} ${d.unita}`,
                },
                {
                  chiave: "vale",
                  etichetta: "Vale",
                  // ⚠️ Il segno resta colorato solo quando la differenza e'
                  // in piu': un colore che c'e' sempre smette di segnalare.
                  valore:
                    Number(d.valore) > 0 ? (
                      <span className="text-b58-terracotta-dark">+{formatEUR(d.valore)}</span>
                    ) : (
                      formatEUR(d.valore)
                    ),
                },
                { chiave: "volte", etichetta: "Volte", valore: String(d.quante) },
              ]}
            />
          ) : (
            <p className="testo-sala text-b58-charcoal-soft mt-4">
              In questo periodo non hai corretto nessuna giacenza.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
