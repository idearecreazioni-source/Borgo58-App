import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ScattaFoto from "../../components/ScattaFoto";
import Didascalia from "../../components/Didascalia";
import DatoNonLetto from "../../components/DatoNonLetto";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import {
  chiHaMessoIlTetto,
  impostaTettoAi,
  listLettureFoto,
  sbloccaSpesaAi,
  spesaAiDelMese,
} from "../../lib/api/assistenteFoto";
import { formatEUR } from "../../lib/constants";

// Fotografa qualcosa e lascia che l'assistente dica cos'è.
//
// ⚠️ QUI IL CONTESTO NON E' NOTO, ed è la differenza con la stessa foto
//    scattata dalla scheda di un prodotto: là si sta guardando un
//    prodotto, quindi non si chiede dove mettere quello che viene letto.
//    Qui invece l'assistente deve capirlo da sé, e quando non è sicuro
//    chiede invece di tirare a indovinare.
//
// ⚠️ LA SPESA STA SULLA STESSA SCHERMATA di dove si spende. Un conto che
//    vive in un angolo delle impostazioni è un conto che nessuno guarda
//    finché non arriva la fattura.

export default function Fotografa() {
  const navigate = useNavigate();
  const [spesa, setSpesa] = useState(null);
  const [letture, setLetture] = useState(null);
  const [esito, setEsito] = useState(null);
  const [tetto, setTetto] = useState("");
  const [chiTetto, setChiTetto] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState("");

  const ricarica = useCallback(() => {
    leggi(spesaAiDelMese()).then((s) => {
      setSpesa(s);
      if (s && s !== nonLetto) setTetto(s.tetto_euro == null ? "" : String(s.tetto_euro));
    });
    leggi(listLettureFoto(15)).then(setLetture);
    leggi(chiHaMessoIlTetto()).then(setChiTetto);
  }, []);

  useEffect(ricarica, [ricarica]);

  const salvaTetto = async () => {
    setSalvando(true);
    setErrore("");
    try {
      await impostaTettoAi(tetto === "" ? null : Number(tetto));
      ricarica();
    } catch (e) {
      setErrore(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const sblocca = async () => {
    setSalvando(true);
    setErrore("");
    try {
      await sbloccaSpesaAi();
      ricarica();
    } catch (e) {
      setErrore(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4">
      {/* 🔴 SI CHIAMA MEMO — decisione di Alessio del 27/08.
          ⚠️ Il TITOLO prende il nome, il PULSANTE no: «Fotografa» è il
             gesto, e il gesto non si chiama come chi lo esegue. Il titolo
             dice dove sei, il pulsante dice cosa fare. */}
      <h1 className="testo-sala-titolo mb-1 font-semibold text-b58-charcoal">MEMO foto</h1>
      <p className="testo-sala mb-4 text-b58-charcoal-soft">
        Scatta una foto e MEMO ti dice cosa ci vede.
      </p>

      {/* 🔴 IL GESTO STA DOVE ARRIVA IL POLLICE (27/08). Qui la foto È la
          schermata, quindi il pulsante va in basso sul telefono.
          ⚠️ Misurato prima di spostarlo: stava a **167 punti dal bordo
             alto** su uno schermo da 375. Sulla scheda di un prodotto lo
             stesso componente NON lo fa, perché lì la foto è uno dei tanti
             campi. */}
      <ScattaFoto
        genere="qualunque"
        etichettaPulsante="Fotografa"
        gestoInBasso
        onLetto={(risposta) => setEsito(risposta)}
      />

      {/* ------------------------------------------------------------- */}
      {/* Cosa ha visto                                                  */}
      {/* ------------------------------------------------------------- */}
      {esito?.esito === "letta" && esito.riconosciuto === "etichetta" && (
        <div className="testo-sala mt-4 rounded-lg bg-emerald-50 p-4 text-emerald-900">
          <p className="font-semibold">
            È l&apos;etichetta di: {esito.scheda?.nome ?? "un prodotto"}
          </p>
          {/* ⚠️ QUANDO NON E' SICURO, CHIEDE. La decisione è di Alessio:
              procede se è sicuro, chiede se non lo è — e la certezza la
              dichiara l'assistente, non una soglia inventata qui. */}
          {!esito.sicuro && (
            <p className="mt-1 text-amber-900">
              Non sono del tutto sicuro di cosa sto guardando: controlla prima di salvare.
            </p>
          )}
          <p className="mt-2">{esito.cosa_vedo}</p>
          <button
            type="button"
            onClick={() =>
              navigate("/ricettario/ingredienti/nuovo", { state: { daFoto: esito.scheda } })
            }
            className="tocco-bottone testo-sala mt-3 rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white"
          >
            Apri la scheda di un prodotto nuovo
          </button>
          <Didascalia>
            La scheda si apre già riempita: la controlli e la salvi tu. Finché non salvi non è
            stato scritto niente.
          </Didascalia>
        </div>
      )}

      {/* ⚠️ LA DESTINAZIONE CHE NON C'E' ANCORA si dice, non si nasconde:
          bolle e fatture l'assistente le riconosce, ma il gestionale non
          ha ancora imparato dove metterle. Incastrarle in una scheda di
          prodotto produrrebbe un dato falso che nessun errore segnala. */}
      {esito && esito.esito !== "letta" && (
        <p className="testo-sala mt-4 rounded-lg bg-amber-50 p-4 text-amber-900">
          {esito.messaggio}
        </p>
      )}

      {/* ------------------------------------------------------------- */}
      {/* La spesa del mese                                              */}
      {/* ------------------------------------------------------------- */}
      <section className="mt-8">
        <h2 className="testo-sala-grande mb-2 font-semibold text-b58-charcoal">
          Quanto sta costando
        </h2>

        {spesa === nonLetto ? (
          <DatoNonLetto cosa="la spesa di MEMO" onRiprova={ricarica} />
        ) : spesa === null ? (
          <p className="testo-sala text-b58-charcoal-soft">Sto guardando…</p>
        ) : (
          <div className="rounded-lg bg-b58-parchment p-4 ring-1 ring-b58-charcoal/10">
            <p className="testo-sala-grande font-semibold text-b58-charcoal">
              {formatEUR(spesa.speso_euro)} questo mese
              {spesa.tetto_euro != null && <> su {formatEUR(spesa.tetto_euro)}</>}
            </p>
            <p className="testo-sala mt-1 text-b58-charcoal-soft">
              {spesa.letture} {spesa.letture === 1 ? "foto letta" : "foto lette"}
            </p>

            {/* ⚠️ La frase viene dal database insieme al numero, come per
                le imposte: un avviso che vive nel testo di una schermata
                non protegge la seconda schermata che mostra lo stesso
                numero. */}
            <p
              className={`testo-sala mt-2 rounded-md p-2 ${
                spesa.blocca
                  ? "bg-b58-terracotta/15 text-b58-terracotta-dark"
                  : spesa.avvisa
                    ? "bg-amber-50 text-amber-900"
                    : "text-b58-charcoal-soft"
              }`}
            >
              {spesa.frase}
            </p>

            {spesa.blocca && (
              <button
                type="button"
                onClick={sblocca}
                disabled={salvando}
                className="tocco-bottone testo-sala mt-3 rounded-md bg-b58-terracotta px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                Vai avanti lo stesso per questo mese
              </button>
            )}

            <div className="mt-4 border-t border-b58-charcoal/10 pt-4">
              <label className="testo-sala mb-1 block font-medium uppercase tracking-wide text-b58-charcoal-soft">
                Tetto di spesa al mese
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={tetto}
                  onChange={(e) => setTetto(e.target.value)}
                  placeholder="nessun tetto"
                  className="tocco-bottone testo-sala w-40 rounded-md border border-b58-charcoal/20 px-3 py-2"
                />
                <button
                  type="button"
                  onClick={salvaTetto}
                  disabled={salvando}
                  className="tocco-bottone testo-sala rounded-md bg-b58-charcoal px-4 py-2 font-semibold text-white disabled:opacity-50"
                >
                  Salva
                </button>
              </div>
              {/* ⚠️ IL VUOTO NON E' ZERO, e va detto dove si scrive: un
                  campo vuoto qui vuol dire «non l'ho ancora deciso», e le
                  letture non si fermano mai da sole. Un tetto a zero il
                  database lo rifiuta apposta — per spegnere l'assistente
                  basta non usarlo. */}
              {/* 🔴 CHI L'HA TOCCATO, e quando. Il gestionale lo registrava
                  dal 26/08 e non lo mostrava: per chi usa l'app, un dato
                  scritto che nessuno può vedere è indistinguibile da un
                  dato non scritto.
                  ⚠️ La frase arriva dal database già composta — «l'hai
                  messo tu» oppure «da un altro accesso», perché si entra
                  per ruolo e non per persona (stessa forma del 18/08 sulla
                  correzione dei coperti). E il tetto che non ha un autore
                  LO DICE, invece di lasciare un vuoto che si legge come un
                  guasto. */}
              {chiTetto && chiTetto !== nonLetto && chiTetto.tetto_frase && (
                <p className="testo-sala mt-1 text-b58-charcoal-soft">
                  {chiTetto.tetto_frase}
                  {chiTetto.sblocco_frase && <> · {chiTetto.sblocco_frase}</>}
                </p>
              )}

              <Didascalia>
                Lascialo vuoto se non vuoi nessun limite. Quando la spesa arriva al tetto le foto
                smettono di partire, ma le schede si compilano a mano come sempre.
              </Didascalia>
            </div>

            {errore && (
              <p className="testo-sala mt-2 text-b58-terracotta-dark">{errore}</p>
            )}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------- */}
      {/* Le ultime letture                                              */}
      {/* ------------------------------------------------------------- */}
      {letture === nonLetto ? (
        <div className="mt-6">
          <DatoNonLetto cosa="le ultime letture" onRiprova={ricarica} />
        </div>
      ) : (
        letture?.length > 0 && (
          <section className="mt-6">
            <h2 className="testo-sala-grande mb-2 font-semibold text-b58-charcoal">
              Le ultime foto
            </h2>
            <ul className="space-y-1">
              {letture.map((l) => (
                <li
                  key={l.id}
                  className="tocco-riga flex flex-wrap items-center justify-between gap-2 rounded-md bg-b58-cream-dark/40 px-3"
                >
                  <span className="testo-sala text-b58-charcoal">
                    {/* 🔴 SU COSA, e QUANDO. Prima c'era solo «etichetta —
                        0,02 €»: fra un mese quella riga non dice niente su
                        dove sono finiti i soldi dell'assistente.
                        ⚠️ Il nome sta davanti perché è quello che si cerca
                           scorrendo; il genere resta solo quando il nome
                           non c'è — cioè quando la foto è partita dalla
                           Dashboard, dove un prodotto non c'è ancora. */}
                    {l.ingrediente?.name && (
                      <strong className="font-medium">{l.ingrediente.name} · </strong>
                    )}
                    {l.esito === "letta"
                      ? `${l.riconosciuto}${l.sicuro === false ? " (non sicuro)" : ""}`
                      : l.esito === "tetto"
                        ? "fermata dal tetto di spesa"
                        : l.esito === "destinazione_mancante"
                          ? `${l.riconosciuto}: non so ancora dove metterla`
                          : l.esito === "non_riconosciuta"
                            ? "non riconosciuta"
                            : "non è riuscita"}
                  </span>
                  <span className="testo-sala text-b58-charcoal-soft whitespace-nowrap">
                    {new Date(l.creato_il).toLocaleDateString("it-IT", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    · {formatEUR(l.costo_euro)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </div>
  );
}
