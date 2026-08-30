import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  confermaAzione,
  getAllegatoUrl,
  chiediLetturaAdesso,
  getMaxTentativiLettura,
  lettorePostaFermo,
  listPostaInAttesa,
  rifiutaAzione,
  riprovaLettura,
  scartaPosta,
} from "../../lib/api/posta";
import {
  cosaCeDaLeggere,
  etichettaConferma,
  etichettaRifiuto,
  motivoAzioneBloccata,
  notaDiLettura,
  statoLettura,
} from "../../lib/calcoli/posta";
import { listIngredients } from "../../lib/api/ingredients";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import { variantiIngrediente, variazionePrezzo } from "../../lib/api/assistente";
import { righeListaAperte } from "../../lib/api/shoppingList";
import { sezioniArchivio } from "../../lib/api/documents";
import { listSuppliers } from "../../lib/api/suppliers";
import { getEntities } from "../../lib/api/entities";
import { formatDate, qtaConUnita } from "../../lib/constants";

// La posta arrivata al locale, in attesa di una decisione.
//
// Forma decisa da Alessio il 12/08/2026, dopo aver visto la prima
// versione: non una scheda da compilare — «i campi predefiniti non
// possono adeguarsi a qualunque cosa arrivi» — ma **un elenco di cose da
// fare**, ognuna con il suo Conferma o Rifiuta.
//
// I campi restano modificabili prima di confermare: quello che si
// conferma è la lettura fatta da qualcun altro, e ci si aspetta di doverla
// correggere ogni tanto. Quello che parte è ciò che Alessio vede, non ciò
// che l'assistente aveva scritto.

const sezione = "rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-4";
const campo =
  "tocco-campo w-full min-w-0 rounded-lg border border-b58-charcoal/15 bg-white px-2.5 py-1.5 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const etichetta = "block testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1";

const NOME_TIPO = {
  archivia_documento: "Archivio",
  archivia_testo: "Archivio",
  promemoria: "Agenda",
  promemoria_multipli: "Agenda",
  carico_magazzino: "Magazzino",
  da_fare_a_mano: "Da fare tu",
  nessuna: "Niente",
};

// Quali campi ha senso mostrare per ciascun tipo di azione — e si vedono
// solo premendo «modifica». È il punto della seconda critica di Alessio:
// i campi servono a correggere, non a capire. Quello che si legge è la
// descrizione.
const CAMPI = {
  archivia_documento: ["titolo", "tipo", "controparte", "data", "importo", "scadenza"],
  archivia_testo: ["titolo", "tipo", "controparte", "data", "importo", "scadenza"],
  promemoria: ["titolo", "data", "note"],
  promemoria_multipli: [],
  da_fare_a_mano: ["titolo", "data"],
  nessuna: [],
};

const ETICHETTE = {
  titolo: "Titolo",
  tipo: "Tipo",
  controparte: "Controparte",
  data: "Data",
  importo: "Importo",
  scadenza: "Scadenza",
  note: "Note",
};

const TIPO_CAMPO = { data: "date", scadenza: "date", importo: "number" };

// Le unità e le categorie del Ricettario, per l'ingrediente che nasce da
// una riga di fattura. «altro» è quella del non alimentare (detersivi,
// imballaggi): resta in anagrafica e sotto controllo prezzi, fuori dal
// Ricettario.
const UNITA = ["kg", "l", "pz", "mazzo"];
const CATEGORIE = [
  { v: "verdura", t: "verdura" },
  { v: "frutta", t: "frutta" },
  { v: "carne_rossa", t: "carne rossa" },
  { v: "carne_bianca", t: "carne bianca" },
  { v: "pesce", t: "pesce" },
  { v: "crostacei_molluschi", t: "crostacei e molluschi" },
  { v: "latticini", t: "latticini" },
  { v: "uova", t: "uova" },
  { v: "farine_cereali", t: "farine e cereali" },
  { v: "legumi", t: "legumi" },
  { v: "olio_condimenti", t: "olio e condimenti" },
  { v: "spezie_aromi", t: "spezie e aromi" },
  { v: "secco_dispensa", t: "secco / dispensa" },
  { v: "bevande", t: "bevande" },
  { v: "altro", t: "altro (non alimentare)" },
];

// ---------------------------------------------------------------------
// Il carico da fattura — terza forma, 12/08/2026
// ---------------------------------------------------------------------
// Le prime due erano una tabella: sette righe aperte insieme, sei caselle
// ciascuna. Alessio, guardandola: «è tutto molto confusionario e così non
// va». Aveva ragione, ed era la terza volta che sbagliavo nello stesso
// modo su questo modulo.
//
// LA COSA CHE AVEVO PERSO DI VISTA: per ogni riga la domanda vera è UNA
// — *cos'è questa roba?* Quantità, prezzo, lotto e scadenza il documento
// li ha già detti e l'assistente li ha già letti: mostrarli tutti in
// permanenza è chiedere di ricontrollare ciò che non serve
// ricontrollare.
//
// Quindi: **si vedono solo le righe che il gestionale non sa abbinare**,
// una domanda per riga. Le altre stanno in un riepilogo di due righe.
// Man mano che la memoria delle diciture si riempie, una fattura non
// chiederà quasi più niente.
//
// E LA DOMANDA DI ALESSIO CHE HA SALVATO IL DISEGNO: «in che modo posso
// validare quei dati se non vedo la fattura?». Da sola, l'idea di
// nascondere le righe era pericolosa — si confermerebbero numeri mai
// guardati. Rispondono due cose:
//   1. il documento è a un tocco, qui accanto;
//   2. **la quadratura**: se la somma delle righe lette fa il totale
//      stampato sul documento, allora sono state lette tutte e ai prezzi
//      giusti — senza guardarne nemmeno una. È il modo in cui si
//      controlla una fattura da sempre: non si rileggono le righe, si
//      guarda se torna il totale.
// Se non torna, la riga diventa rossa e dice di aprire il documento: che
// è esattamente il momento in cui serve aprirlo.
function RigheCarico({ par, ingredienti, fornitori, allegati, apriAllegato, cambia }) {
  const righe = par?.righe ?? [];
  const perId = Object.fromEntries((ingredienti ?? []).map((i) => [i.id, i]));

  // Quale riga è aperta. Una alla volta: aprirle tutte è la schermata
  // che Alessio ha già bocciato.
  const [apertaRiga, setApertaRiga] = useState(null);
  const [numeriAperti, setNumeriAperti] = useState(null);
  const [notiAperti, setNotiAperti] = useState(false);
  const [rincari, setRincari] = useState({});
  // Le righe della lista della spesa che questo carico andrà a spegnere,
  // per ingrediente. ⚠️ Si guardano PRIMA di confermare: dopo non è più
  // una correzione, è una riparazione (Alessio, 19/08).
  const [listaPerIngrediente, setListaPerIngrediente] = useState({});

  // Cosa fa ricontrollare i prezzi: solo l'abbinamento, il costo e la
  // conversione. Estratto in una variabile perché un'espressione dentro
  // l'elenco delle dipendenze non è controllabile da nessuno.
  // Cosa fa ricontrollare la lista della spesa: solo quali ingredienti
  // stanno per entrare.
  const chiaveIngredienti = JSON.stringify(righe.map((r) => r.ingrediente_id ?? null));

  const chiavePrezzi = JSON.stringify(
    righe.map((r) => [r.articolo_id, r.ingrediente_id, r.costo_unitario, r.fattore])
  );

  useEffect(() => {
    let vivo = true;
    Promise.all(
      righe.map(async (r, i) => {
        const prezzo = Number(r.costo_unitario) / (Number(r.fattore) || 1);
        if (!Number.isFinite(prezzo) || prezzo <= 0) return null;
        try {
          // Versione già comprata: si può dire se è salita di prezzo.
          if (r.articolo_id) {
            const v = await variazionePrezzo({ articoloId: r.articolo_id, prezzo });
            return v ? [i, { tipo: "rincaro", ...v }] : null;
          }
          // Versione nuova di un ingrediente che si compra già: non è un
          // rincaro — è una scelta. Si mostra cosa si paga di solito, così
          // la si fa sapendo. È la richiesta di Alessio del 12/08.
          if (r.ingrediente_id) {
            const varianti = await variantiIngrediente(r.ingrediente_id);
            const migliore = varianti.filter((v) => v.prezzo > 0)[0];
            if (migliore) return [i, { tipo: "confronto", ...migliore, prezzo_nuovo: prezzo }];
          }
          return null;
        } catch {
          return null; // il prezzo di prima è un di più: non blocca la conferma
        }
      })
    ).then((esiti) => {
      if (vivo) setRincari(Object.fromEntries(esiti.filter(Boolean)));
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiavePrezzi]);

  useEffect(() => {
    let vivo = true;
    const ids = [...new Set(righe.map((r) => r.ingrediente_id).filter(Boolean))];
    Promise.all(
      ids.map(async (id) => {
        try {
          return [id, await righeListaAperte(id)];
        } catch {
          return null; // la lista è un di più: non blocca la conferma
        }
      })
    ).then((esiti) => {
      if (vivo) setListaPerIngrediente(Object.fromEntries(esiti.filter(Boolean)));
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiaveIngredienti]);

  // ⚠️ Una sola chiamata anche quando i campi da toccare sono due: due di
  // fila partono dalla stessa fotografia e la seconda cancella la prima.
  // È successo davvero, e in schermata non succedeva niente.
  const patchRiga = (i, patch) =>
    cambia("righe", righe.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  // In che unità entrerà davvero in magazzino: quella dell'ingrediente
  // scelto, o quella del prodotto nuovo che si sta creando.
  const unitaDi = (r) =>
    perId[r.ingrediente_id]?.unit ?? r.nuovo_ingrediente?.unita ?? "kg";

  // La quadratura. Si somma quello che il documento ha STAMPATO su ogni
  // riga — non un ricalcolo nostro, che verificherebbe solo noi stessi.
  const sommaRighe = righe.reduce((t, r) => t + (Number(r.importo) || 0), 0);
  const imponibile = Number(par?.totale_imponibile) || 0;
  const quadra = imponibile > 0 && Math.abs(sommaRighe - imponibile) < 0.02;
  const misurabile = imponibile > 0 && righe.some((r) => Number(r.importo) > 0);

  const euro = (n) => Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Come si chiamerà davvero in Ricettario: il nome proposto vince sulla
  // dicitura del fornitore, che serve solo a riconoscere la stessa cosa
  // la volta dopo.
  const nomeRiga = (r) =>
    perId[r.ingrediente_id]?.name ?? r.nuovo_ingrediente?.nome ?? r.descrizione;

  // Tre gruppi, e la differenza fra il secondo e il terzo è tutta qui:
  // «lo creo così» non chiede niente — si guarda e si corregge solo se
  // sbagliato; «non so cosa sia» chiede una decisione.
  const fuori = righe.map((r, i) => ({ r, i })).filter(({ r }) => r.ignora || r.salta);
  const dentro = righe.map((r, i) => ({ r, i })).filter(({ r }) => !r.ignora && !r.salta);
  const noti = dentro.filter(({ r }) => r.ingrediente_id);
  const nuovi = dentro.filter(({ r }) => !r.ingrediente_id && r.nuovo_ingrediente?.nome);
  const daDecidere = dentro.filter(({ r }) => !r.ingrediente_id && !r.nuovo_ingrediente?.nome);

  // Il menu «cos'è?»: unico per tutti e tre i gruppi, così la correzione
  // di una riga già decisa e la decisione di una riga nuova sono lo
  // stesso gesto.
  // Le parole di un nome, per capire se due diciture parlano della stessa
  // cosa. «Semola di grano duro rimacinata» e «Semola rimacinata di grano
  // duro» condividono tutto tranne l'ordine — e il gestionale lo sa, ma
  // fino al 12/08/2026 non lo diceva, lasciando ad Alessio il compito di
  // accorgersene da solo in un menu lungo.
  const parole = (s) =>
    new Set(
      String(s ?? "")
        .toLowerCase()
        .replace(/[^a-zà-ù0-9]+/g, " ")
        .split(" ")
        .filter((p) => p.length > 3)
    );

  const somiglianti = (r) => {
    const mie = parole(r.nuovo_ingrediente?.nome ?? r.descrizione);
    if (mie.size === 0) return [];
    return (ingredienti ?? [])
      .map((ing) => {
        const sue = parole(ing.name);
        let comuni = 0;
        for (const p of mie) if (sue.has(p)) comuni++;
        return { ing, comuni, quota: comuni / Math.max(1, Math.min(mie.size, sue.size)) };
      })
      .filter((x) => x.comuni >= 2 && x.quota >= 0.6)
      .sort((a, b) => b.quota - a.quota)
      .slice(0, 2)
      .map((x) => x.ing);
  };

  const menuCosE = (r, i) => (
    <select
      // Mostra la scelta corrente invece di un eterno «— scegli —»:
      // un menu che dice sempre la stessa cosa sembra non servire a niente.
      value={r.nuovo_ingrediente ? "__nuovo__" : (r.ingrediente_id ?? "")}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return;
        if (v === "__nuovo__") {
          patchRiga(i, {
            ingrediente_id: "",
            nuovo_ingrediente: r.nuovo_ingrediente ?? {
              nome: r.descrizione ?? "",
              unita: "kg",
              categoria: "altro",
              alimentare: true,
            },
          });
        } else if (v === "__non_merce__") {
          patchRiga(i, { ignora: true, nuovo_ingrediente: null, ingrediente_id: "" });
          setApertaRiga(null);
        } else if (v === "__salta__") {
          patchRiga(i, { salta: true, nuovo_ingrediente: null, ingrediente_id: "" });
          setApertaRiga(null);
        } else {
          patchRiga(i, { ingrediente_id: v, nuovo_ingrediente: null });
          setApertaRiga(null);
        }
      }}
      className={campo}
    >
      <option value="">— scegli —</option>
      {nonLetto(ingredienti) && (
        <option disabled>— non riesco a leggere il Ricettario —</option>
      )}
      {(nonLetto(ingredienti) ? [] : ingredienti ?? []).map((ing) => (
        <option key={ing.id} value={ing.id}>{ing.name}</option>
      ))}
      <option value="__nuovo__">+ è un prodotto nuovo</option>
      <option value="__non_merce__">non è merce — non chiedermelo più</option>
      <option value="__salta__">salta, solo per stavolta</option>
    </select>
  );

  // Il pannello di correzione di una riga: nome, unità, categoria,
  // conversione, numeri. Si apre solo su richiesta.
  const dettaglioRiga = (r, i) => (
    <div className="px-3 pb-3 space-y-2">
      {/* Se assomiglia a qualcosa che c'è già, lo si dice PRIMA del menu:
          è il momento in cui serve, e risparmia di cercarlo in un elenco
          lungo. Resta una proposta — collegare due prodotti è una
          decisione di Alessio, non del gestionale. */}
      {!r.ingrediente_id &&
        somiglianti(r).map((ing) => (
          <p key={ing.id} className="testo-sala-grande text-b58-charcoal">
            Assomiglia a <strong>{ing.name}</strong> che hai già.{" "}
            <button
              type="button"
              onClick={() => {
                patchRiga(i, { ingrediente_id: ing.id, nuovo_ingrediente: null });
                setApertaRiga(null);
              }}
              className="underline text-b58-terracotta hover:text-b58-terracotta-dark"
            >
              è la stessa cosa
            </button>
          </p>
        ))}

      <label className={etichetta}>Cos'è?</label>
      {menuCosE(r, i)}

      {r.nuovo_ingrediente && (
        <div className="rounded-lg bg-b58-cream-dark/40 p-2 space-y-2">
          <div>
            <label className={etichetta}>Come lo chiami tu</label>
            <input
              value={r.nuovo_ingrediente.nome ?? ""}
              onChange={(e) =>
                patchRiga(i, { nuovo_ingrediente: { ...r.nuovo_ingrediente, nome: e.target.value } })
              }
              className={campo}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={etichetta}>Lo misuri in</label>
              <select
                value={r.nuovo_ingrediente.unita ?? "kg"}
                onChange={(e) =>
                  patchRiga(i, { nuovo_ingrediente: { ...r.nuovo_ingrediente, unita: e.target.value } })
                }
                className={campo}
              >
                {UNITA.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className={etichetta}>Categoria</label>
              <select
                value={r.nuovo_ingrediente.categoria ?? "altro"}
                onChange={(e) => {
                  const c = e.target.value;
                  patchRiga(i, {
                    nuovo_ingrediente: {
                      ...r.nuovo_ingrediente,
                      categoria: c,
                      alimentare: c !== "altro",
                    },
                  });
                }}
                className={campo}
              >
                {CATEGORIE.map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* La conversione, chiesta a parole e solo quando le due unità
          differiscono. Senza, il prezzo al chilo sbaglia di sei volte. */}
      {r.unita_fattura && r.unita_fattura !== unitaDi(r) && (
        <div>
          <label className={etichetta}>
            Un{"'"}unità di «{r.unita_fattura}» quanti {unitaDi(r)} fa?
          </label>
          <input
            type="number"
            step="0.001"
            value={r.fattore ?? ""}
            placeholder="1"
            onChange={(e) => patchRiga(i, { fattore: e.target.value })}
            className={campo}
          />
          {Number(r.fattore) > 0 && Number(r.costo_unitario) > 0 && (
            <p className="testo-sala text-b58-charcoal-soft mt-1">
              Entrano {Number(r.quantita) * Number(r.fattore)} {unitaDi(r)} a{" "}
              {(Number(r.costo_unitario) / Number(r.fattore)).toFixed(2)} € l{"'"}uno.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setNumeriAperti(numeriAperti === i ? null : i)}
        className="tocco-testo testo-sala text-b58-charcoal-soft hover:text-b58-terracotta underline"
      >
        {numeriAperti === i ? "nascondi i numeri" : "correggi i numeri"}
      </button>

      {numeriAperti === i && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className={etichetta}>Quantità</label>
            <input type="number" step="0.01" value={r.quantita ?? ""}
              onChange={(e) => patchRiga(i, { quantita: e.target.value })} className={campo} />
          </div>
          <div>
            <label className={etichetta}>Costo unit.</label>
            <input type="number" step="0.01" value={r.costo_unitario ?? ""}
              onChange={(e) => patchRiga(i, { costo_unitario: e.target.value })} className={campo} />
          </div>
          <div>
            <label className={etichetta}>Scadenza</label>
            <input type="date" value={r.scadenza ?? ""}
              onChange={(e) => patchRiga(i, { scadenza: e.target.value })} className={campo} />
          </div>
          <div>
            <label className={etichetta}>N° lotto</label>
            <input value={r.lotto ?? ""}
              onChange={(e) => patchRiga(i, { lotto: e.target.value })} className={campo} />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* 1. La quadratura, prima di tutto il resto. */}
      {misurabile && (
        <p
          className={`testo-sala-grande rounded-lg px-3 py-2 mb-3 ${
            quadra
              ? "bg-b58-olive/10 text-b58-charcoal"
              : "bg-b58-terracotta/10 text-b58-terracotta-dark"
          }`}
        >
          {quadra ? (
            <>
              <strong>I conti tornano.</strong> {righe.length} righe lette, somma{" "}
              {euro(sommaRighe)} € = imponibile del documento.
              {par?.totale_documento ? ` Totale documento ${euro(par.totale_documento)} €.` : ""}
            </>
          ) : (
            <>
              <strong>I conti non tornano.</strong> Le {righe.length} righe lette fanno{" "}
              {euro(sommaRighe)} €, il documento dice {euro(imponibile)} €. Manca o è sbagliata
              almeno una riga: apri il documento e controlla prima di confermare.
            </>
          )}
        </p>
      )}

      {/* 2. Il documento, a un tocco. */}
      {(allegati ?? []).length > 0 && (
        <p className="testo-sala-grande mb-3">
          <button
            type="button"
            onClick={() => apriAllegato(allegati[0])}
            className="text-b58-terracotta hover:text-b58-terracotta-dark underline"
          >
            Apri il documento ({allegati[0].file_name})
          </button>
        </p>
      )}

      {/* ⚠️ LE RIGHE DELLA LISTA DELLA SPESA CHE QUESTO CARICO SPEGNE.
          Il predefinito — la riga più vecchia ancora aperta — si vede, e lì
          si cambia: è la forma decisa da Alessio il 19/08, la stessa già
          scelta il 17/08 per il mezzo di pagamento. Un predefinito che si
          vede è una comodità; uno che riempie un campo che nessuno guarda è
          la famiglia dei 33 posti silenziosi.
          ⚠️ Il menu compare SOLO dove c'è più di una riga aperta: dove la
          scelta non esiste, un menu con una voce sola è ingombro — e questa
          schermata è già stata bocciata una volta per troppa roba. */}
      {dentro.some(({ r }) => (listaPerIngrediente[r.ingrediente_id] ?? []).length > 0) && (
        <div className="mb-3 rounded-lg bg-white border border-b58-charcoal/10 px-3 py-2">
          <p className="testo-sala-grande text-b58-charcoal mb-1">Sulla lista della spesa:</p>
          <ul className="testo-sala-grande text-b58-charcoal-soft space-y-1">
            {dentro.map(({ r, i }) => {
              const aperte = listaPerIngrediente[r.ingrediente_id] ?? [];
              if (aperte.length === 0) return null;
              const scelta = aperte.find((x) => x.id === r.riga_lista)
                ?? aperte.find((x) => x.predefinita)
                ?? aperte[0];
              return (
                <li key={i}>
                  · <strong className="text-b58-charcoal">{nomeRiga(r)}</strong> va sulla riga
                  {scelta.quantita_richiesta != null && (
                    <> da {qtaConUnita(scelta.quantita_richiesta, scelta.unita)}</>
                  )}{" "}
                  in lista dal {new Date(scelta.in_lista_dal).toLocaleDateString("it-IT")}
                  {aperte.length > 1 && (
                    <select
                      value={r.riga_lista ?? scelta.id}
                      onChange={(e) => patchRiga(i, { riga_lista: e.target.value })}
                      className="ml-2 tocco-campo rounded border border-b58-charcoal/15 bg-white px-1.5 py-0.5 testo-sala"
                    >
                      {aperte.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.quantita_richiesta != null ? `${qtaConUnita(x.quantita_richiesta, x.unita)} · ` : ""}
                          {new Date(x.in_lista_dal).toLocaleDateString("it-IT")}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 3. Quello che il gestionale conosce già: si guarda solo se si vuole. */}
      {noti.length > 0 && (
        <div className="mb-2">
          <button
            type="button"
            onClick={() => setNotiAperti((v) => !v)}
            className="testo-sala-grande text-b58-charcoal hover:text-b58-terracotta text-left"
          >
            <strong>{noti.length}</strong>{" "}
            {noti.length === 1 ? "riga già conosciuta" : "righe già conosciute"} entrano in
            magazzino {notiAperti ? "▾" : "▸"}
          </button>
          {notiAperti && (
            <ul className="testo-sala-grande text-b58-charcoal-soft ml-3 mt-1">
              {noti.map(({ r, i }) => (
                <li key={i}>
                  · {Number(r.quantita) * (Number(r.fattore) || 1)} {unitaDi(r)}{" "}
                  <strong className="text-b58-charcoal">{nomeRiga(r)}</strong>
                  <button
                    type="button"
                    onClick={() => setApertaRiga(apertaRiga === i ? null : i)}
                    className="ml-2 testo-sala underline hover:text-b58-terracotta"
                  >
                    cambia
                  </button>
                  {apertaRiga === i && dettaglioRiga(r, i)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 4. I prodotti nuovi: proposti già pronti. Non chiedono un tocco,
             ma si vedono — perché creare un ingrediente resta un atto che
             lascia il segno nel Ricettario. */}
      {nuovi.length > 0 && (
        <div className="mb-2">
          <p className="testo-sala-grande text-b58-charcoal mb-1">
            {nuovi.length === 1 ? "Un prodotto nuovo, lo creo così:" : `${nuovi.length} prodotti nuovi, li creo così:`}
          </p>
          <ul className="testo-sala-grande text-b58-charcoal-soft space-y-0.5">
            {nuovi.map(({ r, i }) => (
              <li key={i} className="rounded-lg bg-white ring-1 ring-b58-charcoal/10 px-3 py-1.5">
                <strong className="text-b58-charcoal">{r.nuovo_ingrediente.nome}</strong>
                {" — "}
                {Number(r.quantita) * (Number(r.fattore) || 1)} {unitaDi(r)}
                {Number(r.costo_unitario) > 0 &&
                  ` a ${(Number(r.costo_unitario) / (Number(r.fattore) || 1)).toFixed(2)} €`}
                <button
                  type="button"
                  onClick={() => setApertaRiga(apertaRiga === i ? null : i)}
                  className="ml-2 testo-sala underline hover:text-b58-terracotta"
                >
                  {apertaRiga === i ? "chiudi" : "cambia"}
                </button>
                <span className="block testo-sala text-b58-charcoal-soft/70">
                  dalla riga «{r.descrizione}»
                </span>
                {apertaRiga === i && dettaglioRiga(r, i)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 5. Quello che nessuno sa cosa sia: qui serve una decisione. */}
      {daDecidere.length > 0 && (
        <div className="mb-2">
          <p className="testo-sala-grande text-b58-charcoal mb-1">
            {daDecidere.length === 1
              ? "Una riga che non so cos'è:"
              : `${daDecidere.length} righe che non so cosa siano:`}
          </p>
          <div className="space-y-1.5">
            {daDecidere.map(({ r, i }) => (
              <div key={i} className="rounded-lg bg-white ring-1 ring-b58-charcoal/10">
                <button
                  type="button"
                  onClick={() => setApertaRiga(apertaRiga === i ? null : i)}
                  className="w-full text-left px-3 py-2 testo-sala-grande text-b58-charcoal hover:bg-b58-cream-dark/40 rounded-lg"
                >
                  {r.quantita} {r.unita_fattura || ""} <strong>{r.descrizione}</strong>
                  {r.importo ? ` — ${euro(r.importo)} €` : ""}
                </button>
                {apertaRiga === i && dettaglioRiga(r, i)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Cosa resta fuori dal carico. */}
      {fuori.length > 0 && (
        <p className="testo-sala text-b58-charcoal-soft/70 mb-1">
          Fuori dal carico: {fuori.map(({ r }) => r.descrizione).join(", ")}
        </p>
      )}

      {/* 7. Due avvisi diversi, e la differenza è tutta qui:
             · stessa versione più cara = qualcuno ti ha aumentato il prezzo;
             · versione nuova di un ingrediente che compri già = una scelta,
               non un rincaro. Confonderle significa gridare al lupo ogni
               volta che cambi formato, e insegnare a non leggere gli avvisi. */}
      {Object.entries(rincari)
        .filter(([, v]) => v?.tipo === "rincaro" && v.da_segnalare)
        .map(([i, v]) => (
          <p key={i} className="testo-sala-grande text-b58-terracotta-dark mb-1">
            ⚠️ <strong>{nomeRiga(righe[i])}</strong>: prima lo pagavi {v.prezzo_precedente}, ora{" "}
            {(Number(righe[i].costo_unitario) / (Number(righe[i].fattore) || 1)).toFixed(2)} (+
            {v.variazione}%)
            {v.variazione_totale > v.variazione &&
              `, +${v.variazione_totale}% da quando lo compri`}
          </p>
        ))}

      {Object.entries(rincari)
        .filter(([, v]) => v?.tipo === "confronto")
        .map(([i, v]) => {
          const diff = ((v.prezzo_nuovo - v.prezzo) / v.prezzo) * 100;
          if (Math.abs(diff) < 1) return null;
          return (
            <p key={i} className="testo-sala-grande text-b58-charcoal-soft mb-1">
              <strong className="text-b58-charcoal">{nomeRiga(righe[i])}</strong>: è una versione
              nuova. Di solito compri «{v.descrizione}»
              {v.fornitore ? ` da ${v.fornitore}` : ""} a {Number(v.prezzo).toFixed(2)} €; questa
              viene {v.prezzo_nuovo.toFixed(2)} € —{" "}
              <strong className={diff > 0 ? "text-b58-terracotta-dark" : "text-b58-olive"}>
                {diff > 0 ? "+" : ""}
                {diff.toFixed(0)}%
              </strong>
              . Non è un rincaro: è un prodotto diverso, e la scelta è tua.
            </p>
          );
        })}

      {/* 8. Fornitore, temperatura e registro: in fondo, dove si guardano
             una volta sola. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-b58-charcoal/10">
        <div className="col-span-2">
          <label className={etichetta}>Fornitore</label>
          <select
            value={par?.fornitore_id ?? ""}
            onChange={(e) => cambia("fornitore_id", e.target.value)}
            className={campo}
          >
            {/* Non piu' «nessuno»: un carico senza fornitore non entra,
                e l'etichetta dice cosa fare invece di offrire una strada
                che porta a un rifiuto. */}
            <option value="">— scegli il fornitore —</option>
            {nonLetto(fornitori) && (
              <option disabled>— non riesco a leggere i fornitori —</option>
            )}
            {(nonLetto(fornitori) ? [] : fornitori ?? []).map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={etichetta}>Temp. °C</label>
          <input type="number" step="0.1" value={par?.temperatura ?? ""}
            onChange={(e) => cambia("temperatura", e.target.value)} className={campo} />
          {/* 🔴 LA TEMPERATURA ATTESA STA QUI, DOVE C'È IL DUBBIO
              (23/08/2026). È una norma scritta sulla scheda del prodotto —
              non un numero da copiare: quello che si scrive sopra si legge
              col termometro, ed è ciò che il registro HACCP attesta.
              Metterla nel campo sarebbe far firmare ad Alessio una
              misurazione che non ha fatto. */}
          {(() => {
            const attese = [
              ...new Set(
                (par?.righe ?? [])
                  .map((r) => perId[r.ingrediente_id]?.temperatura_attesa)
                  .filter(Boolean)
              ),
            ];
            if (attese.length === 0) return null;
            return (
              <p className="testo-sala text-b58-charcoal-soft mt-1">
                dovrebbe essere {attese.join(" · ")}
              </p>
            );
          })()}
        </div>
        <div className="flex items-end">
          <label className="tocco-campo flex items-center gap-1.5 testo-sala text-b58-charcoal-soft pb-1.5">
            <input type="checkbox" checked={par?.registra_haccp === true}
              onChange={(e) => cambia("registra_haccp", e.target.checked)} />
            registra in HACCP
          </label>
        </div>
      </div>
      {par?.registra_haccp === true && (
        <p className="testo-sala text-b58-terracotta-dark mt-1">
          Scriverà nel registro HACCP una consegna ricevuta <strong>adesso</strong>: accendila solo
          se la merce è appena arrivata.
        </p>
      )}
    </>
  );
}

export default function PostaInArrivo() {
  // Le sezioni dell'archivio, per il menu del campo «tipo» (30/08/2026).
  const [sezioni, setSezioni] = useState([]);
  const [posta, setPosta] = useState([]);
  const [valori, setValori] = useState({});
  const [loading, setLoading] = useState(true);
  // 🔴 L'errore porta con se' DOVE e' successo (28/08/2026).
  // Prima era una stringa sola, mostrata in cima alla pagina: su un elenco
  // di mail, un rifiuto sulla terza compariva fuori dallo schermo e chi
  // non vedeva succedere niente ripremeva. E' lo stesso difetto gia'
  // curato in Cassa il 17/08 — «un rifiuto lontano dal gesto e' un
  // rifiuto che non c'e'» — che qui non era mai stato curato.
  // `dove` vuoto = e' un guasto del caricamento, e li' la cima e' il
  // posto giusto perche' non c'e' nessuna riga a cui attaccarlo.
  const [errore, setErrore] = useState(null);
  const error = errore?.dove ? "" : (errore?.messaggio ?? "");
  const setError = (m) => setErrore(m ? { dove: null, messaggio: m } : null);
  const [inCorso, setInCorso] = useState(null);
  // Servono solo al carico da fattura, ma si caricano una volta sola:
  // aprire «modifica» su una fattura non deve aspettare una query.
  const [ingredienti, setIngredienti] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  // Quale azione ha i campi aperti. Uno alla volta: se si aprissero tutti
  // tornerebbe la schermata che Alessio ha già bocciato due volte.
  const [aperta, setAperta] = useState(null);
  // Quale mail ha il testo aperto. 🔴 Fino al 28/08 il testo della mail
  // arrivava nel browser e non si vedeva da nessuna parte: nessun gesto
  // per leggerlo, e il soggetto non era cliccabile. Misurato quel giorno
  // sul progetto di prova: 18 mail su 18 avevano un testo, e ZERO
  // allegati — cioè l'unica cosa apribile era l'unica che non c'era.
  const [testoAperto, setTestoAperto] = useState(null);
  // Il tetto dei tentativi di lettura: vive in `service_settings` perché
  // lo devono leggere in due (questa schermata e la funzione che legge).
  const [maxTentativi, setMaxTentativi] = useState(null);
  // Se MEMO sta leggendo la posta oppure no: senza saperlo la schermata
  // non puo dire il vero su una mail non ancora letta.
  const [lettore, setLettore] = useState(null);

  const ricarica = () =>
    listPostaInAttesa().then((righe) => {
      setPosta(righe);
      // ⚠️ Le modifiche non ancora confermate SI CONSERVANO. Prima questa
      // riga ricostruiva tutto dal database, e confermare UNA proposta
      // azzerava il lavoro fatto sulle altre della stessa mail.
      //
      // Successo davvero il 12/08/2026: Alessio aveva collegato l'olio e
      // la semola agli ingredienti che aveva già, poi ha confermato
      // l'archiviazione del documento — e i due collegamenti sono spariti
      // in silenzio. Ha confermato il carico convinto di averli fatti, e
      // si è ritrovato due ingredienti doppi in Ricettario.
      //
      // Nessun errore, nessun avviso: solo del lavoro buttato via e un
      // dato sbagliato che sembra giusto. È il difetto peggiore che ci
      // sia, ed era in tre righe di codice.
      setValori((precedenti) =>
        Object.fromEntries(
          righe.flatMap((m) =>
            (m.azioni ?? []).map((a) => [
              a.id,
              precedenti[a.id] ?? { ...(a.parametri ?? {}) },
            ])
          )
        )
      );
    });

  useEffect(() => {
    setLoading(true);
    ricarica()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // Se non ci sono fatture da caricare non servono, e non fanno danno.
    // 🔴 `alimentare: null` VUOL DIRE «TUTTI E DUE», ed è obbligatorio qui.
    //
    // Dal 29/08 `listIngredients()` di suo restituisce **solo gli
    // alimenti**: i materiali di consumo hanno una sezione loro. Ma su una
    // fattura ci sono anche detersivi e carta — questa schermata lo sa già,
    // e infatti creando un prodotto scrive `alimentare: c !== "altro"`.
    // Senza `null`, una riga di detersivo non avrebbe potuto essere
    // abbinata allo sgrassatore che c'è già, e avrebbe fatto nascere un
    // doppione **senza nessun errore**.
    listIngredients({ alimentare: null }).then(setIngredienti).catch((e) => setError(e.message));
    // 🔴 IL DIFETTO n. 11, in due pezzi.
    //
    // `listSuppliers()` era chiamata SENZA la società, mentre ovunque
    // altrove è `listSuppliers(entities.srls.id)`. La chiamata falliva, il
    // `catch` vuoto se la mangiava, e il menu «Fornitore» del carico da
    // fattura era SEMPRE VUOTO — senza che niente lo dicesse.
    //
    // ⚠️ E le conseguenze non finivano nel menu: dentro
    // `carico_con_memoria` un carico senza fornitore intesta gli
    // ingredienti nuovi alla PRIMA ENTITÀ TROVATA — possono finire
    // sull'agricola invece che sulla S.r.l.s., che è il vincolo portante
    // del progetto; la memoria delle diciture finisce in un secchio
    // generico; e lo storico prezzi perde il «da chi», su cui si regge
    // tutta la sorveglianza dei rincari.
    //
    // ⚠️ Il catch muto è la metà peggiore: un errore che nessuno vede è
    // peggio di un errore. Ora l'errore si mostra.
    getEntities()
      .then((ent) => listSuppliers(ent.srls.id))
      .then(setFornitori)
      .catch((e) => setError(e.message));
    // Il tetto dei tentativi. `leggi` marca NON_LETTO invece di ingoiare:
    // se non si riesce a leggerlo la schermata NON indovina — dice che non
    // sa se MEMO riprovera, e offre lo stesso la via d uscita.
    leggi(getMaxTentativiLettura()).then(setMaxTentativi);
    // ⚠️ Senza, il menu delle sezioni resta vuoto e non si puo' archiviare
    //    niente: `leggi` fa in modo che una lettura fallita si denunci
    //    invece di sembrare «non ce ne sono».
    leggi(sezioniArchivio()).then(setSezioni);
    lettorePostaFermo().then(setLettore);
  }, []);

  // NON_LETTO non e un numero: si passa `null`, e statoLettura risponde
  // «non lo so» invece di far finta di saperlo.
  const tettoTentativi = nonLetto(maxTentativi) ? null : maxTentativi;

  const cambia = (azioneId, chiave, valore) =>
    setValori((v) => ({ ...v, [azioneId]: { ...v[azioneId], [chiave]: valore } }));

  const agisci = async (azioneId, fn) => {
    setErrore(null);
    setInCorso(azioneId);
    try {
      await fn();
      await ricarica();
      // ⚠️ Anche l'anagrafica, non solo la posta. Confermare un carico
      // CREA ingredienti: senza questa riga il menu «cos'è?» della riga
      // successiva continua a mostrare la lista di quando la pagina è
      // stata aperta — cioè vuota, se il Ricettario lo era. È successo
      // davvero il 12/08/2026: Alessio ha confermato il primo carico e
      // sulla fattura dopo non trovava i sette ingredienti appena nati.
      // Non sembrava un guasto: sembrava un menu senza niente dentro.
      // 🔴 E se questa lettura fallisce il menu resta vuoto — cioè
      // ESATTAMENTE il difetto che il commento qui sopra racconta, con
      // un'altra causa. Ora non si tace: il menu lo dichiara.
      await Promise.all([
        // `alimentare: null` = alimenti E materiali di consumo: su una
        // fattura ci sono tutti e due. Vedi la nota più sopra.
        leggi(listIngredients({ alimentare: null })).then(setIngredienti),
        leggi(listSuppliers()).then(setFornitori),
      ]);
    } catch (e) {
      // Sulla riga toccata, mai in cima: e' li' che si sta guardando.
      setErrore({ dove: azioneId, messaggio: e.message });
    } finally {
      setInCorso(null);
    }
  };

  const apri = async (allegato) => {
    try {
      window.open(await getAllegatoUrl(allegato.storage_path), "_blank", "noopener");
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <p className="testo-sala-grande text-b58-charcoal-soft">Caricamento…</p>;

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link to="/documenti" className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Archivio Documenti
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-1">Posta in arrivo</h1>
      <p className="testo-sala-grande text-b58-charcoal-soft mb-6">
        Quello che arriva alle caselle del locale. MEMO legge e{" "}
        <strong>propone cosa fare</strong>: decidi tu, una cosa alla volta.
      </p>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {posta.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">Nessuna posta in attesa.</p>
        </div>
      ) : (
        posta.map((m) => {
          const daDecidere = (m.azioni ?? []).filter((a) => a.stato === "proposta");
          return (
            <div key={m.id} className={sezione}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-b58-charcoal font-medium">
                  {m.oggetto || "(senza oggetto)"}
                </span>
                {/* ⚠️ `break-all` MISURATO, non decorativo: un indirizzo di posta lungo
                    non ha spazi dove andare a capo, e alla densita di un mini
                    tablet faceva sbordare la schermata di 107 punti su 390.
                    Si vede solo li: da un monitor la riga ci sta. */}
                <span className="testo-sala-grande text-b58-charcoal-soft break-all">da {m.mittente || "?"}</span>
                <span className="testo-sala-grande text-b58-charcoal-soft">{formatDate(m.ricevuta_il)}</span>
              </div>

              {m.proposta_sintesi && (
                <p className="testo-sala-grande text-b58-charcoal mt-1 mb-3">{m.proposta_sintesi}</p>
              )}

              {/* 🔴 LO STATO DI LETTURA, DETTO COME STA (28/08/2026).
                  Prima questa riga compariva su OGNI mail `da_leggere` e
                  diceva sempre la stessa cosa. Su una mail che il lettore
                  aveva abbandonato dopo tre tentativi era falsa — visto
                  con gli occhi, non dedotto — e sotto ce n'erano altre
                  due: «l'ho letta solo in parte» (non l'aveva letta) e
                  «apri l'allegato» (quella mail non ne aveva). */}
              {statoLettura(m, tettoTentativi, lettore).frase && (
                <div
                  className={
                    ["arresa", "lettore_fermo", "non_so"].includes(
                      statoLettura(m, tettoTentativi, lettore).chiave
                    )
                      ? "testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3"
                      : "testo-sala-grande text-b58-charcoal-soft mb-3"
                  }
                >
                  <p>{statoLettura(m, tettoTentativi, lettore).frase}</p>
                  {/* La via d'uscita. La funzione esisteva nel database dal
                      12/08 e non la chiamava nessuno: l'unico gesto offerto
                      su una mail bloccata era buttarla via. */}
                  {statoLettura(m, tettoTentativi, lettore).puoRiprovare && (
                    <button
                      type="button"
                      disabled={inCorso === m.id}
                      onClick={() => agisci(m.id, () => riprovaLettura(m.id))}
                      className="tocco-bottone mt-2 rounded-lg border border-b58-terracotta/40 hover:bg-b58-terracotta/10 disabled:opacity-50 transition-colors text-b58-terracotta-dark testo-sala-grande px-3 py-1.5"
                    >
                      {inCorso === m.id ? "…" : "Fai riprovare a leggerla"}
                    </button>
                  )}
                  {/* 🔴 IL GESTO CHE MANCAVA su una mail MAI presa in mano.
                      Fino al 28/08 una mail non ancora letta non offriva
                      niente: si poteva solo buttarla via o aspettare una
                      lettura che, su quel gestionale, non sarebbe mai
                      arrivata. Costa — ogni giro chiama il modello — e per
                      questo è un pulsante e non un ritentativo automatico. */}
                  {statoLettura(m, tettoTentativi, lettore).puoLeggereAdesso && (
                    <button
                      type="button"
                      disabled={inCorso === m.id}
                      onClick={() =>
                        agisci(m.id, async () => {
                          await chiediLetturaAdesso();
                          setLettore(await lettorePostaFermo());
                        })
                      }
                      className="tocco-bottone mt-2 rounded-lg border border-b58-terracotta/40 hover:bg-b58-terracotta/10 disabled:opacity-50 transition-colors text-b58-terracotta-dark testo-sala-grande px-3 py-1.5"
                    >
                      {inCorso === m.id ? "…" : "Leggila adesso"}
                    </button>
                  )}
                </div>
              )}

              {(() => {
                const ce = cosaCeDaLeggere(m);
                const nota = notaDiLettura(
                  m,
                  statoLettura(m, tettoTentativi, lettore),
                  ce
                );
                return nota ? (
                  <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3">
                    {nota.frase}
                  </p>
                ) : null;
              })()}

              {/* 🔴 LEGGERE LA MAIL. Il testo arrivava già nel browser — la
                  lettura lo chiede con `*` — e non c'era nessun gesto per
                  vederlo: il soggetto non era cliccabile e l'unica cosa
                  apribile erano gli allegati. Misurato il 28/08 sul
                  progetto di prova: 18 mail su 18 avevano un testo e ZERO
                  avevano allegati, cioè il gesto esisteva solo per la cosa
                  che non c'era mai.
                  ⚠️ E quando non c'è niente da leggere lo si DICE: «non si
                  apre perché non c'è niente» e «non si apre perché il gesto
                  manca» sono due difetti diversi, e un elenco che non dice
                  quale dei due sta capitando è esso stesso il difetto. */}
              {(() => {
                const ce = cosaCeDaLeggere(m);
                if (!ce.haTesto) {
                  return ce.nulla ? (
                    <p className="testo-sala-grande text-b58-charcoal-soft mb-3">
                      Questa mail non ha né testo né allegati da aprire: c&apos;è solo
                      l&apos;oggetto qui sopra.
                    </p>
                  ) : null;
                }
                return (
                  <div className="mb-3">
                    <button
                      type="button"
                      onClick={() => setTestoAperto(testoAperto === m.id ? null : m.id)}
                      className="tocco-bottone testo-sala-grande text-b58-terracotta hover:underline"
                    >
                      {testoAperto === m.id ? "Chiudi la mail" : "Leggi la mail"}
                    </button>
                    {testoAperto === m.id && (
                      // `whitespace-pre-wrap` perché una mail va a capo dove
                      // ha deciso chi l'ha scritta, e `break-words` perché un
                      // link lungo non ha spazi: senza, sborda sul telefono.
                      <p className="testo-sala-grande text-b58-charcoal bg-white/60 ring-1 ring-b58-charcoal/10 rounded-lg px-3 py-2 mt-2 whitespace-pre-wrap break-words">
                        {m.testo}
                      </p>
                    )}
                  </div>
                );
              })()}

              {m.allegati?.length > 0 && (
                <p className="testo-sala-grande text-b58-charcoal-soft mb-3">
                  Allegati:{" "}
                  {m.allegati.map((a, i) => (
                    <span key={a.id}>
                      {i > 0 && ", "}
                      {a.storage_path ? (
                        <button
                          type="button"
                          onClick={() => apri(a)}
                          className="text-b58-terracotta hover:underline"
                        >
                          {a.file_name}
                        </button>
                      ) : (
                        <span
                          className="text-b58-terracotta-dark"
                          title={a.errore || "Non è stato possibile salvarlo"}
                        >
                          {a.file_name} — non salvato
                        </span>
                      )}
                    </span>
                  ))}
                </p>
              )}

              {daDecidere.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg bg-white/60 ring-1 ring-b58-charcoal/10 p-3 mt-3"
                >
                  <div className="flex items-start gap-2 mb-1">
                    <span className="inline-flex items-center rounded-full bg-b58-olive text-b58-parchment testo-sala font-medium px-2.5 py-1 shrink-0 mt-0.5">
                      {NOME_TIPO[a.tipo] ?? a.tipo}
                    </span>
                    <span className="text-b58-charcoal">
                      {a.descrizione || a.titolo}
                    </span>
                  </div>

                  {/* Le date di un documento, in chiaro: sono la cosa che
                      va guardata prima di confermare. */}
                  {valori[a.id]?.scadenze?.length > 0 && (
                    <ul className="testo-sala-grande text-b58-charcoal-soft ml-2 mb-2">
                      {valori[a.id].scadenze.map((s, i) => (
                        <li key={i}>
                          · <strong className="text-b58-charcoal">{formatDate(s.data)}</strong>{" "}
                          {s.titolo}
                          {s.note ? ` — ${s.note}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}

                  {valori[a.id]?.passi?.length > 0 && (
                    <ul className="testo-sala-grande text-b58-charcoal-soft ml-2 mb-2">
                      {valori[a.id].passi.map((s, i) => (
                        <li key={i}>· {s}</li>
                      ))}
                    </ul>
                  )}

                  {a.tipo === "carico_magazzino" && (
                    <RigheCarico
                      par={valori[a.id]}
                      ingredienti={ingredienti}
                      fornitori={fornitori}
                      allegati={m.allegati}
                      apriAllegato={apri}
                      cambia={(chiave, valore) => cambia(a.id, chiave, valore)}
                    />
                  )}

                  {aperta === a.id && CAMPI[a.tipo]?.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 my-3">
                      {CAMPI[a.tipo].map((c) => (
                        <div key={c} className="min-w-0">
                          <label className={etichetta}>{ETICHETTE[c]}</label>
                          {/* 🔴 IL «TIPO» DI UN DOCUMENTO E' UN MENU CHIUSO (30/08).
                              Prima era testo libero, e il modello ne scriveva uno
                              suo: «Fattura», «fattura» e «Fatture» diventavano tre
                              sezioni diverse dell'archivio.
                              ⚠️ E il valore proposto arriva GIA' FILTRATO dalla
                                 funzione online: se il modello ha scritto una
                                 sezione che non esiste, arriva VUOTO — perche' un
                                 menu che riceve un valore fuori elenco mostra la
                                 prima opzione, senza nessun errore (trappola del
                                 27/08). Vuoto, il pulsante si spegne e dice cosa
                                 manca; con la prima opzione, il documento
                                 finirebbe nella sezione sbagliata in silenzio. */}
                          {c === "tipo" ? (
                            <select
                              value={valori[a.id]?.[c] ?? ""}
                              onChange={(e) => cambia(a.id, c, e.target.value)}
                              className={campo}
                            >
                              <option value="">Sezione…</option>
                              {(nonLetto(sezioni) ? [] : sezioni).map((s) => (
                                <option key={s.codice} value={s.codice}>{s.etichetta}</option>
                              ))}
                            </select>
                          ) : (
                          <input
                            type={TIPO_CAMPO[c] ?? "text"}
                            step={c === "importo" ? "0.01" : undefined}
                            value={valori[a.id]?.[c] ?? ""}
                            onChange={(e) => cambia(a.id, c, e.target.value)}
                            className={campo}
                          />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 🔴 IL PULSANTE DICE COSA SUCCEDE A COSA (28/08/2026).
                      Misurato a schermo quel giorno: dei 10 pulsanti della
                      Posta, 5 non nominavano l'oggetto — «Conferma» due
                      volte, «No» due volte, «modifica». Sono quelli che
                      decidono se un documento entra in archivio o se della
                      merce entra in magazzino.
                      ⚠️ E il carico si SPEGNE CON LA RAGIONE invece di
                      restare premibile per essere rifiutato: il rifiuto
                      vero vive nella funzione del database, questa è la
                      stessa regola detta prima. */}
                  {(() => {
                    const bloccato = motivoAzioneBloccata(a, valori[a.id]);
                    return (
                      <>
                        {bloccato && (
                          <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mt-2">
                            {bloccato}
                          </p>
                        )}
                        {/* Il rifiuto del database, DOVE si è premuto. I
                            messaggi in italiano ci sono già (gli 86 rifiuti
                            muti sono stati chiusi il 27/08); quello che
                            mancava era farli arrivare sotto gli occhi. */}
                        {errore?.dove === a.id && (
                          <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mt-2">
                            {errore.messaggio}
                          </p>
                        )}
                        {/* 🔴 SU «NIENTE DA FARE» NON SI CONFERMA NIENTE
                            (31/08/2026, visto aprendo la schermata). Su
                            un'azione di tipo `nessuna` comparivano due
                            pulsanti: **«Conferma "Senza titolo"»** e «Non
                            farlo» — sotto una frase che diceva «Nessuna
                            azione qui».
                            ⚠️ «Senza titolo» non era un difetto di
                            disegno: e' il titolo di ripiego che il
                            gestionale scrive davvero su quelle azioni —
                            misurato sul database, tutte e tre le `nessuna`
                            in attesa lo portano. Il difetto era offrire di
                            confermarlo.
                            ⚠️ E' la famiglia del 27/08 — *un «si'» puo'
                            essere la risposta a una domanda che nessuno ha
                            fatto*: la' il pulsante ricompariva quando
                            mancava un'informazione, qui quando non c'e'
                            niente da fare.
                            ⚠️ Il gesto vero c'era gia' ed e' uno solo:
                            «togli la mail», in fondo alla mail. */}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {a.tipo !== "nessuna" && (
                            <>
                          <button
                            type="button"
                            disabled={inCorso === a.id || !!bloccato}
                            onClick={() => agisci(a.id, () => confermaAzione(a.id, valori[a.id]))}
                            className="tocco-campo rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-50 transition-colors text-b58-parchment font-medium px-3 py-1.5 testo-sala-grande"
                          >
                            {inCorso === a.id ? "…" : etichettaConferma(a, valori[a.id])}
                          </button>
                          <button
                            type="button"
                            disabled={inCorso === a.id}
                            onClick={() => agisci(a.id, () => rifiutaAzione(a.id))}
                            className="tocco-campo rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark disabled:opacity-50 transition-colors text-b58-charcoal testo-sala-grande px-3 py-1.5"
                          >
                            {etichettaRifiuto(a)}
                          </button>
                            </>
                          )}
                          {/* Il carico non ha un «modifica»: le sue righe si
                              aprono una alla volta da sole. */}
                          {CAMPI[a.tipo]?.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setAperta(aperta === a.id ? null : a.id)}
                              className="tocco-testo testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta ml-1"
                            >
                              {aperta === a.id ? "Chiudi i campi" : "Correggi i dati"}
                            </button>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              ))}

              {daDecidere.length === 0 && m.stato === "proposta" && (
                <p className="testo-sala-grande text-b58-charcoal-soft mt-2">
                  Nessuna azione proposta per questa mail.
                </p>
              )}

              <button
                type="button"
                disabled={inCorso === m.id}
                onClick={() => agisci(m.id, () => scartaPosta(m.id))}
                className="tocco-testo testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta mt-3"
              >
                Non serve niente di tutto questo — togli la mail
              </button>
              {/* Anche qui l'esito sta sulla riga toccata: sia lo scarto sia
                  «fai riprovare a leggerla» passano da `agisci(m.id, …)`. */}
              {errore?.dove === m.id && (
                <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mt-2">
                  {errore.messaggio}
                </p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
