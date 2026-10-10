import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getEntities } from "../../lib/api/entities";
import {
  cancellaChiusuraAnnuale,
  chiudiAnno,
  listaChiusureAnnuali,
  misureDellAnno,
} from "../../lib/api/proiezione";
import { listContiDaFiscalizzare } from "../../lib/api/cash";
import { formatDate, formatEUR, oggiLocale } from "../../lib/constants";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import DatoNonLetto from "../../components/DatoNonLetto";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";
import Didascalia from "../../components/Didascalia";
import {
  chiusuraConAvviso,
  estremiDellAnno,
  fraseAvviso,
  fraseMesiFotografati,
  fraseRegolarizzazioneSuccessiva,
  serveConferma,
  siPuoChiudere,
  statoChiusura,
} from "../../lib/calcoli/chiusuraAnno";

// =====================================================================
// LA CHIUSURA DELL'ANNO FISCALE — C5, 23/09/2026
// =====================================================================
// ⚠️ LE REGOLE NON STANNO QUI: stanno in `src/lib/calcoli/chiusuraAnno.js`,
//    perche' le prove di questo progetto non guardano una schermata e
//    quello che si puo' provare e' **quale delle cose la schermata dira'**.
//    Qui c'e' il disegno, e chiama quelle.
//
// 🔴 I SOGGETTI SONO DUE, E LA TASCA NON C'E'. Non perche' qualcuno si sia
//    ricordato di escluderla, ma perche' questa schermata **non la nomina**:
//    `getEntities()` restituisce campi con un nome, e qui si nominano solo
//    `srls` e `agricola`. E' la forma «per costruzione» che Alessio ha
//    chiesto al posto di un promemoria — piu' il divieto vero, che sta nel
//    database (un trigger sulla tabella).

function Valore({ v, euro = true }) {
  if (v == null) return <span className="text-b58-charcoal-soft/50">non misurato</span>;
  return <>{euro ? formatEUR(v) : Number(v).toLocaleString("it-IT")}</>;
}

export default function ChiusuraAnnuale() {
  const oggi = new Date(oggiLocale());
  // Si parte dall'anno scorso: e' l'unico che si puo' chiudere davvero, e
  // aprire su un anno che il gestionale rifiutera' fa sembrare rotta la
  // schermata al primo sguardo.
  const [anno, setAnno] = useState(oggi.getFullYear() - 1);
  const [entities, setEntities] = useState(null);
  const [soggetto, setSoggetto] = useState("srls");
  const [misure, setMisure] = useState(null);
  const [storico, setStorico] = useState([]);
  const [senzaDocumento, setSenzaDocumento] = useState([]);
  const [apriElenco, setApriElenco] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [chiudendo, setChiudendo] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setEntities(await getEntities());
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  const ente = entities?.[soggetto];
  const entityId = ente?.id;

  const carica = useCallback(async () => {
    if (!entityId) return;
    const [m, s] = await Promise.all([
      misureDellAnno(entityId, anno),
      listaChiusureAnnuali(entityId),
    ]);
    setMisure(m);
    setStorico(s);
    // ⚠️ L'elenco dei conti e' una lettura ACCESSORIA: se cade, non deve
    //    portarsi via i numeri dell'anno che erano arrivati. Ma non si
    //    trasforma in «non ce n'è nessuno» — quello e' il difetto del
    //    18/08, ed e' qui che morderebbe peggio: una schermata che dice
    //    con calma che non c'e' niente da guardare, prima di una
    //    fotografia che non si rifa'.
    const { dal, al } = estremiDellAnno(anno);
    setSenzaDocumento(await leggi(listContiDaFiscalizzare(entityId, dal, al)));
  }, [entityId, anno]);

  // 🔴 SI ASPETTA CHE I SOGGETTI SIANO ARRIVATI, e non è una rifinitura.
  //    Senza questa riga il primo giro parte con `entityId` ancora vuoto,
  //    `carica()` esce subito e «Sto leggendo…» sparisce su una schermata
  //    dove non c'è ancora niente: per un istante la pagina dichiara di
  //    aver finito e non mostra nulla. *Una schermata che si dichiara
  //    pronta prima di esserlo è la stessa famiglia del dato non letto che
  //    si legge «non c'è niente».*
  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    setApriElenco(false);
    carica()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [carica, entityId]);

  const giaChiusa = storico.some((r) => Number(r.anno) === Number(anno));
  const stato = statoChiusura(misure, giaChiusa);
  const quanti = Number(misure?.conti_senza_documento ?? 0);

  const chiudi = async (conferma) => {
    setChiudendo(true);
    setError("");
    try {
      await chiudiAnno(entityId, anno, conferma);
      await carica();
    } catch (e) {
      setError(e.message);
    } finally {
      setChiudendo(false);
    }
  };

  const cancella = async (id) => {
    setError("");
    try {
      await cancellaChiusuraAnnuale(id);
      await carica();
    } catch (e) {
      setError(e.message);
    }
  };

  const inputClass =
    "tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <Link
        to="/fiscale"
        className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta"
      >
        ← Proiezione fiscale
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-4">Chiudere l'anno</h1>

      {error && (
        <p
          data-prova="errore"
          className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2 items-end mb-6">
        <div>
          <label className="block testo-sala text-b58-charcoal-soft mb-1">Soggetto</label>
          <select
            data-prova="soggetto"
            value={soggetto}
            onChange={(e) => setSoggetto(e.target.value)}
            className={inputClass}
          >
            <option value="srls">{entities?.srls?.name ?? "Borgo 58"}</option>
            <option value="agricola">{entities?.agricola?.name ?? "Azienda agricola"}</option>
          </select>
        </div>
        <div>
          <label className="block testo-sala text-b58-charcoal-soft mb-1">Anno</label>
          <input
            data-prova="anno"
            type="number"
            value={anno}
            onChange={(e) => setAnno(Number(e.target.value))}
            className={`${inputClass} w-28`}
          />
        </div>
      </div>

      {loading && <p className="testo-sala-grande text-b58-charcoal-soft">Sto leggendo…</p>}

      {!loading && misure && (
        <section className="rounded-xl bg-b58-parchment p-5 ring-1 ring-b58-charcoal/10 mb-6">
          <h2 className="font-display testo-sala-grande text-b58-charcoal mb-1">
            Il {anno} di {ente?.name ?? "questo soggetto"}
          </h2>
          <Didascalia>{fraseMesiFotografati(misure.mesi_fotografati)}</Didascalia>

          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
            <div>
              <dt className="testo-sala text-b58-charcoal-soft">Coperti</dt>
              <dd data-prova="coperti" className="testo-sala-grande text-b58-charcoal">
                <Valore v={misure.coperti} euro={false} />
              </dd>
            </div>
            <div>
              <dt className="testo-sala text-b58-charcoal-soft">Ricavi incassati</dt>
              <dd data-prova="ricavi" className="testo-sala-grande text-b58-charcoal">
                <Valore v={misure.ricavi} />
              </dd>
            </div>
            <div>
              <dt className="testo-sala text-b58-charcoal-soft">Food cost</dt>
              <dd className="testo-sala-grande text-b58-charcoal">
                <Valore v={misure.food_cost} />
              </dd>
            </div>
            <div>
              <dt className="testo-sala text-b58-charcoal-soft">Costi fissi</dt>
              <dd className="testo-sala-grande text-b58-charcoal">
                <Valore v={misure.fissi} />
              </dd>
            </div>
            <div>
              <dt className="testo-sala text-b58-charcoal-soft">Conti chiusi</dt>
              <dd className="testo-sala-grande text-b58-charcoal">
                <Valore v={misure.conti_chiusi} euro={false} />
              </dd>
            </div>
            <div>
              <dt className="testo-sala text-b58-charcoal-soft">Omaggi</dt>
              <dd className="testo-sala-grande text-b58-charcoal">
                <Valore v={misure.omaggi_costo} />
              </dd>
            </div>
          </dl>

          {/* 🔴 L'AVVISO. Sta SOPRA il pulsante, cioè dentro il gesto: una
              riga in cima alla pagina la si legge il primo giorno e poi
              diventa arredamento (regola del 18/08). */}
          {quanti > 0 && (
            <div
              data-prova="avviso-senza-documento"
              className="mt-5 rounded-lg bg-b58-terracotta/10 ring-1 ring-b58-terracotta/30 p-4"
            >
              <p className="testo-sala-grande text-b58-terracotta-dark font-medium">
                {fraseAvviso(quanti, misure.incasso_senza_documento)}
              </p>
              <p data-prova="quesito-aperto" className="testo-sala text-b58-charcoal-soft mt-2">
                {fraseRegolarizzazioneSuccessiva(quanti)}
              </p>

              {nonLetto(senzaDocumento) ? (
                <DatoNonLetto
                  className="mt-3"
                  cosa="l'elenco dei conti senza documento"
                  nonVuolDire="che non ce ne siano"
                  onRiprova={carica}
                />
              ) : (
                <>
                  <button
                    type="button"
                    data-prova="apri-elenco"
                    onClick={() => setApriElenco((v) => !v)}
                    className="tocco-bottone testo-sala-grande text-b58-terracotta-dark underline mt-3"
                  >
                    {apriElenco ? "Nascondi l'elenco" : `Guarda quali sono (${senzaDocumento.length})`}
                  </button>
                  {apriElenco && (
                    <ul data-prova="elenco-senza-documento" className="mt-3 space-y-1">
                      {senzaDocumento.map((c) => (
                        <li key={c.order_id} className="testo-sala text-b58-charcoal">
                          {formatDate(c.chiuso_il)} · {c.tavolo} · {formatEUR(c.incasso)} ·{" "}
                          <span className="text-b58-charcoal-soft">{c.stato}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          <div className="mt-5">
            {stato === "anno_non_finito" && (
              <p data-prova="non-finito" className="testo-sala-grande text-b58-charcoal-soft">
                Il {anno} non è ancora finito: si chiude ad anno passato, e la fotografia non si
                rifà.
              </p>
            )}

            {stato === "gia_chiuso" && (
              <p data-prova="gia-chiuso" className="testo-sala-grande text-b58-charcoal-soft">
                Il {anno} è già chiuso per questo soggetto. Lo trovi qui sotto: se è sbagliato si
                cancella e si richiude.
              </p>
            )}

            {siPuoChiudere(misure, giaChiusa) &&
              (serveConferma(misure, giaChiusa) ? (
                // ⚠️ LA CONFERMA E' SUL POSTO, non in una finestra che copre
                //    quello che si stava guardando — cioè proprio l'elenco
                //    dei conti che si sta per lasciare indietro.
                <ConfermaDistruttiva
                  etichetta={`Chiudi il ${anno}`}
                  domanda={`Chiudo il ${anno} lasciando indietro ${
                    quanti === 1 ? "1 conto" : `${quanti} conti`
                  } senza documento?`}
                  etichettaConferma="Sì, li ho visti: chiudi"
                  disabilitato={chiudendo}
                  onConferma={() => chiudi(true)}
                  attributi={{ "data-prova": "chiudi-con-avviso" }}
                  className="rounded-lg bg-b58-terracotta text-b58-parchment px-4 py-2 testo-sala-grande"
                />
              ) : (
                <button
                  type="button"
                  data-prova="chiudi-pulita"
                  disabled={chiudendo}
                  onClick={() => chiudi(false)}
                  className="tocco-azione rounded-lg bg-b58-olive hover:bg-b58-olive-dark transition-colors text-b58-parchment testo-sala-grande font-semibold px-6 disabled:opacity-60"
                >
                  {chiudendo ? "Chiudo…" : `Chiudi il ${anno}`}
                </button>
              ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display testo-sala-grande text-b58-charcoal mb-2">Gli anni chiusi</h2>
        {storico.length === 0 ? (
          <p className="testo-sala-grande text-b58-charcoal-soft">
            Nessun anno chiuso per questo soggetto.
          </p>
        ) : (
          <ul data-prova="storico" className="space-y-2">
            {storico.map((r) => (
              <li
                key={r.id}
                className="rounded-lg bg-b58-parchment p-4 ring-1 ring-b58-charcoal/10"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display testo-sala-grande text-b58-charcoal">{r.anno}</span>
                  <span className="testo-sala text-b58-charcoal-soft">
                    chiuso il {formatDate(r.chiusa_il)}
                  </span>
                  {Number(r.chiusure_precedenti) > 0 && (
                    <span data-prova="rifatto" className="testo-sala text-b58-terracotta-dark">
                      rifatto — era già stato chiuso {r.chiusure_precedenti}{" "}
                      {Number(r.chiusure_precedenti) === 1 ? "volta" : "volte"}
                      {r.prima_chiusura_il ? `, la prima il ${formatDate(r.prima_chiusura_il)}` : ""}
                    </span>
                  )}
                </div>
                <p className="testo-sala text-b58-charcoal-soft mt-1">
                  Ricavi <Valore v={r.ricavi} /> · coperti <Valore v={r.coperti} euro={false} /> ·
                  food cost <Valore v={r.food_cost} /> · fissi <Valore v={r.fissi} />
                </p>

                {chiusuraConAvviso(r) ? (
                  <p
                    data-prova="storico-con-avviso"
                    className="testo-sala text-b58-terracotta-dark mt-2"
                  >
                    {fraseAvviso(r.conti_senza_documento, r.incasso_senza_documento)}{" "}
                    {fraseRegolarizzazioneSuccessiva(r.conti_senza_documento)}
                  </p>
                ) : (
                  <p data-prova="storico-pulita" className="testo-sala text-b58-olive-dark mt-2">
                    Nessun conto senza documento.
                  </p>
                )}

                <div className="mt-2">
                  <ConfermaDistruttiva
                    etichetta="Cancella questa chiusura"
                    cosaSparisce={`la chiusura del ${r.anno}`}
                    etichettaConferma="Sì, cancella"
                    onConferma={() => cancella(r.id)}
                    attributi={{ "data-prova": `cancella-${r.anno}` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
