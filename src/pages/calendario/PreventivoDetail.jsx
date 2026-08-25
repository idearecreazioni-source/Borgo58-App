import { useEffect, useMemo, useState } from "react";
import Didascalia from "../../components/Didascalia";
import { Link, useParams } from "react-router-dom";
import {
  accettaPreventivo,
  fabbisognoPreventivo,
  getPreventivo,
  inviaPreventivoPerEmail,
  nuovaVersionePreventivo,
  prezzoPreventivo,
  registraFoglioPreventivo,
  salvaPreventivo,
} from "../../lib/api/preventivi";
import { listRecipes } from "../../lib/api/recipes";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import { puoAndareInCarta } from "../../lib/calcoli/carta";
import { formatDate, formatEUR } from "../../lib/constants";

// IL PREVENTIVO — la schermata che commuta (blocco 2 del mandato).
//
// 🔴 UNA SOLA SCHERMATA, non due viste che possono divergere: è il motivo per
// cui Alessio l'ha chiesta così. Gli stessi dati, letti dagli stessi numeri
// del database, mostrati in due modi.
//
// 🔴 IL PASSAGGIO FRA LE DUE VISTE NON È PROTETTO — decisione di Alessio del
// 20/08: *«mi sembra un eccesso di prudenza. Basterà qualcosa di generico che
// mi consenta di switchare da una schermata all'altra»*. Niente conferma,
// niente PIN, niente tenere premuto: un comando semplice.
//
// ⚠️ MA DUE COSE RESTANO, e non sono protezioni — sono il modo in cui il
// comando è fatto:
//   1 · **è NEUTRO a schermo**. Nessuna scritta come «vedi i costi» o «food
//       cost»: questo comando sta sulla schermata che Alessio apre DAVANTI AL
//       CLIENTE, e la parola è visibile anche senza toccarla. Dice quale
//       vista è attiva, non cosa contiene l'altra;
//   2 · **la vista del cliente è quella di PARTENZA, sempre**, anche
//       riaprendo il preventivo di ieri — vedi `useState` più sotto.
const VISTA_CLIENTE = "cliente";
const VISTA_COSTO = "costo";

export default function PreventivoDetail() {
  const { id } = useParams();
  const [prev, setPrev] = useState(null);
  const [prezzo, setPrezzo] = useState(null);
  const [fabbisogno, setFabbisogno] = useState([]);
  const [piatti, setPiatti] = useState([]);
  // 🔴 SI PARTE SEMPRE DALLA VISTA DEL CLIENTE, e non è prudenza: è il
  // valore iniziale giusto. Se la schermata ricordasse l'ultima vista usata,
  // un preventivo riaperto davanti a un ospite si aprirebbe **sui costi**.
  // ⚠️ Quindi qui non c'è nessuna memoria — niente localStorage, niente
  // parametro nell'indirizzo — ed è deliberato, non una dimenticanza.
  const [vista, setVista] = useState(VISTA_CLIENTE);
  const [errore, setErrore] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [inCorso, setInCorso] = useState("");
  const [esito, setEsito] = useState("");

  const carica = async () => {
    setErrore("");
    try {
      const p = await getPreventivo(id);
      setPrev(p);
      const [pr, fb] = await Promise.all([prezzoPreventivo(id), fabbisognoPreventivo(id)]);
      setPrezzo(pr);
      setFabbisogno(fb);
    } catch (e) {
      // ⚠️ Non si disegna un preventivo vuoto quando la lettura è fallita.
      setPrev(null);
      setErrore(e.message);
    }
  };

  useEffect(() => {
    carica();
    // ⚠️ Vuoto si legge «non c'è nessun piatto pronto per la carta»
    // davanti a un cliente, mentre il Ricettario è pieno.
    leggi(listRecipes()).then((r) => setPiatti(nonLetto(r) ? r : r.filter(puoAndareInCarta)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const righeCibo = useMemo(
    () => (prev?.righe ?? []).filter((r) => r.natura === "cibo").sort((a, b) => a.posizione - b.posizione),
    [prev]
  );
  const righeExtra = useMemo(
    () => (prev?.righe ?? []).filter((r) => r.natura === "extra").sort((a, b) => a.posizione - b.posizione),
    [prev]
  );

  const salva = async (patchTestata, righe) => {
    setSalvando(true);
    setErrore("");
    try {
      await salvaPreventivo({
        id,
        testata: {
          entity_id: prev.entity_id,
          cliente_nome: prev.cliente_nome,
          cliente_telefono: prev.cliente_telefono,
          cliente_email: prev.cliente_email,
          data_evento: prev.data_evento,
          ora_evento: prev.ora_evento,
          persone: prev.persone,
          stato: prev.stato,
          prezzo_a_persona_scavalcato: prev.prezzo_a_persona_scavalcato,
          note: prev.note,
          ...patchTestata,
        },
        righe: (righe ?? prev.righe).map((r) => ({
          natura: r.natura,
          recipe_id: r.recipe_id,
          descrizione: r.descrizione,
          porzioni_per_persona: r.porzioni_per_persona,
          quantita: r.quantita,
          prezzo: r.prezzo,
        })),
      });
      await carica();
    } catch (e) {
      setErrore(e.message);
    } finally {
      setSalvando(false);
    }
  };

  // 🔴 I TRE GESTI, e sono tre cose diverse. Nessuno dei tre ne fa un altro.

  // 1 · IL FOGLIO si produce e basta. Fotografa cosa diceva, poi apre la
  //     stampa del browser — da cui Alessio salva il PDF.
  const preparaFoglio = async () => {
    setInCorso("foglio");
    setErrore("");
    setEsito("");
    try {
      await registraFoglioPreventivo(id, "foglio", null);
      window.print();
    } catch (e) {
      setErrore(e.message);
    } finally {
      setInCorso("");
    }
  };

  // 2 · 🔴 LA MAIL PARTE DAVVERO: è l'unico dei tre irreversibile, e per
  //     questo chiede conferma — non per prudenza generica, ma perché dopo
  //     non si torna indietro.
  const mandaLaMail = async () => {
    if (!window.confirm(`Mando il preventivo a ${prev.cliente_email}? Dopo non si può richiamare.`)) return;
    setInCorso("mail");
    setErrore("");
    setEsito("");
    try {
      await inviaPreventivoPerEmail(id);
      setEsito(`Mandato a ${prev.cliente_email}.`);
    } catch (e) {
      setErrore(e.message);
    } finally {
      setInCorso("");
    }
  };

  // 3 · WHATSAPP apre il messaggio: lo manda lui con le sue mani.
  //     ⚠️ Si COPIA SEMPRE PRIMA (lezione del 14/08): la copia riesce
  //     sempre, l'apertura è un di più — e se WhatsApp non è installato non
  //     succede niente, senza nessun errore.
  const apriWhatsApp = async () => {
    setInCorso("whatsapp");
    setErrore("");
    setEsito("");
    try {
      const f = await registraFoglioPreventivo(id, "whatsapp", prev.cliente_telefono);
      const testo = testoWhatsApp(f);
      try {
        await navigator.clipboard.writeText(testo);
      } catch {
        // La copia può essere negata dal browser: non è un guasto.
      }
      const numero = numeroInternazionale(prev.cliente_telefono);
      setEsito(
        numero
          ? "Testo copiato. Se WhatsApp non si apre, incollalo tu."
          : "Testo copiato: di questo cliente non hai il telefono, incollalo dove serve."
      );
      if (numero) {
        window.location.href = `whatsapp://send?phone=${numero}&text=${encodeURIComponent(testo)}`;
      }
    } catch (e) {
      setErrore(e.message);
    } finally {
      setInCorso("");
    }
  };

  // 🔴 L'ACCETTAZIONE — blocco 4. Non è il quarto dei tre gesti del foglio:
  //    quelli mandano un documento, questo mette una cena in calendario e può
  //    chiudere la sala di quella sera. Per questo chiede conferma dicendo
  //    **quando** e **per quante persone**: è irreversibile quanto la mail.
  const accetta = async () => {
    if (
      !window.confirm(
        `Metto in calendario ${prev.persone} persone il ${formatDate(prev.data_evento)}?`
      )
    )
      return;
    setInCorso("accetta");
    setErrore("");
    setEsito("");
    try {
      const r = await accettaPreventivo(id);
      // ⚠️ L'esito porta con sé le avvertenze che arrivano dal database — «era
      // scaduto», «i posti non si sono potuti contare» — invece di riscriverle
      // qui: un avviso separato dal fatto che qualifica si perde alla prima
      // schermata che mostra lo stesso fatto.
      setEsito(
        [
          "L'evento è in calendario.",
          r.sala_piena
            ? `Quella sera la sala risulta piena (${r.prenotati} attesi su ${r.capienza} posti): è segnata come non prenotabile.`
            : r.capienza != null
              ? `Quella sera restano ${r.capienza - r.prenotati} posti su ${r.capienza}.`
              : null,
          ...(r.avvertenze ?? []),
        ]
          .filter(Boolean)
          .join(" ")
      );
      await carica();
    } catch (e) {
      setErrore(e.message);
    } finally {
      setInCorso("");
    }
  };

  if (errore && !prev) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2">{errore}</p>
        <button onClick={carica} className="underline testo-sala mt-2">
          Riprova
        </button>
      </div>
    );
  }
  if (!prev) return <p className="testo-sala-grande text-b58-charcoal-soft">Sto guardando…</p>;

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link
          to="/calendario-eventi/preventivi"
          className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta"
        >
          ← Preventivi
        </Link>
        {/* 🔴 IL COMMUTATORE, e le due parole sono scelte: dicono QUALE
            vista è attiva, non cosa contiene l'altra. Sta su una schermata
            che Alessio apre davanti al cliente, e una scritta come «vedi i
            costi» si legge anche senza toccarla. */}
        <div className="flex items-center gap-1 rounded-full bg-b58-cream-dark p-1">
          <button
            type="button"
            onClick={() => setVista(VISTA_CLIENTE)}
            className={`rounded-full testo-sala px-3 py-1.5 ${
              vista === VISTA_CLIENTE ? "bg-b58-parchment text-b58-charcoal" : "text-b58-charcoal-soft"
            }`}
          >
            Per il cliente
          </button>
          <button
            type="button"
            onClick={() => setVista(VISTA_COSTO)}
            className={`rounded-full testo-sala px-3 py-1.5 ${
              vista === VISTA_COSTO ? "bg-b58-terracotta text-b58-parchment" : "text-b58-charcoal-soft"
            }`}
          >
            Per me
          </button>
        </div>
      </div>

      {errore && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 my-4">
          {errore}
        </p>
      )}

      {/* Intestazione: uguale nelle due viste */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mt-3 mb-6">
        <input
          value={prev.cliente_nome}
          onChange={(e) => setPrev({ ...prev, cliente_nome: e.target.value })}
          onBlur={(e) => salva({ cliente_nome: e.target.value })}
          className="font-display text-2xl text-b58-charcoal bg-transparent border-b border-transparent hover:border-b58-charcoal/20 focus:border-b58-terracotta focus:outline-none w-full"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          <div>
            <label className="block testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1">Data</label>
            <input
              type="date"
              value={prev.data_evento ?? ""}
              onChange={(e) => salva({ data_evento: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            {/* 🔴 Senza l'ora l'evento non si accetta: in sala serve a sapere
                quando arrivano, e inventarla lo metterebbe a un orario che
                nessuno ha detto. Fino al blocco 4 questo campo non esisteva
                da nessuna parte — e il rifiuto sarebbe stato un vicolo cieco. */}
            <label className="block testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1">Ora</label>
            <input
              type="time"
              value={(prev.ora_evento ?? "").slice(0, 5)}
              onChange={(e) => salva({ ora_evento: e.target.value || null })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1">Persone</label>
            <input
              type="number"
              min="1"
              value={prev.persone}
              onChange={(e) => setPrev({ ...prev, persone: e.target.value })}
              onBlur={(e) => salva({ persone: Number(e.target.value) || 1 })}
              className={inputClass}
            />
          </div>
          <div>
            {/* 🔴 Senza questa data il foglio NON si produce: un preventivo
                senza scadenza resta valido per sempre in mano a chi lo
                riceve. Il rifiuto arriva dal database, non da qui. */}
            <label className="block testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1">
              Valido fino al
            </label>
            <input
              type="date"
              value={prev.valido_fino_al ?? ""}
              onChange={(e) => salva({ valido_fino_al: e.target.value || null })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1">Telefono</label>
            <input
              value={prev.cliente_telefono ?? ""}
              onChange={(e) => setPrev({ ...prev, cliente_telefono: e.target.value })}
              onBlur={(e) => salva({ cliente_telefono: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {esito && (
        <p className="print:hidden testo-sala-grande text-b58-charcoal bg-b58-olive/10 rounded-lg px-3 py-2 my-4">
          {esito}
        </p>
      )}

      {vista === VISTA_CLIENTE ? (
        <>
          <VistaCliente prev={prev} prezzo={prezzo} righeCibo={righeCibo} righeExtra={righeExtra} />
          {/* 🔴 TRE GESTI, TRE PULSANTI, e non si somigliano apposta: il
              foglio è una cosa che si produce, la mail è una cosa che parte,
              WhatsApp è una cosa che apri. Mai un tocco che manda tutto. */}
          <div className="print:hidden flex flex-wrap gap-3 mt-6">
            <button
              type="button"
              onClick={preparaFoglio}
              disabled={inCorso !== ""}
              className="rounded-lg border border-b58-charcoal/20 testo-sala-grande px-4 py-2 text-b58-charcoal disabled:opacity-60"
            >
              {inCorso === "foglio" ? "…" : "Prepara il foglio"}
            </button>
            <button
              type="button"
              onClick={apriWhatsApp}
              disabled={inCorso !== ""}
              className="rounded-lg border border-b58-charcoal/20 testo-sala-grande px-4 py-2 text-b58-charcoal disabled:opacity-60"
            >
              {inCorso === "whatsapp" ? "…" : "Apri su WhatsApp"}
            </button>
            <button
              type="button"
              onClick={mandaLaMail}
              disabled={inCorso !== "" || !prev.cliente_email}
              title={prev.cliente_email ? undefined : "Di questo cliente non hai l'email"}
              className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark text-b58-parchment testo-sala-grande px-4 py-2 disabled:opacity-60"
            >
              {inCorso === "mail" ? "…" : "Manda la mail"}
            </button>
          </div>
          <p className="print:hidden testo-sala text-b58-charcoal-soft mt-2">
            Il foglio si salva in PDF dalla finestra di stampa. La mail parte
            davvero; su WhatsApp il messaggio lo mandi tu.
          </p>
        </>
      ) : (
        /* ⚠️ `print:hidden`: il foglio VIAGGIA, e una stampa fatta per
           sbaglio dalla vista dei costi finirebbe nella posta del cliente. */
        <div className="print:hidden">
        <VistaCosto
          prev={prev}
          prezzo={prezzo}
          fabbisogno={fabbisogno}
          righeCibo={righeCibo}
          righeExtra={righeExtra}
          piatti={piatti}
          salvando={salvando}
          salva={salva}
          onVersione={async () => {
            const nuovo = await nuovaVersionePreventivo(id);
            window.location.href = `/calendario-eventi/preventivi/${nuovo}`;
          }}
          onAccetta={accetta}
          accettando={inCorso === "accetta"}
        />
        </div>
      )}
    </div>
  );
}

// ⚠️ Il testo di WhatsApp si compone dallo STESSO foglio del database: se lo
// scrivesse la schermata per conto suo, sarebbe un terzo posto dove può
// finirci dentro un numero di troppo.
function testoWhatsApp(f) {
  const menu = (f.menu ?? []).map((r) => `· ${r.nome}`).join("\n");
  const extra = (f.extra ?? []).map((r) => `· ${r.descrizione}`).join("\n");
  return [
    `Preventivo Borgo 58 — ${formatDate(f.data_evento)}, ${f.persone} persone`,
    "",
    menu,
    extra ? "\nIn più:\n" + extra : "",
    "",
    `${formatEUR(f.prezzo_a_persona)} a persona — totale ${formatEUR(f.totale)}`,
    `Valido fino al ${formatDate(f.valido_fino_al)}`,
  ]
    .filter((r) => r !== "")
    .join("\n");
}

// ⚠️ Lo zero del prefisso NON si toglie: in Italia resta anche
// nell'internazionale (+39 0932…). Toglierlo manderebbe il messaggio a uno
// sconosciuto, in silenzio. È la regola del 14/08 sugli ordini ai fornitori.
function numeroInternazionale(telefono) {
  const cifre = (telefono ?? "").replace(/[^0-9]/g, "");
  if (!cifre) return null;
  if (cifre.startsWith("39") && cifre.length >= 12) return cifre;
  return "39" + cifre;
}

// ---------------------------------------------------------------------
// LA VISTA DEL CLIENTE
// ---------------------------------------------------------------------
// 🔴 Qui NON compare nessun costo, nessuna percentuale e nemmeno la parola
// «food cost»: al cliente si mostra il prezzo, non come è stato costruito.
// La stessa frase che il database restituisce per Alessio — «10,00 € di cibo
// diventano 40,00 €» — qui non si scrive.
function VistaCliente({ prev, prezzo, righeCibo, righeExtra }) {
  const totale = prezzo?.prezzo_a_persona ? Number(prezzo.prezzo_a_persona) * prev.persone : null;
  return (
    <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
      <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">Il menu concordato</h2>
      {righeCibo.length === 0 && righeExtra.length === 0 && (
        <p className="testo-sala-grande text-b58-charcoal-soft">Ancora niente.</p>
      )}
      <ul className="space-y-1 testo-sala-grande">
        {righeCibo.map((r) => (
          <li key={r.id} className="text-b58-charcoal">
            {r.recipe?.name ?? r.descrizione ?? "—"}
          </li>
        ))}
      </ul>
      {righeExtra.length > 0 && (
        <>
          <h3 className="font-display text-b58-charcoal mt-5 mb-2">In più</h3>
          <ul className="space-y-1 testo-sala-grande">
            {righeExtra.map((r) => (
              <li key={r.id} className="flex justify-between text-b58-charcoal">
                <span>
                  {r.descrizione}
                  {Number(r.quantita) !== 1 && (
                    <span className="text-b58-charcoal-soft"> × {Number(r.quantita)}</span>
                  )}
                </span>
                <span>{formatEUR(Number(r.prezzo) * Number(r.quantita))}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="border-t border-b58-charcoal/10 mt-5 pt-4">
        {prezzo?.prezzo_a_persona == null ? (
          // ⚠️ Non si scrive zero: «non c'è ancora un prezzo» e «costa zero»
          // sono due cose diverse.
          <p className="testo-sala-grande text-b58-charcoal-soft">Il prezzo non è ancora stato deciso.</p>
        ) : (
          <div className="flex items-baseline justify-between">
            <span className="text-b58-charcoal-soft testo-sala-grande">A persona</span>
            <span className="text-2xl text-b58-charcoal font-medium">
              {formatEUR(prezzo.prezzo_a_persona)}
            </span>
          </div>
        )}
        {totale != null && (
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-b58-charcoal-soft testo-sala-grande">
              Per {prev.persone} {prev.persone === 1 ? "persona" : "persone"}
            </span>
            <span className="text-b58-charcoal">{formatEUR(totale)}</span>
          </div>
        )}
        {/* 🔴 LA SCADENZA STA SUL FOGLIO, non solo dentro al gestionale:
            serve a poter rinegoziare senza discussioni con chi tiene in mano
            un preventivo di tre mesi fa. ⚠️ La mail e WhatsApp la portavano
            già; qui — cioè sul foglio che si STAMPA — mancava. */}
        {prev.valido_fino_al && (
          <p className="testo-sala text-b58-charcoal-soft mt-4">
            Questo preventivo è valido fino al {formatDate(prev.valido_fino_al)}.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// LA VISTA DI ALESSIO
// ---------------------------------------------------------------------
function VistaCosto({
  prev,
  prezzo,
  fabbisogno,
  righeCibo,
  righeExtra,
  piatti,
  salvando,
  salva,
  onVersione,
  onAccetta,
  accettando,
}) {
  const [nuovoPiatto, setNuovoPiatto] = useState("");
  const [extraNome, setExtraNome] = useState("");
  const [extraPrezzo, setExtraPrezzo] = useState("");

  const cambiaRiga = (rigaId, patch) =>
    salva(null, prev.righe.map((r) => (r.id === rigaId ? { ...r, ...patch } : r)));
  const togliRiga = (rigaId) => salva(null, prev.righe.filter((r) => r.id !== rigaId));

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-1">Quanto mi costa</h2>
        {/* ⚠️ Il numero e il suo limite viaggiano insieme: la frase esce dal
            database, non è scritta qui. */}
        {prezzo?.avvertenza && (
          <p className="testo-sala text-b58-charcoal-soft mb-4">{prezzo.avvertenza}</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 testo-sala-grande">
          <Numero etichetta="Cibo" valore={prezzo?.costo_cibo} />
          <Numero etichetta="Cibo a persona" valore={prezzo?.costo_cibo_a_persona} />
          <Numero etichetta="Extra" valore={prezzo?.extra_totale} />
          <Numero etichetta="Prezzo a persona" valore={prezzo?.prezzo_a_persona} forte />
        </div>

        <div className="mt-4">
          <label className="block testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1">
            Prezzo a persona scritto da te
          </label>
          <input
            type="number"
            step="0.01"
            placeholder={prezzo?.prezzo_a_persona ? String(prezzo.prezzo_a_persona) : "—"}
            defaultValue={prev.prezzo_a_persona_scavalcato ?? ""}
            onBlur={(e) =>
              salva({ prezzo_a_persona_scavalcato: e.target.value === "" ? null : Number(e.target.value) })
            }
            className="w-40 rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande"
          />
          <span className="testo-sala text-b58-charcoal-soft ml-2">
            Lascialo vuoto per usare quello proposto.
          </span>
        </div>
      </div>

      {/* Le righe di cibo, con le porzioni dell'evento */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">Il menu</h2>
        {righeCibo.map((r) => (
          <div key={r.id} className="flex items-center gap-3 py-2 border-b border-b58-charcoal/5 last:border-0">
            <span className="flex-1 testo-sala-grande text-b58-charcoal">{r.recipe?.name ?? "—"}</span>
            {/* ⚠️ Le porzioni valgono SOLO per questo evento: la ricetta in
                carta resta intatta. È scritto qui, dove sta il dubbio. */}
            <input
              type="number"
              step="0.05"
              min="0.05"
              defaultValue={Number(r.porzioni_per_persona)}
              onBlur={(e) => cambiaRiga(r.id, { porzioni_per_persona: Number(e.target.value) || 1 })}
              className="w-20 rounded border border-b58-charcoal/15 px-2 py-1 testo-sala-grande"
            />
            <span className="testo-sala text-b58-charcoal-soft w-28">porzioni a testa</span>
            <button onClick={() => togliRiga(r.id)} className="testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark">
              Togli
            </button>
          </div>
        ))}
        <p className="testo-sala text-b58-charcoal-soft mt-2">
          1 = come in carta. Cambiarlo qui non tocca la ricetta.
        </p>

        <div className="flex gap-2 mt-4">
          <select value={nuovoPiatto} onChange={(e) => setNuovoPiatto(e.target.value)} className="flex-1 rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande">
            <option value="">Aggiungi un piatto…</option>
            {nonLetto(piatti) && (
              <option disabled>— non riesco a leggere il Ricettario —</option>
            )}
            {(nonLetto(piatti) ? [] : piatti).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            disabled={!nuovoPiatto || salvando}
            onClick={() => {
              salva(null, [...prev.righe, { natura: "cibo", recipe_id: nuovoPiatto, porzioni_per_persona: 1 }]);
              setNuovoPiatto("");
            }}
            className="rounded-lg bg-b58-terracotta disabled:opacity-60 text-b58-parchment testo-sala-grande px-4"
          >
            Aggiungi
          </button>
        </div>
      </div>

      {/* Gli extra */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">
          In più
          <Didascalia>
            Personale aggiuntivo, servizi, vini. Il prezzo lo scrivi tu e si somma così
            com&apos;è: qui il gestionale non calcola niente per conto suo.
          </Didascalia>
        </h2>
        {righeExtra.map((r) => (
          <div key={r.id} className="flex items-center gap-3 py-2 border-b border-b58-charcoal/5 last:border-0">
            <span className="flex-1 testo-sala-grande text-b58-charcoal">{r.descrizione}</span>
            <span className="testo-sala-grande text-b58-charcoal-soft">× {Number(r.quantita)}</span>
            <span className="testo-sala-grande text-b58-charcoal">{formatEUR(r.prezzo)}</span>
            <button onClick={() => togliRiga(r.id)} className="testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark">
              Togli
            </button>
          </div>
        ))}
        <div className="flex gap-2 mt-4">
          <input
            value={extraNome}
            onChange={(e) => setExtraNome(e.target.value)}
            placeholder="Cosa"
            className="flex-1 rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande"
          />
          <input
            type="number"
            step="0.01"
            value={extraPrezzo}
            onChange={(e) => setExtraPrezzo(e.target.value)}
            placeholder="€"
            className="w-28 rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande"
          />
          <button
            disabled={!extraNome.trim() || extraPrezzo === "" || salvando}
            onClick={() => {
              salva(null, [
                ...prev.righe,
                { natura: "extra", descrizione: extraNome.trim(), quantita: 1, prezzo: Number(extraPrezzo) },
              ]);
              setExtraNome("");
              setExtraPrezzo("");
            }}
            className="rounded-lg bg-b58-terracotta disabled:opacity-60 text-b58-parchment testo-sala-grande px-4"
          >
            Aggiungi
          </button>
        </div>
      </div>

      {/* Il fabbisogno */}
      {fabbisogno.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
          <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">
            Cosa serve comprare
            <Didascalia>
              Lo stesso conto che il magazzino usa per scaricare quando il piatto viene
              servito, scarto compreso: se la ricetta dice 200 g puliti, qui compaiono i
              grammi che devi comprare per averli.
            </Didascalia>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full testo-sala-grande">
              <tbody>
                {fabbisogno.map((f) => (
                  <tr key={f.ingredient_id} className="border-b border-b58-charcoal/5 last:border-0">
                    <td className="py-1.5 text-b58-charcoal">{f.nome}</td>
                    <td className="py-1.5 text-right text-b58-charcoal-soft">
                      {Number(f.quantita).toFixed(3)} {f.unita}
                    </td>
                    <td className="py-1.5 text-right text-b58-charcoal">{formatEUR(f.costo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🔴 IL GESTO CHE CHIUDE LA TRATTATIVA, e sta in questa vista e non
          nell'altra: dire «accettato» è una decisione di Alessio, non una
          cosa che si fa mentre si mostra il preventivo a un ospite.
          ⚠️ Non si somiglia a «fai una versione nuova»: quello è un ripensamento,
          questo mette una cena in calendario. */}
      <div className="flex flex-wrap items-center gap-4 pt-2">
        {prev.stato === "accettato" ? (
          <Link
            to={`/calendario-eventi/${prev.reservation_id}`}
            className="testo-sala-grande text-b58-charcoal underline hover:text-b58-terracotta"
          >
            L&apos;evento è in calendario →
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAccetta}
            disabled={accettando}
            className="rounded-lg bg-b58-olive hover:bg-b58-olive/90 text-b58-parchment testo-sala-grande px-4 py-2 disabled:opacity-60"
          >
            {accettando ? "…" : "Il cliente ha accettato"}
          </button>
        )}
        <button
          onClick={onVersione}
          className="testo-sala-grande text-b58-charcoal-soft underline hover:text-b58-terracotta"
        >
          Fai una versione nuova
        </button>
      </div>
    </div>
  );
}

function Numero({ etichetta, valore, forte }) {
  return (
    <div>
      <div className="testo-sala uppercase tracking-wide text-b58-charcoal-soft">{etichetta}</div>
      {/* ⚠️ Vuoto, non zero: «non c'è ancora un prezzo» e «costa zero» sono
          due cose diverse. */}
      <div className={forte ? "testo-sala-titolo text-b58-charcoal font-medium" : "text-b58-charcoal"}>
        {valore == null ? "—" : formatEUR(valore)}
      </div>
    </div>
  );
}
