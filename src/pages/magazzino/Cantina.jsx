import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  apriBottiglia,
  bottiglieAperte,
  chiudiBottiglia,
  inventarioCantina,
} from "../../lib/api/cantina";
import { prodottiPerLaCarta } from "../../lib/api/barItems";
import { formatEUR, formatQta, primoDelMeseLocale, oggiLocale } from "../../lib/constants";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import ElencoAdattivo from "../../components/ElencoAdattivo";
import { unaVoltaSola } from "../../lib/calcoli/voce";

// LA CANTINA — 31/08/2026
//
// Due cose che il magazzino da solo non sa dire, e sono le due che Alessio ha
// chiesto insieme alla mescita al calice:
//   · **quali bottiglie sono aperte** — la giacenza e' un numero, e «0,667
//     bottiglie» in cantina non si vede;
//   · **l'inventario, in bottiglie E in euro** — un valore da solo non dice
//     se manca una bottiglia da cento o dieci da dieci.
//
// ⚠️ APRIRE NON SCARICA NIENTE, e la schermata lo DICE invece di lasciarlo
// sottinteso: scaricano i calici quando si vendono. Senza quella riga, il
// primo che apre una bottiglia e non vede cambiare la giacenza pensa che il
// gestionale si sia rotto.

export default function Cantina() {
  const [aperte, setAperte] = useState([]);
  const [prodotti, setProdotti] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [dal, setDal] = useState(primoDelMeseLocale());
  const [al, setAl] = useState(oggiLocale());
  const [scelto, setScelto] = useState("");
  const [chiude, setChiude] = useState(null);
  const [calici, setCalici] = useState("");
  // 🔴 L'ERRORE PORTA CON SE' DOVE E' SUCCESSO (31/08/2026, visto usando
  //    la schermata): il rifiuto compariva in cima alla pagina mentre il
  //    pulsante che l'aveva causato stava a meta' schermata. E' il difetto
  //    del 17/08, gia' pagato due volte in questo progetto — *un rifiuto
  //    lontano dal gesto e' un rifiuto che non c'e'*, e l'istinto e'
  //    ripremere.
  const [errore, setErrore] = useState(null);
  const [esito, setEsito] = useState("");
  const [inCorso, setInCorso] = useState("");

  // 🔴 UNA VOLTA SOLA, e SINCRONA: fra il tocco e il render passano
  //    millisecondi in cui il pulsante e' ancora acceso, e chi non vede
  //    succedere niente ripreme (regola del 27/08). Qui il doppio tocco
  //    aprirebbe DUE bottiglie — e una bottiglia aperta due volte non si
  //    scopre guardando la giacenza, perche' aprire non scarica niente.
  const guardia = useRef(unaVoltaSola());

  const caricaAperte = () => leggi(bottiglieAperte()).then(setAperte);
  const caricaInventario = () => leggi(inventarioCantina(dal || null, al || null)).then(setInventario);

  useEffect(() => {
    caricaAperte();
    // ⚠️ Solo i prodotti segnati «va in carta»: in magazzino c'e' anche il
    //    vino da cucina, e stapparlo non e' un gesto di sala.
    leggi(prodottiPerLaCarta()).then(setProdotti);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    caricaInventario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dal, al]);

  const apri = async () => {
    if (!scelto) return;
    if (!guardia.current.prendi("apri")) return;
    setErrore(null);
    setEsito("");
    setInCorso("apri");
    try {
      await apriBottiglia(scelto);
      const nome = prodotti.find?.((p) => p.ingredient_id === scelto)?.prodotto ?? "";
      setEsito(`Aperta: ${nome}. La giacenza non cambia — scaricano i calici quando si vendono.`);
      setScelto("");
      await caricaAperte();
    } catch (e) {
      setErrore({ dove: "apri", messaggio: e.message });
    } finally {
      setInCorso("");
      guardia.current.lascia("apri");
    }
  };

  const chiudi = async (b, come) => {
    if (!guardia.current.prendi(b.id)) return;
    setErrore(null);
    setEsito("");
    setInCorso(b.id);
    try {
      const r = await chiudiBottiglia(b.id, come, come === "buttata" ? Number(calici) : null);
      setEsito(
        come === "buttata"
          ? `Buttata: ${r?.prodotto ?? ""}. Scaricati ${formatQta(r?.scaricato ?? 0)} di bottiglia come spreco.`
          : `Finita: ${r?.prodotto ?? ""}. Niente da scaricare — l'hanno già scaricata i calici venduti.`
      );
      setChiude(null);
      setCalici("");
      await caricaAperte();
      await caricaInventario();
    } catch (e) {
      setErrore({ dove: b.id, messaggio: e.message });
    } finally {
      setInCorso("");
      guardia.current.lascia(b.id);
    }
  };

  const totaleUnita = nonLetto(inventario)
    ? 0
    : inventario.reduce((t, r) => t + Number(r.differenza_unita || 0), 0);
  const totaleEuro = nonLetto(inventario)
    ? 0
    : inventario.reduce((t, r) => t + Number(r.differenza_euro || 0), 0);

  return (
    <div className="testo-sala max-w-5xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <Link
          to="/magazzino"
          className="tocco-bottone inline-flex items-center testo-sala text-b58-charcoal-soft hover:text-b58-terracotta"
        >
          ← Magazzino
        </Link>
      </div>
      <h1 className="font-display text-2xl text-b58-charcoal mb-4">Cantina</h1>

      {esito && (
        <p className="testo-sala-grande text-b58-olive-dark bg-b58-olive/10 rounded-lg px-3 py-2 mb-3">
          {esito}
        </p>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STAPPARE                                                       */}
      {/* ------------------------------------------------------------- */}
      <section className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-6">
        <h2 className="font-display text-xl text-b58-charcoal mb-2">Stappa una bottiglia</h2>
        <p className="testo-sala text-b58-charcoal-soft mb-3">
          La giacenza non cambia: scaricano i calici quando si vendono. Qui si
          segna solo che quella bottiglia non è più intera.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={scelto}
            onChange={(e) => setScelto(e.target.value)}
            disabled={nonLetto(prodotti)}
            className="tocco-campo max-w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal"
          >
            {/* ⚠️ Un elenco vuoto NON resta muto: si leggerebbe «non c'è
                niente da stappare», che è falso — i prodotti ci sono,
                nessuno li ha ancora segnati per la carta. */}
            <option value="">
              {nonLetto(prodotti)
                ? "— non ho letto i prodotti —"
                : prodotti.length === 0
                  ? "— nessun prodotto segnato «va in carta» —"
                  : "Quale bottiglia…"}
            </option>
            {(nonLetto(prodotti) ? [] : prodotti).map((p) => (
              <option key={p.ingredient_id} value={p.ingredient_id}>
                {p.prodotto}
                {p.mondo_nome ? ` · ${p.mondo_nome}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!scelto || inCorso === "apri"}
            onClick={apri}
            className="tocco-campo rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-50 transition-colors text-b58-parchment font-medium px-4 py-2 testo-sala-grande"
          >
            {inCorso === "apri" ? "Apro…" : "Stappa"}
          </button>
        </div>
        {errore?.dove === "apri" && (
          <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mt-2">
            {errore.messaggio}
          </p>
        )}
      </section>

      {/* ------------------------------------------------------------- */}
      {/* LE BOTTIGLIE APERTE                                            */}
      {/* ------------------------------------------------------------- */}
      <section className="mb-8">
        <h2 className="font-display text-xl text-b58-charcoal mb-2">
          Bottiglie aperte{" "}
          <span className="testo-sala text-b58-charcoal-soft font-normal">
            ({nonLetto(aperte) ? "?" : aperte.length})
          </span>
        </h2>
        {nonLetto(aperte) ? (
          <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2">
            Non sono riuscito a leggere le bottiglie aperte.{" "}
            <button type="button" onClick={caricaAperte} className="tocco-testo underline">
              Riprova
            </button>
          </p>
        ) : aperte.length === 0 ? (
          <p className="testo-sala-grande text-b58-charcoal-soft">Nessuna bottiglia aperta.</p>
        ) : (
          <ElencoAdattivo
            righe={aperte}
            chiave={(b) => b.id}
            titolo={(b) => b.prodotto}
            intestazioneTitolo="Bottiglia"
            campi={(b) => [
              {
                chiave: "da",
                etichetta: "Aperta da",
                valore: b.da_giorni === 0 ? "oggi" : `${b.da_giorni} giorni`,
                forte: true,
              },
              {
                chiave: "porzioni",
                etichetta: "Calici per bottiglia",
                valore: b.porzioni_totali ? String(b.porzioni_totali) : "",
                // ⚠️ Vuoto non è uno: una bottiglia che si vende solo intera
                //    non ha calici, e scrivere «1» direbbe una cosa falsa.
                vuoto: "si vende solo intera",
              },
            ]}
            aperta={(b) =>
              chiude === b.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="testo-sala text-b58-charcoal-soft">
                    Quanti calici restavano?{" "}
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={calici}
                      onChange={(e) => setCalici(e.target.value)}
                      className="tocco-campo rounded border border-b58-charcoal/15 bg-white px-2 py-1 testo-sala-grande w-24"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={inCorso === b.id}
                    onClick={() => chiudi(b, "buttata")}
                    className="tocco-campo rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-50 text-b58-parchment testo-sala-grande px-3 py-1.5"
                  >
                    {inCorso === b.id ? "Registro…" : "Butta il fondo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChiude(null);
                      setCalici("");
                    }}
                    className="tocco-campo rounded-lg border border-b58-charcoal/15 text-b58-charcoal testo-sala-grande px-3 py-1.5"
                  >
                    Lascia stare
                  </button>
                  {errore?.dove === b.id && (
                    <p className="w-full testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2">
                      {errore.messaggio}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={inCorso === b.id}
                    onClick={() => chiudi(b, "finita")}
                    className="tocco-campo rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark disabled:opacity-50 text-b58-charcoal testo-sala-grande px-3 py-1.5"
                  >
                    È finita
                  </button>
                  {/* ⚠️ «Butto il fondo» chiede QUANTO restava prima di
                      registrare: senza quel numero la perdita non si può
                      contare, e il vino sparirebbe dentro la rettifica del
                      conteggio invece che dentro «l'ho buttato». */}
                  <button
                    type="button"
                    onClick={() => setChiude(b.id)}
                    className="tocco-campo rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark text-b58-charcoal testo-sala-grande px-3 py-1.5"
                  >
                    Butto il fondo…
                  </button>
                  {errore?.dove === b.id && (
                    <p className="w-full testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2">
                      {errore.messaggio}
                    </p>
                  )}
                </div>
              )
            }
          />
        )}
      </section>

      {/* ------------------------------------------------------------- */}
      {/* L'INVENTARIO                                                   */}
      {/* ------------------------------------------------------------- */}
      <section>
        <h2 className="font-display text-xl text-b58-charcoal mb-2">Inventario</h2>
        <p className="testo-sala text-b58-charcoal-soft mb-3">
          Quanto è mancato al conteggio, in bottiglie e in euro. I conteggi si
          fanno dall'Allineamento: qui si rileggono, e niente viene corretto da
          solo.
        </p>
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <label className="testo-sala text-b58-charcoal-soft">
            Dal{" "}
            <input
              type="date"
              value={dal}
              onChange={(e) => setDal(e.target.value)}
              className="tocco-campo rounded border border-b58-charcoal/15 bg-white px-2 py-1 testo-sala-grande"
            />
          </label>
          <label className="testo-sala text-b58-charcoal-soft">
            Al{" "}
            <input
              type="date"
              value={al}
              onChange={(e) => setAl(e.target.value)}
              className="tocco-campo rounded border border-b58-charcoal/15 bg-white px-2 py-1 testo-sala-grande"
            />
          </label>
        </div>

        {nonLetto(inventario) ? (
          <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2">
            Non sono riuscito a leggere l&apos;inventario.{" "}
            <button type="button" onClick={caricaInventario} className="tocco-testo underline">
              Riprova
            </button>
          </p>
        ) : inventario.length === 0 ? (
          <p className="testo-sala-grande text-b58-charcoal-soft">
            Nessuno scostamento in questo periodo.
          </p>
        ) : (
          <>
            {/* 🔴 I DUE NUMERI INSIEME, ed è come l'ha chiesto: un valore da
                solo non dice se manca una bottiglia da cento o dieci da
                dieci, e sono due problemi diversi. */}
            <p className="testo-sala-grande text-b58-charcoal mb-3">
              In tutto:{" "}
              <span className="font-medium">{formatQta(totaleUnita)}</span> unità ·{" "}
              <span className="font-medium">{formatEUR(totaleEuro)}</span>
            </p>
            <ElencoAdattivo
              righe={inventario}
              chiave={(r) => r.ingredient_id}
              titolo={(r) => r.prodotto}
              intestazioneTitolo="Prodotto"
              campi={(r) => [
                { chiave: "mondo", etichetta: "Mondo", valore: r.mondo ?? "" },
                {
                  chiave: "unita",
                  etichetta: "Differenza",
                  valore: formatQta(r.differenza_unita),
                  forte: true,
                },
                {
                  chiave: "euro",
                  etichetta: "In euro",
                  valore: formatEUR(r.differenza_euro),
                  forte: true,
                },
                { chiave: "volte", etichetta: "Conteggi", valore: String(r.quante_volte) },
              ]}
            />
          </>
        )}
      </section>
    </div>
  );
}
