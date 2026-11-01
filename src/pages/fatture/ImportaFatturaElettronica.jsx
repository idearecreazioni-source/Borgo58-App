import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { registraFatturaElettronica } from "../../lib/api/banca";
import { allegaXmlPerFile } from "../../lib/api/fatturaXml";
import { getEntities } from "../../lib/api/entities";
import { formatDate, formatEUR } from "../../lib/constants";
import { eGiaRegistrata, leggiFatturaPA, payloadFattura, xmlDaFile } from "../../lib/calcoli/fatturaPA";
import { unaVoltaSola } from "../../lib/calcoli/voce";
import { eZip, leggiZip } from "../../lib/calcoli/zip";

// LA FATTURA ELETTRONICA DA FILE (24/10/2026). Il file che arriva dallo SDI
// (.xml, o .xml.p7m firmato) si legge qui, si guarda, e si registra con un
// tocco: fornitore, numero, data, importi e scadenza vengono dal file.
//
// ⚠️ Il fornitore si riconosce dalla PARTITA IVA, non dal nome: se c'è già
// si usa quello, altrimenti nasce. Lo decide il database, non la schermata.
// ⚠️ Ciò che non si legge si ferma; ciò che è strano si dice prima della
// conferma. Un importo inventato è peggio di una fattura scritta a mano.

const euro = (c) => formatEUR(c / 100);

export default function ImportaFatturaElettronica() {
  const [letture, setLetture] = useState([]); // [{ chiave, nome, fattura?, errore? }]
  const [entita, setEntita] = useState([]);
  const [entityId, setEntityId] = useState("");
  const [esiti, setEsiti] = useState({}); // chiave → { ok, testo }
  const guardia = useRef(unaVoltaSola());
  const [occupato, setOccupato] = useState(null);
  const [saltati, setSaltati] = useState([]);
  const [tutte, setTutte] = useState(false);
  const [erroriXml, setErroriXml] = useState({}); // chiave → messaggio del salvataggio XML riprovato

  useEffect(() => {
    getEntities().then((ent) => {
      const elenco = [ent.srls, ent.agricola].filter(Boolean);
      setEntita(elenco);
      setEntityId((p) => p || elenco[0]?.id || "");
    });
  }, []);

  const leggi = async (files) => {
    const nuove = [];
    // ⚠️ Uno .zip (lo scarico di più fatture insieme) si apre qui, e ogni
    // file dentro diventa una riga sua. Un file dell'archivio che non è una
    // fattura (i metadati che il portale mette accanto) si conta e si dice,
    // ma non si mostra come un errore: non c'è niente da correggere.
    const saltati = [];
    const singoli = [];
    for (const f of files) {
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        if (eZip(bytes)) {
          for (const d of await leggiZip(bytes)) {
            if (/\.(xml|p7m)$/i.test(d.nome)) singoli.push({ nome: `${f.name} › ${d.nome}`, file: d.nome.split("/").pop(), bytes: d.contenuto, daZip: true });
          }
        } else singoli.push({ nome: f.name, file: f.name, bytes, daZip: false });
      } catch (e) {
        nuove.push({ chiave: f.name, nome: f.name, errore: e.message });
      }
    }
    for (const s of singoli) {
      try {
        const xml = xmlDaFile(s.bytes);
        const { fatture, errori } = leggiFatturaPA(xml);
        if (s.daZip && fatture.length === 0) {
          saltati.push(s.nome);
          continue;
        }
        if (errori.length) nuove.push({ chiave: s.nome, nome: s.nome, errore: errori.join(" ") });
        fatture.forEach((fattura, i) =>
          nuove.push({
            // un file può contenere più fatture (un lotto): ognuna è la sua riga
            chiave: fatture.length > 1 ? `${s.nome}#${i + 1}` : s.nome,
            nome: fatture.length > 1 ? `${s.nome}#${i + 1}` : s.nome,
            // ⚠️ Il nome che si conserva è quello del FILE, non il percorso
            // dentro lo zip: è su quello che il database riconosce una
            // fattura già caricata.
            file: s.file,
            // il testo XML si tiene per collegarlo alla fattura registrata
            xml,
            fattura,
          }),
        );
      } catch (e) {
        if (s.daZip) saltati.push(s.nome);
        else nuove.push({ chiave: s.nome, nome: s.nome, errore: e.message });
      }
    }
    setSaltati(saltati);
    setLetture(nuove);
    setEsiti({});
  };

  const allegaXml = async (l) => {
    const r = await allegaXmlPerFile({ entityId, nomeFile: l.file, xml: l.xml, fattura: l.fattura });
    return r === "gia_presente"
      ? "Il file XML era già collegato a questa fattura."
      : "Il file XML è collegato alla fattura: lo apri da «Fatture fornitori».";
  };

  const registra = async (l) => {
    if (!guardia.current.prendi(l.chiave)) return;
    setOccupato(l.chiave);
    try {
      const r = await registraFatturaElettronica(entityId, payloadFattura(l.fattura, l.file));
      const base = r?.fornitore_nuovo
        ? "Registrata. Il fornitore non c'era: l'ho aggiunto all'anagrafica."
        : "Registrata.";
      let esito;
      try {
        esito = { ok: true, testo: `${base} ${await allegaXml(l)}` };
      } catch (e) {
        // ⚠️ La fattura è registrata: si dice, e si dice anche che il file no.
        esito = {
          ok: true,
          xmlMancante: true,
          testo: `${base} Ma il file XML NON è stato salvato (${e.message}). Premi «Salva il file XML» per riprovare.`,
        };
      }
      setEsiti((p) => ({ ...p, [l.chiave]: esito }));
    } catch (e) {
      setEsiti((p) => ({ ...p, [l.chiave]: { ok: false, testo: e.message } }));
    } finally {
      guardia.current.lascia(l.chiave);
      setOccupato(null);
    }
  };

  // Per una fattura già registrata senza il suo XML (importata prima di
  // questa funzione, o con il salvataggio caduto): si attacca adesso.
  const salvaXml = async (l) => {
    if (!guardia.current.prendi(l.chiave)) return;
    setOccupato(l.chiave);
    setErroriXml((p) => ({ ...p, [l.chiave]: null }));
    try {
      const testo = await allegaXml(l);
      setEsiti((p) => ({ ...p, [l.chiave]: { ok: true, testo: `Era già registrata. ${testo}` } }));
    } catch (e) {
      setErroriXml((p) => ({ ...p, [l.chiave]: `Il file XML non è stato salvato: ${e.message}` }));
    } finally {
      guardia.current.lascia(l.chiave);
      setOccupato(null);
    }
  };

  // ⚠️ In fila, una alla volta: il corridoio crea il fornitore se manca, e
  // due fatture dello stesso fornitore nuovo mandate insieme potrebbero
  // provare a crearlo due volte. Un doppione si ferma nel database e la
  // riga dice perché: le altre proseguono.
  const daRegistrare = letture.filter((l) => !l.errore && l.fattura.errori.length === 0 && !esiti[l.chiave]?.ok && !eGiaRegistrata(esiti[l.chiave]?.testo));
  const registraTutte = async () => {
    setTutte(true);
    try {
      for (const l of daRegistrare) await registra(l);
    } finally {
      setTutte(false);
    }
  };

  const campo =
    "tocco-campo rounded-lg border border-b58-charcoal/15 bg-b58-campo px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link
        to="/fatture-fornitori"
        className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta-testo"
      >
        ← Fatture fornitori
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-4">Fattura elettronica da file</h1>

      <div className="bg-b58-campo rounded-lg border border-b58-charcoal/10 p-3 mb-4 flex flex-wrap gap-3 items-end">
        <label className="flex-1 min-w-[220px]">
          <span className="block testo-sala-grande text-b58-charcoal mb-2">
            I file delle fatture (.xml, .p7m, o uno .zip con dentro più fatture)
          </span>
          <input
            type="file"
            multiple
            accept=".xml,.p7m,.zip,application/xml,text/xml,application/pkcs7-mime,application/zip"
            onChange={(e) => {
              const files = [...e.target.files];
              e.target.value = "";
              if (files.length) leggi(files);
            }}
            className="tocco-campo block w-full max-w-full testo-sala text-b58-charcoal-soft file:mr-3 file:rounded-lg file:border-0 file:bg-b58-azione file:px-4 file:py-2 file:font-medium file:text-b58-sul-colore hover:file:bg-b58-azione-dark"
          />
        </label>
        {entita.length > 1 && (
          <label>
            <span className="block testo-sala text-b58-charcoal-soft mb-1">Di quale società</span>
            <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className={campo}>
              {entita.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {saltati.length > 0 && (
        <p className="testo-sala text-b58-charcoal-soft mb-3">
          {saltati.length === 1 ? "Un file dell'archivio non è una fattura" : `${saltati.length} file dell'archivio non sono fatture`}{" "}
          (di solito i metadati del portale): li ho lasciati stare.
        </p>
      )}

      {daRegistrare.length > 1 && (
        <button
          type="button"
          disabled={tutte || occupato != null || !entityId}
          onClick={registraTutte}
          className="tocco-bottone mb-3 rounded-lg bg-b58-terracotta text-b58-sul-colore testo-sala-grande px-4 py-2 disabled:opacity-60"
        >
          {tutte ? "Sto registrando, una alla volta…" : `Registra tutte (${daRegistrare.length})`}
        </button>
      )}

      <ul className="space-y-3">
        {letture.map((l) => {
          const esito = esiti[l.chiave];
          if (l.errore)
            return (
              <li key={l.chiave} className="rounded-xl ring-1 ring-b58-terracotta/30 bg-b58-terracotta/10 p-3">
                <p className="testo-sala text-b58-charcoal-soft break-all">{l.nome}</p>
                <p className="testo-sala-grande text-b58-terracotta-dark-testo">{l.errore}</p>
              </li>
            );
          const f = l.fattura;
          const bloccata = f.errori.length > 0;
          return (
            <li key={l.chiave} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-3">
              <p className="testo-sala text-b58-charcoal-soft break-all mb-1">{l.nome}</p>
              <p className="testo-sala-grande text-b58-charcoal font-medium">{f.fornitore.denominazione ?? "—"}</p>
              <p className="testo-sala text-b58-charcoal-soft">
                {f.fornitore.partitaIva ? `P.IVA ${f.fornitore.partitaIva}` : `C.F. ${f.fornitore.codiceFiscale ?? "—"}`}
              </p>
              <p className="testo-sala-grande text-b58-charcoal mt-2">
                {f.tipoNome ?? f.tipo} n. {f.numero ?? "—"} del {f.data ? formatDate(f.data) : "—"}
              </p>
              {f.totaleCentesimi != null && (
                <p className="testo-sala-grande text-b58-charcoal">
                  <strong>{euro(f.totaleCentesimi)}</strong>
                  {f.imponibileCentesimi != null && (
                    <span className="testo-sala text-b58-charcoal-soft">
                      {" "}
                      · imponibile {euro(f.imponibileCentesimi)} · IVA {euro(f.impostaCentesimi ?? 0)}
                    </span>
                  )}
                </p>
              )}
              {f.scadenza && (
                <p className="testo-sala text-b58-charcoal">Da pagare entro il {formatDate(f.scadenza)}</p>
              )}
              {f.righe.length > 0 && (
                <ul className="testo-sala text-b58-charcoal-soft mt-2 list-disc pl-5">
                  {f.righe.map((r, i) => (
                    <li key={i} className="break-words">
                      {r.descrizione}
                      {r.prezzoTotale != null && ` — ${formatEUR(r.prezzoTotale)}`}
                    </li>
                  ))}
                </ul>
              )}
              {/* ⚠️ A chi è intestata si legge PRIMA di confermare: se la
                  società non ha ancora la sua partita IVA scritta, il
                  database non può controllarla da sé. */}
              <p className="testo-sala text-b58-charcoal-soft mt-2">
                Intestata a: {f.cliente?.denominazione ?? "—"}
                {f.cliente?.partitaIva && ` (P.IVA ${f.cliente.partitaIva})`}
              </p>
              {f.avvisi.map((a) => (
                <p key={a} className="testo-sala text-b58-charcoal bg-amber-50 border border-amber-300 rounded-lg px-3 py-1.5 mt-2">
                  {a}
                </p>
              ))}
              {f.errori.map((e) => (
                <p key={e} className="testo-sala-grande text-b58-terracotta-dark-testo bg-b58-terracotta/10 rounded-lg px-3 py-1.5 mt-2">
                  {e}
                </p>
              ))}
              {esito ? (
                <p
                  className={`testo-sala-grande mt-3 rounded-lg px-3 py-2 ${
                    esito.ok ? "bg-b58-olive/10 text-b58-olive-dark-testo" : "bg-b58-terracotta/10 text-b58-terracotta-dark-testo"
                  }`}
                >
                  {esito.testo}
                  {esito.ok && (
                    <>
                      {" "}
                      <Link to="/fatture-fornitori" className="underline">
                        Vai alle fatture
                      </Link>
                    </>
                  )}
                </p>
              ) : null}
              {erroriXml[l.chiave] && (
                <p className="testo-sala-grande mt-2 rounded-lg px-3 py-2 bg-b58-terracotta/10 text-b58-terracotta-dark-testo">
                  {erroriXml[l.chiave]}
                </p>
              )}
              {(esito?.xmlMancante || (esito && !esito.ok && eGiaRegistrata(esito.testo))) && (
                <button
                  type="button"
                  disabled={occupato === l.chiave || tutte || !entityId}
                  onClick={() => salvaXml(l)}
                  className="tocco-bottone mt-3 rounded-lg bg-b58-azione text-b58-sul-colore testo-sala-grande px-4 py-2 disabled:opacity-60"
                >
                  {occupato === l.chiave ? "Sto salvando il file…" : "Salva il file XML"}
                </button>
              )}
              {!bloccata && !esito?.ok && !eGiaRegistrata(esito?.testo) && (
                <button
                  type="button"
                  disabled={occupato === l.chiave || tutte || !entityId}
                  onClick={() => registra(l)}
                  className="tocco-bottone mt-3 rounded-lg bg-b58-azione text-b58-sul-colore testo-sala-grande px-4 py-2 disabled:opacity-60"
                >
                  {occupato === l.chiave ? "Sto registrando…" : "Registra la fattura"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
