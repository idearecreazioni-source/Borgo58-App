import { useEffect, useState } from "react";
import { inFrazione, inPunti } from "../../lib/calcoli/percentuali";
import { Link } from "react-router-dom";
import {
  aggiornaScadenzaPrevista,
  chiudiScadenzaPrevista,
  createScadenzaPrevista,
  getImpostazioniTesoreria,
  getPosInTransito,
  getPrevisioneCassa,
  getUsciteFuture,
  listMovimentiAttesi,
  listScadenzePreviste,
  riapriScadenzaPrevista,
  salvaImpostazioniTesoreria,
} from "../../lib/api/cash";
import { getEntities } from "../../lib/api/entities";
import { formatDate, formatEUR, oggiLocale, traGiorniLocale } from "../../lib/constants";
import DatoNonLetto from "../../components/DatoNonLetto";
import { leggi, nonLetto } from "../../lib/calcoli/letture";

// «Ce la faccio al 16?» — Blocco 6b del mandato.
//
// La domanda che chiude i ristoranti non è «quanto ho» ma «arrivo alla
// scadenza con i soldi sul conto». Chi guarda solo la cassa crede che
// agosto sia leggerissimo e settembre un disastro; chi guarda solo il
// conto economico sa se guadagna ma non se ce la fa il 16.
//
// ⚠️ Il caricamento dell'estratto conto NON c'è, ed è una decisione di
// Alessio del 15/08: il conto non è ancora aperto e non sappiamo che
// formato esporti l'home banking. Ma la riconciliazione che serve davvero
// funziona già senza: una fattura sparisce dalle uscite attese nel momento
// in cui la si registra pagata.

const ORIZZONTI = [
  { giorni: 7, label: "7 giorni" },
  { giorni: 30, label: "30 giorni" },
  { giorni: 60, label: "60 giorni" },
  { giorni: 90, label: "90 giorni" },
];

// ⚠️ CALENDARIO: una scadenza cade in un giorno, non in una serata.
const formaVuota = { descrizione: "", importo: "", scadeIl: oggiLocale(), ogniMesi: "0", mezzo: "banca" };

export default function Previsione() {
  const [entities, setEntities] = useState(null);
  const [entityId, setEntityId] = useState("");
  const [giorni, setGiorni] = useState(30);
  const [previsione, setPrevisione] = useState(null);
  const [pos, setPos] = useState(null);
  const [attesi, setAttesi] = useState([]);
  const [scadenze, setScadenze] = useState([]);
  // Cosa cade OLTRE l'orizzonte scelto: un elenco tagliato che non dichiara
  // il taglio sembra completo (difetto n. 1 del collaudo, 17/08).
  const [oltre, setOltre] = useState(null);
  const [impostazioni, setImpostazioni] = useState({ giorniAccredito: "", commissione: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(formaVuota);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEntities()
      .then((ent) => {
        setEntities(ent);
        setEntityId(ent.srls.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  const finoAl = () => traGiorniLocale(giorni);

  // ⚠️ `ancheImpostazioni` NASCE FALSO, ed è la parte che conta: i due campi
  // del POS (giorni di accredito, commissione) sono gli unici di questa
  // schermata che si scrivono a mano, e prima OGNI gesto — aggiungere una
  // scadenza, chiudere un'uscita — li rileggeva dal database, portandosi via
  // quello che si stava scrivendo. Sono anche i due che nascono VUOTI in
  // attesa della banca: cioè quelli che verranno scritti per la prima volta
  // proprio qui. Chi aggiunge una chiamata nuova non deve ricordarsi
  // niente — il predefinito è dalla parte che non perde lavoro.
  // Regola generale in `src/lib/calcoli/ricarica.js` (21/08).
  const ricarica = ({ ancheImpostazioni = false } = {}) => {
    if (!entityId) return Promise.resolve();
    return Promise.all([
      getPrevisioneCassa(entityId, finoAl()),
      getPosInTransito(entityId),
      listMovimentiAttesi(entityId, finoAl()),
      listScadenzePreviste(entityId, { includiChiuse: true }),
      getImpostazioniTesoreria(entityId),
      // ⚠️ Con l'orizzonte, per sapere cosa cade OLTRE. Il conto lo fa il
      // database: sottrarre qui «tutte le future meno quelle in elenco»
      // sarebbe un secondo calcolo dello stesso numero.
      leggi(getUsciteFuture(entityId, finoAl())),
    ]).then(([p, t, a, s, imp, uf]) => {
      setPrevisione(p);
      setPos(t);
      setAttesi(a);
      setScadenze(s);
      setOltre(uf);
      if (ancheImpostazioni) {
        setImpostazioni({
          giorniAccredito: imp?.giorni_accredito_pos ?? "",
          // ⚠️ Il database la conserva come frazione (0,015), la schermata
          // la mostra come la dice la banca (1,5). Dal 24/08 la conversione
          // è la stessa della Proiezione: era l'unico fatto del gestionale
          // conservato in due unità diverse in due tabelle.
          commissione: inPunti(imp?.commissione_pos_percento),
        });
      }
    });
  };

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    // Qui sì: si cambia società o orizzonte, e le impostazioni sono di quella società.
    ricarica({ ancheImpostazioni: true })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, giorni]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass =
    "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const salvaPos = async () => {
    try {
      await salvaImpostazioniTesoreria(entityId, {
        ...impostazioni,
        commissione: inFrazione(impostazioni.commissione),
      });
      // E qui: le ha appena salvate lui, quindi il database ha ragione.
      await ricarica({ ancheImpostazioni: true });
    } catch (e) {
      setError(e.message);
    }
  };

  const aggiungiScadenza = async () => {
    if (!form.descrizione.trim() || !form.importo) return;
    setSaving(true);
    setError("");
    try {
      await createScadenzaPrevista({ ...form, entityId });
      setForm({ ...formaVuota, scadeIl: form.scadeIl });
      await ricarica();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const chiudi = async (id) => {
    try {
      await chiudiScadenzaPrevista(id);
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  // ⚠️ Le due vie di ritorno che mancavano (Blocco 5.2 del mandato di
  // correzione). «Non serve più» era una porta a senso unico: la scadenza
  // spariva dall'elenco e l'unico rimedio era ricrearla, perdendo da
  // quanto tempo esisteva e ogni quanti mesi tornava.
  const riapri = async (id) => {
    setError("");
    try {
      await riapriScadenzaPrevista(id);
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  const correggi = async (s, campo, valore) => {
    setError("");
    try {
      await aggiornaScadenzaPrevista(s.id, { [campo]: valore });
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  const negativo = previsione && Number(previsione.saldo_previsto) < 0;

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4 flex-wrap mb-4">
        <Link to="/cassa" className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Cassa, Banca e Prima Nota
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {entities && (
            <select
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-1.5 testo-sala-grande text-b58-charcoal"
            >
              <option value={entities.srls.id}>{entities.srls.name}</option>
              {entities.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
            </select>
          )}
          <select
            value={giorni}
            onChange={(e) => setGiorni(Number(e.target.value))}
            className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-1.5 testo-sala-grande text-b58-charcoal"
          >
            {ORIZZONTI.map((o) => (
              <option key={o.giorni} value={o.giorni}>fra {o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <h1 className="font-display text-2xl text-b58-charcoal mb-1">Ce la faccio?</h1>
      <p className="testo-sala text-b58-charcoal-soft/80 mb-6">
        Sapere se guadagni è una domanda. Sapere se <strong>arrivi alla scadenza con i soldi sul
        conto</strong> è un&apos;altra, e non ha la stessa risposta: un costo di agosto può uscire a
        settembre.
      </p>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {loading ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <>
          {/* ---- La risposta ------------------------------------------ */}
          <div
            className={`rounded-xl p-6 ring-1 mb-6 ${
              negativo ? "bg-b58-terracotta/10 ring-b58-terracotta/40" : "bg-b58-parchment ring-b58-charcoal/10"
            }`}
          >
            <div className="testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1">
              Saldo previsto al {previsione ? formatDate(previsione.fino_al) : "—"}
            </div>
            <div
              className={`text-3xl font-medium mb-3 ${
                negativo ? "text-b58-terracotta-dark" : "text-b58-charcoal"
              }`}
            >
              {previsione ? formatEUR(previsione.saldo_previsto) : "—"}
            </div>

            {previsione && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 testo-sala text-b58-charcoal-soft">
                <span>cassa {formatEUR(previsione.oggi_cassa)}</span>
                <span>+ banca {formatEUR(previsione.oggi_banca)}</span>
                <span>+ carta in arrivo {formatEUR(previsione.pos_in_arrivo)}</span>
                <span className="text-b58-terracotta-dark">
                  − da pagare {formatEUR(previsione.uscite_attese)} ({previsione.quante_uscite})
                </span>
              </div>
            )}

            {negativo && (
              <p className="testo-sala-grande text-b58-terracotta-dark mt-3 font-medium">
                Con quello che deve uscire, a quella data i soldi non bastano.
              </p>
            )}

            {/* ⚠️ L'avvertenza arriva dal database insieme al numero, e qui
                dichiara il buco più grosso: mancano gli stipendi, che sono
                la voce più pesante dell'anno. */}
            <p className="testo-sala text-b58-charcoal-soft mt-3 bg-white/70 rounded-lg px-3 py-2 ring-1 ring-b58-charcoal/10 leading-relaxed">
              {previsione?.avvertenza}
            </p>
          </div>

          {/* ---- Cosa deve uscire ------------------------------------- */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
            <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-1">Cosa deve uscire</h2>
            <p className="testo-sala text-b58-charcoal-soft/70 mb-4">
              Fatture e imposte non le scrivi tu: il gestionale le sa già. Una fattura{" "}
              <strong>sparisce da qui da sola</strong> quando la registri pagata.
            </p>
            {attesi.length === 0 ? (
              <p className="testo-sala-grande text-b58-charcoal-soft/60">
                Niente in scadenza entro quella data.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full testo-sala-grande">
                  <thead>
                    <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                      <th className="py-2 font-medium">Quando</th>
                      <th className="py-2 font-medium">Cosa</th>
                      <th className="py-2 font-medium">Da dove</th>
                      <th className="py-2 pr-6 font-medium text-right">Importo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attesi.map((a, i) => (
                      <tr key={`${a.origine}-${a.riferimento ?? i}`} className="border-b border-b58-charcoal/5 last:border-0">
                        <td className="py-2 text-b58-charcoal-soft whitespace-nowrap">{formatDate(a.quando)}</td>
                        <td className="py-2 text-b58-charcoal">{a.descrizione}</td>
                        <td className="py-2 testo-sala text-b58-charcoal-soft">
                          {a.origine === "fattura" ? "fattura fornitore" : a.origine === "imposta" ? "imposte" : "scritta da te"}
                          {" · "}
                          {a.mezzo}
                        </td>
                        <td className="py-2 pr-6 text-right text-b58-charcoal whitespace-nowrap">
                          {formatEUR(a.importo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ⚠️ IL TAGLIO SI DICHIARA (difetto n. 1 del collaudo, 17/08).
                Un'uscita già registrata che cade oltre l'orizzonte scelto
                era invisibile in tutti e due i posti: fuori dal saldo perché
                non è ancora avvenuta, fuori da qui perché è oltre — e in
                Cassa un messaggio la mandava a cercare proprio qui.
                ⚠️ Non si allunga l'orizzonte da soli: se «fra 30 giorni»
                comprendesse anche il 31° quando lì c'è qualcosa, «30» non
                vorrebbe più dire 30. Si dice cosa resta fuori. */}
            {/* 🔴 Senza questa riga «non l'ho letto» e «non c'è niente oltre
                l'orizzonte» si leggono uguali — e la seconda è una
                rassicurazione su soldi che devono uscire. */}
            {nonLetto(oltre) && (
              <DatoNonLetto
                cosa="cosa cade oltre l'orizzonte che hai scelto"
                className="mt-2"
              />
            )}
            {!nonLetto(oltre) && oltre?.quante_oltre > 0 && (
              <p className="testo-sala text-b58-gold-dark bg-b58-gold/10 rounded-lg px-3 py-2 mt-4">
                Oltre questa data{" "}
                {oltre.quante_oltre === 1
                  ? "c'è un'uscita già registrata"
                  : `ci sono ${oltre.quante_oltre} uscite già registrate`}{" "}
                per <strong>{formatEUR(oltre.totale_oltre)}</strong>: la prima il{" "}
                {formatDate(oltre.prima_oltre)}. Non {oltre.quante_oltre === 1 ? "è" : "sono"} nel
                saldo previsto qui sopra — allunga l&apos;orizzonte per vederl
                {oltre.quante_oltre === 1 ? "a" : "e"}.
              </p>
            )}
          </div>

          {/* ---- Le scadenze che solo lui conosce --------------------- */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
            <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-1">Le tue scadenze fisse</h2>
            <p className="testo-sala text-b58-charcoal-soft/70 mb-4">
              Affitto, rate, utenze: quello che il gestionale non può sapere da solo.{" "}
              <strong>Non scriverci le fatture dei fornitori</strong>: quelle le conta già, e finirebbero
              contate due volte.
            </p>

            {scadenze.length > 0 && (
              <ul className="space-y-1.5 mb-4">
                {scadenze.map((s) => (
                  <li
                    key={s.id}
                    className={`flex items-center justify-between gap-3 testo-sala-grande ${s.chiusa_il ? "opacity-55" : ""}`}
                  >
                    <span className="text-b58-charcoal">
                      {formatDate(s.scade_il)} · {s.descrizione}
                      {s.ogni_mesi > 0 && (
                        <span className="testo-sala text-b58-charcoal-soft">
                          {" "}· ogni {s.ogni_mesi === 1 ? "mese" : `${s.ogni_mesi} mesi`}
                        </span>
                      )}
                      {/* Una scadenza chiusa resta visibile e spenta invece
                          di sparire: è l'unico posto da cui si può dire che
                          la si è chiusa per sbaglio. */}
                      {s.chiusa_il && (
                        <span className="testo-sala text-b58-charcoal-soft">
                          {" "}· tolta il {formatDate(s.chiusa_il)}, non entra nella previsione
                        </span>
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-3">
                      {/* Correggere l'importo senza rifare la scadenza: si
                          salva uscendo dal campo, come le altre note. */}
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={s.importo}
                        onBlur={(e) =>
                          Number(e.target.value) !== Number(s.importo) &&
                          correggi(s, "importo", e.target.value)
                        }
                        className="w-24 rounded border border-b58-charcoal/15 px-2 py-1 testo-sala-grande text-right"
                      />
                      {s.chiusa_il ? (
                        <button
                          onClick={() => riapri(s.id)}
                          className="testo-sala text-b58-olive-dark hover:text-b58-charcoal"
                        >
                          rimettila in elenco
                        </button>
                      ) : (
                        <button
                          onClick={() => chiudi(s.id)}
                          className="testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                        >
                          non serve più
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Cosa</label>
                  <input
                    value={form.descrizione}
                    onChange={(e) => setForm((f) => ({ ...f, descrizione: e.target.value }))}
                    placeholder="es. Affitto"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Importo €</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.importo}
                    onChange={(e) => setForm((f) => ({ ...f, importo: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Scade il</label>
                  <input
                    type="date"
                    value={form.scadeIl}
                    onChange={(e) => setForm((f) => ({ ...f, scadeIl: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className={labelClass}>Si ripete</label>
                  <select
                    value={form.ogniMesi}
                    onChange={(e) => setForm((f) => ({ ...f, ogniMesi: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="0">una volta sola</option>
                    <option value="1">ogni mese</option>
                    <option value="3">ogni 3 mesi</option>
                    <option value="12">ogni anno</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Esce da</label>
                  <select
                    value={form.mezzo}
                    onChange={(e) => setForm((f) => ({ ...f, mezzo: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="banca">banca</option>
                    <option value="cassa">cassa</option>
                  </select>
                </div>
                <button
                  type="button"
                  disabled={saving || !form.descrizione.trim() || !form.importo}
                  onClick={aggiungiScadenza}
                  className="rounded-lg bg-b58-terracotta text-b58-parchment testo-sala-grande px-4 py-2 disabled:opacity-60"
                >
                  {saving ? "Salvo…" : "+ Aggiungi"}
                </button>
              </div>
            </div>
          </div>

          {/* ---- Il POS ------------------------------------------------ */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
            <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-1">Gli incassi con carta</h2>
            <p className="testo-sala text-b58-charcoal-soft/70 mb-4">
              Quello che incassi col POS stasera <strong>non è in banca stasera</strong>: arriva dopo
              qualche giorno e al netto delle commissioni. Senza questa voce il saldo della banca non
              tornerebbe mai.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-b58-charcoal/10">
                <div className="testo-sala uppercase tracking-wide text-b58-charcoal-soft">In arrivo (lordo)</div>
                <div className="testo-sala-titolo text-b58-charcoal">{pos ? formatEUR(pos.lordo) : "—"}</div>
                <div className="testo-sala text-b58-charcoal-soft/70">{pos?.conti ?? 0} conti</div>
              </div>
              <div className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-b58-charcoal/10">
                <div className="testo-sala uppercase tracking-wide text-b58-charcoal-soft">Commissioni</div>
                <div className="testo-sala-titolo text-b58-charcoal">
                  {pos?.commissioni != null ? formatEUR(pos.commissioni) : "—"}
                </div>
              </div>
              <div className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-b58-charcoal/10">
                <div className="testo-sala uppercase tracking-wide text-b58-charcoal-soft">Arriverà</div>
                <div className="testo-sala-titolo text-b58-charcoal">
                  {pos?.netto_atteso != null ? formatEUR(pos.netto_atteso) : "—"}
                </div>
              </div>
            </div>

            <p className="testo-sala text-b58-charcoal-soft bg-white/70 rounded-lg px-3 py-2 ring-1 ring-b58-charcoal/10 mb-4 leading-relaxed">
              {pos?.avvertenza}
            </p>

            <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className={labelClass}>Accredita dopo (giorni)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={impostazioni.giorniAccredito}
                    onChange={(e) => setImpostazioni((i) => ({ ...i, giorniAccredito: e.target.value }))}
                    placeholder="non lo so"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Commissione %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={impostazioni.commissione}
                    onChange={(e) => setImpostazioni((i) => ({ ...i, commissione: e.target.value }))}
                    placeholder="non lo so"
                    className={inputClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={salvaPos}
                  className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal testo-sala-grande px-4 py-2"
                >
                  Salva
                </button>
              </div>
              <p className="testo-sala text-b58-charcoal-soft/70 mt-2">
                Lasciali vuoti finché non te lo dice la banca: <strong>vuoto vuol dire «non lo so»</strong>,
                e il gestionale lo scrive invece di inventare un numero.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
