import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  confermaAzione,
  getAllegatoUrl,
  chiediLetturaAdesso,
  getMaxTentativiLettura,
  lettorePostaFermo,
  listPostaInAttesa,
  listPostaSistemata,
  registraFatturaDallaPosta,
  rifiutaAzione,
  rimettiPosta,
  riprovaLettura,
  scartaPosta,
  SISTEMATE_MAX,
} from "../../lib/api/posta";
import {
  BOLLINO_POSTA,
  CAMPI_AZIONE,
  allegatiDaMostrare,
  cosaCeDaLeggere,
  etichettaConferma,
  etichettaRifiuto,
  inScheda,
  motivoAzioneBloccata,
  notaInChiaro,
  statoDellaMail,
  statoLettura,
  conVerboDavanti,
  verboConferma,
} from "../../lib/calcoli/posta";
import { listIngredients } from "../../lib/api/ingredients";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import { variantiIngrediente, variazionePrezzo } from "../../lib/api/assistente";
import { righeListaAperte } from "../../lib/api/shoppingList";
import { sezioniArchivio } from "../../lib/api/documents";
import { listSuppliers } from "../../lib/api/suppliers";
import { getEntities } from "../../lib/api/entities";
import { formatDate, qtaConUnita } from "../../lib/constants";
import { etichettaCasella, testaDellaMail } from "../../lib/calcoli/pec";

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

const campo =
  "tocco-campo w-full min-w-0 rounded-lg border border-b58-charcoal/15 bg-b58-campo px-2.5 py-1.5 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
const etichetta = "block testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1";

// I colori dei bollini: il testo dice lo stato, il colore aiuta a scorrere.
const COLORE_BOLLINO = {
  guarda: "bg-b58-terracotta/15 text-b58-terracotta-dark-testo",
  in_lettura: "bg-b58-cream-dark text-b58-charcoal-soft",
  decidere: "bg-b58-ambra/20 text-b58-ambra-dark-testo",
  fatto: "bg-b58-azione/15 text-b58-azione-dark-testo",
  niente: "bg-b58-cream-dark text-b58-charcoal-soft",
};

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
// ⚠️ L'elenco è uscito di qui il 21/09: sta in `src/lib/calcoli/posta.js`
//    con le altre regole della Posta, perché una prova possa leggerlo.
const CAMPI = CAMPI_AZIONE;

const ETICHETTE = {
  titolo: "Titolo",
  tipo: "Tipo",
  societa: "Società",
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
              className="underline text-b58-terracotta-testo hover:text-b58-terracotta-dark-testo"
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
        className="tocco-testo testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-testo underline"
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
          {/* ⚠️ Su tutta la riga al telefono (notte del 28/10): in mezza
              colonna da 150 punti la data si tagliava. */}
          <div className="col-span-2 sm:col-span-1">
            <label className={etichetta}>Scadenza</label>
            <input type="date" value={r.scadenza ?? ""}
              onChange={(e) => patchRiga(i, { scadenza: e.target.value })} className={`${campo} campo-data`} />
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
              : "bg-b58-terracotta/10 text-b58-terracotta-dark-testo"
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
            className="text-b58-terracotta-testo hover:text-b58-terracotta-dark-testo underline"
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
        <div className="mb-3 rounded-lg bg-b58-campo border border-b58-charcoal/10 px-3 py-2">
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
                      className="ml-2 tocco-campo rounded border border-b58-charcoal/15 bg-b58-campo px-1.5 py-0.5 testo-sala"
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
            className="testo-sala-grande text-b58-charcoal hover:text-b58-terracotta-testo text-left"
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
                    className="ml-2 testo-sala underline hover:text-b58-terracotta-testo"
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
              <li key={i} className="rounded-lg bg-b58-campo ring-1 ring-b58-charcoal/10 px-3 py-1.5">
                <strong className="text-b58-charcoal">{r.nuovo_ingrediente.nome}</strong>
                {" — "}
                {Number(r.quantita) * (Number(r.fattore) || 1)} {unitaDi(r)}
                {Number(r.costo_unitario) > 0 &&
                  ` a ${(Number(r.costo_unitario) / (Number(r.fattore) || 1)).toFixed(2)} €`}
                <button
                  type="button"
                  onClick={() => setApertaRiga(apertaRiga === i ? null : i)}
                  className="ml-2 testo-sala underline hover:text-b58-terracotta-testo"
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
              <div key={i} className="rounded-lg bg-b58-campo ring-1 ring-b58-charcoal/10">
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
          <p key={i} className="testo-sala-grande text-b58-terracotta-dark-testo mb-1">
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
              <strong className={diff > 0 ? "text-b58-terracotta-dark-testo" : "text-b58-olive-testo"}>
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
        <p className="testo-sala text-b58-terracotta-dark-testo mt-1">
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
  // Le società, per il campo «Società» di un documento archiviato (21/09).
  const [entities, setEntities] = useState(null);
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
  // La Posta a righe (08/11/2026): la scheda scelta, le mail aperte, le
  // sistemate (null finché non servono, NON_LETTO se la lettura fallisce),
  // le mail con i file tecnici in vista, e l'ultima mail tolta per l'Annulla.
  const [scheda, setScheda] = useState("decidere");
  const [aperte, setAperte] = useState(() => new Set());
  const [sistemate, setSistemate] = useState(null);
  const [tecniciAperti, setTecniciAperti] = useState(() => new Set());
  const [tolta, setTolta] = useState(null);

  // Se la lista in attesa si è potuta leggere: senza, «niente da decidere»
  // sarebbe una bugia rassicurante (la regola del 19/08).
  const [postaLetta, setPostaLetta] = useState(false);

  // Le sistemate si chiedono la prima volta che servono, e si rileggono
  // dopo ogni gesto da lì in poi (un ref: lo stato potrebbe essere ancora
  // `null` mentre la prima lettura è in viaggio). Una rilettura fallita non
  // cancella la lista che c'è già.
  const sistemateRichieste = useRef(false);
  const caricaSistemate = () => {
    sistemateRichieste.current = true;
    return leggi(listPostaSistemata()).then((r) =>
      setSistemate((prima) => (nonLetto(r) && Array.isArray(prima) ? prima : r))
    );
  };

  // Dove va il cursore dopo un gesto che ridisegna l'elenco: l'elemento
  // chiesto se c'è ancora, altrimenti la prima riga, altrimenti la scheda.
  // ⚠️ Si fa DOPO il nuovo disegno (useLayoutEffect), non a tempo: a tempo
  //    trovava ancora la riga vecchia che stava per sparire, e il cursore
  //    finiva nel vuoto (revisione ECC dell'08/11).
  const [focusDopo, setFocusDopo] = useState(null);
  const metti = (id) => setFocusDopo({ id });
  useLayoutEffect(() => {
    if (!focusDopo) return;
    const el =
      (focusDopo.id && document.getElementById(focusDopo.id)) ||
      document.querySelector("#elenco-posta button[aria-expanded]") ||
      document.getElementById(`scheda-${scheda}`);
    el?.focus();
    setFocusDopo(null);
  }, [focusDopo, scheda]);

  // Dopo una decisione: la prossima proposta della stessa mail, o la sua riga.
  const dopoDecisione = (m, a) => {
    const prossima = (m.azioni ?? []).find(
      (x) => x.id !== a.id && x.stato === "proposta" && x.tipo !== "nessuna"
    );
    return prossima ? `conferma-${prossima.id}` : `riga-${m.id}`;
  };

  const ricarica = () =>
    listPostaInAttesa().then((righe) => {
      setPosta(righe);
      setPostaLetta(true);
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
    // ⚠️ Le società servono adesso anche al campo «Società» di un documento
    //    archiviato dalla posta (21/09): si tengono, invece di buttarle via
    //    dopo averle usate per i fornitori.
    getEntities()
      .then((ent) => {
        setEntities(ent);
        return listSuppliers(ent.srls.id);
      })
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

  const agisci = async (azioneId, fn, poi = null, tieniTolta = false) => {
    setErrore(null);
    // L'«Annulla» vale per l'ultima mail tolta finché non si fa altro.
    if (!tieniTolta) setTolta(null);
    setInCorso(azioneId);
    try {
      await fn();
      await ricarica();
      // Una mail chiusa passa fra le sistemate: se la scheda è già stata
      // chiesta, si rilegge anche quella.
      if (sistemateRichieste.current) await caricaSistemate();
      metti(poi);
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
        // ⚠️ CON LA SOCIETA' (notte del 28/10): senza, la lettura falliva e
        //    dopo ogni conferma il menu Fornitore diceva «non riesco a
        //    leggere» — lo stesso difetto corretto piu' su, rientrato qui.
        entities?.srls ? leggi(listSuppliers(entities.srls.id)).then(setFornitori) : null,
      ]);
    } catch (e) {
      // Sulla riga toccata, mai in cima: e' li' che si sta guardando.
      setErrore({ dove: azioneId, messaggio: e.message });
    } finally {
      setInCorso(null);
    }
  };

  // «Togli la mail»: la scarta, e lascia un «Annulla» finché non si fa altro.
  const togli = (m) =>
    agisci(
      m.id,
      async () => {
        await scartaPosta(m.id);
        setTolta({ id: m.id, stato: m.stato, oggetto: testaDellaMail(m).oggetto || "senza oggetto" });
      },
      "annulla-togli"
    );

  const annullaTogli = () => {
    const t = tolta;
    if (!t || inCorso === t.id) return;
    agisci(
      t.id,
      async () => {
        await rimettiPosta(t.id, t.stato);
        setTolta(null);
      },
      `riga-${t.id}`,
      true
    );
  };

  const apri = async (allegato) => {
    try {
      window.open(await getAllegatoUrl(allegato.storage_path), "_blank", "noopener");
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <p className="testo-sala-grande text-b58-charcoal-soft">Caricamento…</p>;

  // Una mail sola elenco: quelle in attesa e, per «Sistemate» e «Tutte»,
  // le ultime già sistemate. Una mail non può stare in tutte e due.
  const inAttesaId = new Set(posta.map((m) => m.id));
  const tutte = [
    ...posta,
    ...(Array.isArray(sistemate) ? sistemate.filter((m) => !inAttesaId.has(m.id)) : []),
  ]
    .sort((a, b) => String(b.ricevuta_il ?? "").localeCompare(String(a.ricevuta_il ?? "")))
    .map((m) => {
      const lettura = statoLettura(m, tettoTentativi, lettore);
      return { m, lettura, stato: statoDellaMail(m, lettura) };
    });
  const conta = (s) => tutte.filter((x) => inScheda(x.stato, s)).length;
  const visibili = tutte.filter((x) => inScheda(x.stato, scheda));
  // Quelle che aspettano LUI: non quelle che MEMO leggerà da solo.
  const nDecidere = tutte.filter((x) => x.stato === "decidere" || x.stato === "guarda").length;

  const SCHEDE = [
    { id: "decidere", nome: "Da decidere" },
    { id: "sistemate", nome: "Sistemate" },
    { id: "tutte", nome: "Tutte" },
  ];
  const scegliScheda = (s) => {
    setScheda(s);
    if (s !== "decidere" && (sistemate === null || nonLetto(sistemate))) caricaSistemate();
  };
  const frecceSchede = (e, i) => {
    const n =
      e.key === "ArrowRight" ? (i + 1) % SCHEDE.length
      : e.key === "ArrowLeft" ? (i - 1 + SCHEDE.length) % SCHEDE.length
      : e.key === "Home" ? 0
      : e.key === "End" ? SCHEDE.length - 1
      : null;
    if (n === null) return;
    e.preventDefault();
    scegliScheda(SCHEDE[n].id);
    document.getElementById(`scheda-${SCHEDE[n].id}`)?.focus();
  };
  const apriChiudi = (id) =>
    setAperte((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const bottoneTenue =
    "tocco-campo rounded-lg border border-b58-charcoal/25 hover:bg-b58-cream-dark disabled:opacity-50 transition-colors text-b58-charcoal testo-sala-grande px-3 py-1.5";
  const avviso =
    "testo-sala-grande text-b58-terracotta-dark-testo bg-b58-terracotta/10 rounded-lg px-3 py-2";

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link to="/documenti" className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta-testo">
        ← Archivio Documenti
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1">Posta in arrivo</h1>
      {postaLetta && (
        <p className="testo-sala-grande text-b58-charcoal-soft mt-1 mb-4">
          {nDecidere === 0
            ? "Non c'è niente da decidere."
            : nDecidere === 1
              ? "Una mail aspetta te."
              : `${nDecidere} mail aspettano te.`}
        </p>
      )}

      {error && <p className={`${avviso} mb-4`}>{error}</p>}

      {/* L'«Annulla» di «Togli la mail»: resta finché non si fa altro. */}
      <div role="status" aria-live="polite">
        {tolta && (
          <div className="mb-3">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 testo-sala-grande text-b58-charcoal-soft">
              <span>Mail tolta: «{tolta.oggetto}».</span>
              <button
                type="button"
                id="annulla-togli"
                disabled={inCorso === tolta.id}
                onClick={annullaTogli}
                className="tocco-bottone text-b58-terracotta-testo font-medium underline underline-offset-2 disabled:opacity-50"
              >
                {inCorso === tolta.id ? "…" : "Annulla"}
              </button>
            </p>
            {errore?.dove === tolta.id && <p className={`${avviso} mt-2`}>{errore.messaggio}</p>}
          </div>
        )}
      </div>

      <div role="tablist" aria-label="Quali mail vedere" className="flex flex-wrap gap-1 border-b border-b58-charcoal/15 mb-3">
        {SCHEDE.map((s, i) => {
          const scelta = scheda === s.id;
          const n = conta(s.id);
          return (
            <button
              key={s.id}
              id={`scheda-${s.id}`}
              type="button"
              role="tab"
              aria-selected={scelta}
              aria-controls="elenco-posta"
              tabIndex={scelta ? 0 : -1}
              onClick={() => scegliScheda(s.id)}
              onKeyDown={(e) => frecceSchede(e, i)}
              className={`tocco-bottone inline-flex items-center gap-2 px-3 -mb-px border-b-[3px] font-medium testo-sala-grande ${
                scelta ? "border-b58-terracotta text-b58-charcoal" : "border-transparent text-b58-charcoal-soft hover:text-b58-charcoal"
              }`}
            >
              {s.nome}
              {(s.id === "decidere" || Array.isArray(sistemate)) && (
                <span
                  className={`rounded-full px-2 py-0.5 text-sm tabular-nums ${
                    s.id === "decidere" && n > 0 ? "bg-b58-terracotta-dark text-b58-sul-colore" : "bg-b58-cream-dark text-b58-charcoal"
                  }`}
                >
                  {n}
                  <span className="sr-only"> mail</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div id="elenco-posta" role="tabpanel" tabIndex={0} aria-labelledby={`scheda-${scheda}`}>
        {scheda !== "decidere" && nonLetto(sistemate) && (
          <div className={`${avviso} mb-3`}>
            <p>Non riesco a leggere le mail già sistemate.</p>
            <button
              type="button"
              onClick={() => caricaSistemate()}
              className="tocco-bottone mt-1 underline underline-offset-2 font-medium"
            >
              Riprova
            </button>
          </div>
        )}
        {scheda !== "decidere" && sistemate === null && (
          <p className="testo-sala-grande text-b58-charcoal-soft mb-3">Carico le mail sistemate…</p>
        )}

        {!postaLetta && scheda === "decidere" ? null : visibili.length === 0 ? (
          <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-8 text-center">
            <p className="text-b58-charcoal-soft">
              {scheda === "decidere"
                ? "Niente da decidere. Le mail già sistemate sono in «Sistemate»."
                : "Nessuna mail qui."}
            </p>
          </div>
        ) : (
          <ul className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 divide-y divide-b58-charcoal/10 overflow-hidden">
            {visibili.map(({ m, lettura, stato }) => {
              const testa = testaDellaMail(m);
              const casella = etichettaCasella(m.casella);
              const aperta = aperte.has(m.id);
              return (
                <li key={m.id} className={aperta ? "bg-b58-cream-dark/40" : ""}>
                  <h2 className="m-0">
                    <button
                      type="button"
                      id={`riga-${m.id}`}
                      aria-expanded={aperta}
                      aria-controls={aperta ? `mail-${m.id}` : undefined}
                      onClick={() => apriChiudi(m.id)}
                      className="w-full text-left grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 items-center px-4 py-3 min-h-16 hover:bg-b58-cream-dark/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-b58-terracotta"
                    >
                      <span className="text-b58-charcoal font-medium min-w-0 break-words">
                        {testa.mittente || "Mittente sconosciuto"}
                      </span>
                      <span className="testo-sala text-b58-charcoal-soft tabular-nums whitespace-nowrap">
                        {formatDate(m.ricevuta_il)}
                      </span>
                      <span className="testo-sala-grande text-b58-charcoal-soft min-w-0 break-words">
                        {testa.oggetto || "(senza oggetto)"}
                      </span>
                      <span className={`justify-self-end rounded-full px-2.5 py-0.5 text-sm font-medium whitespace-nowrap ${COLORE_BOLLINO[stato]}`}>
                        {BOLLINO_POSTA[stato]}
                      </span>
                    </button>
                  </h2>
                  {aperta && (
                    <div id={`mail-${m.id}`} className="px-4 pb-4 pt-1 flex flex-col gap-3">
                      {casella && <p className="testo-sala text-b58-charcoal-soft break-all">Arrivata a {casella}</p>}
                      {m.proposta_sintesi && <p className="testo-sala-grande text-b58-charcoal">{m.proposta_sintesi}</p>}
                      {dettaglioMail(m, lettura, stato)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {scheda !== "decidere" && Array.isArray(sistemate) && sistemate.length >= SISTEMATE_MAX && (
          <p className="testo-sala text-b58-charcoal-soft mt-2">
            Qui ci sono le ultime {SISTEMATE_MAX} mail sistemate. Le altre le trovi in Archivio Documenti.
          </p>
        )}
      </div>
    </div>
  );

  // Il contenuto di una mail aperta. È una funzione dentro il componente
  // (non un componente a parte) per usare lo stato della pagina senza
  // passarlo pezzo per pezzo. ⚠️ Si chiama come funzione, non come <Tag>:
  // un componente nato dentro un altro rinasce a ogni disegno, e un campo
  // in cui si sta scrivendo perderebbe il cursore a ogni lettera.
  function dettaglioMail(m, lettura, stato) {
    const daDecidere = (m.azioni ?? []).filter((a) => a.stato === "proposta" && a.tipo !== "nessuna");
    const niente = (m.azioni ?? []).filter((a) => a.tipo === "nessuna");
    const decise = (m.azioni ?? []).filter((a) => a.tipo !== "nessuna" && a.stato !== "proposta");
    const nota = m.stato === "da_leggere" ? null : notaInChiaro(m.lettura_note);
    const { visibili, tecnici } = allegatiDaMostrare(m.allegati);
    const ce = cosaCeDaLeggere(m);
    const vediTecnici = tecniciAperti.has(m.id);
    const allegatiInVista = vediTecnici ? [...visibili, ...tecnici] : visibili;

    return (
      <>
        {/* TOCCA A TE: solo quando MEMO si è fermato o non sta leggendo.
            Le frasi e i due gesti sono quelli del 28/08 (statoLettura). */}
        {stato === "guarda" && (
          <div className={avviso}>
            <p>
              <strong>Tocca a te. </strong>
              {lettura.frase}
            </p>
            {lettura.puoRiprovare && (
              <button
                type="button"
                disabled={inCorso === m.id}
                onClick={() => agisci(m.id, () => riprovaLettura(m.id), `riga-${m.id}`)}
                className="tocco-bottone mt-2 rounded-lg border border-b58-terracotta/40 hover:bg-b58-terracotta/10 disabled:opacity-50 transition-colors text-b58-terracotta-dark-testo testo-sala-grande px-3 py-1.5"
              >
                {inCorso === m.id ? "…" : "Fai riprovare a leggerla"}
              </button>
            )}
            {lettura.puoLeggereAdesso && (
              <button
                type="button"
                disabled={inCorso === m.id}
                onClick={() =>
                  agisci(
                    m.id,
                    async () => {
                      await chiediLetturaAdesso();
                      setLettore(await lettorePostaFermo());
                    },
                    `riga-${m.id}`
                  )
                }
                className="tocco-bottone mt-2 rounded-lg border border-b58-terracotta/40 hover:bg-b58-terracotta/10 disabled:opacity-50 transition-colors text-b58-terracotta-dark-testo testo-sala-grande px-3 py-1.5"
              >
                {inCorso === m.id ? "…" : "Leggila adesso"}
              </button>
            )}
          </div>
        )}
        {stato === "in_lettura" && (
          <p className="testo-sala-grande text-b58-charcoal-soft">MEMO la legge da solo entro un quarto d&apos;ora.</p>
        )}

        {/* Una lettura a metà si dice, ma senza allarme e senza i file della busta. */}
        {nota && <p className="testo-sala-grande text-b58-charcoal-soft">{nota} Controlla a mano prima di confermare.</p>}

        {/* «Niente da fare» detto con le parole della proposta, senza riquadro né pulsanti. */}
        {niente.map((a) =>
          a.descrizione || (a.titolo && a.titolo !== "Senza titolo") ? (
            <p key={a.id} className="testo-sala-grande text-b58-charcoal">
              {a.titolo && a.titolo !== "Senza titolo" ? `${a.titolo}. ` : ""}
              {a.descrizione && a.descrizione !== a.titolo ? a.descrizione : ""}
            </p>
          ) : null
        )}

        {ce.haTesto && (
          <div>
            <button
              type="button"
              aria-expanded={testoAperto === m.id}
              onClick={() => setTestoAperto(testoAperto === m.id ? null : m.id)}
              className="tocco-bottone testo-sala-grande text-b58-terracotta-testo hover:underline"
            >
              {testoAperto === m.id ? "Chiudi il testo" : "Leggi il testo della mail"}
            </button>
            {testoAperto === m.id && (
              <p className="testo-sala-grande text-b58-charcoal bg-b58-campo/60 ring-1 ring-b58-charcoal/10 rounded-lg px-3 py-2 mt-2 whitespace-pre-wrap break-words">
                {m.testo}
              </p>
            )}
          </div>
        )}

        {(visibili.length > 0 || tecnici.length > 0) && (
          <div>
            {allegatiInVista.length > 0 && (
              <>
                <p className="testo-sala uppercase tracking-wide text-b58-charcoal-soft mb-1">Allegati</p>
                <div className="flex flex-wrap gap-2">
                  {allegatiInVista.map((a) =>
                    a.storage_path ? (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => apri(a)}
                        className="tocco-campo rounded-lg border border-b58-charcoal/25 bg-b58-campo hover:bg-b58-cream-dark px-3 py-1.5 testo-sala-grande text-b58-charcoal break-all text-left"
                      >
                        {a.file_name}
                      </button>
                    ) : (
                      <span key={a.id} className="testo-sala-grande text-b58-terracotta-dark-testo break-all">
                        {a.file_name}: non salvato{a.errore ? ` (${a.errore})` : ""}
                      </span>
                    )
                  )}
                </div>
              </>
            )}
            {tecnici.length > 0 && (
              <p className="testo-sala text-b58-charcoal-soft mt-1">
                {tecnici.length === 1 ? "1 file tecnico della PEC nascosto" : `${tecnici.length} file tecnici della PEC nascosti`}
                {" · "}
                <button
                  type="button"
                  onClick={() =>
                    setTecniciAperti((t) => {
                      const n = new Set(t);
                      if (n.has(m.id)) n.delete(m.id);
                      else n.add(m.id);
                      return n;
                    })
                  }
                  className="tocco-bottone underline underline-offset-2 hover:text-b58-terracotta-testo"
                >
                  {vediTecnici ? "nascondili" : "mostrali"}
                </button>
              </p>
            )}
          </div>
        )}

        {daDecidere.length > 0 && (
          <p className="testo-sala uppercase tracking-wide text-b58-charcoal-soft -mb-1">Cosa propone MEMO</p>
        )}
        {daDecidere.map((a) => (
          <div key={a.id} className="rounded-lg bg-b58-campo/60 ring-1 ring-b58-charcoal/10 p-3">
            <p className="flex items-start gap-2 mb-1">
              <span className="inline-flex items-center rounded-full bg-b58-olive text-b58-sul-colore testo-sala font-medium px-2.5 py-1 shrink-0 mt-0.5">
                {NOME_TIPO[a.tipo] ?? a.tipo}
              </span>
              <span className="text-b58-charcoal">{a.descrizione || a.titolo}</span>
            </p>

            {valori[a.id]?.scadenze?.length > 0 && (
              <ul className="testo-sala-grande text-b58-charcoal-soft ml-2 mb-2">
                {valori[a.id].scadenze.map((s, i) => (
                  <li key={i}>
                    · <strong className="text-b58-charcoal">{formatDate(s.data)}</strong> {s.titolo}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-3">
                {CAMPI[a.tipo].map((c) => (
                  <div key={c} className="min-w-0">
                    <label htmlFor={`campo-${a.id}-${c}`} className={etichetta}>
                      {ETICHETTE[c]}
                    </label>
                    {/* Il «tipo» è un menu chiuso (30/08) e la società resta
                        facoltativa (21/09): vedi le note in RigheCarico e in
                        CAMPI_AZIONE. */}
                    {c === "tipo" ? (
                      <select
                        id={`campo-${a.id}-${c}`}
                        value={valori[a.id]?.[c] ?? ""}
                        onChange={(e) => cambia(a.id, c, e.target.value)}
                        className={campo}
                      >
                        <option value="">Sezione…</option>
                        {(nonLetto(sezioni) ? [] : sezioni).map((s) => (
                          <option key={s.codice} value={s.codice}>
                            {s.etichetta}
                          </option>
                        ))}
                      </select>
                    ) : c === "societa" ? (
                      <select
                        id={`campo-${a.id}-${c}`}
                        data-campo-societa
                        value={valori[a.id]?.[c] ?? ""}
                        onChange={(e) => cambia(a.id, c, e.target.value)}
                        className={campo}
                      >
                        <option value="">Non lo so</option>
                        {entities?.srls && <option value={entities.srls.id}>{entities.srls.name}</option>}
                        {entities?.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
                      </select>
                    ) : (
                      <input
                        id={`campo-${a.id}-${c}`}
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

            {(() => {
              const bloccato = motivoAzioneBloccata(a, valori[a.id]);
              return (
                <>
                  {bloccato && <p className={`${avviso} mt-2`}>{bloccato}</p>}
                  {errore?.dove === a.id && <p className={`${avviso} mt-2`}>{errore.messaggio}</p>}
                  {/* Pulsanti corti (08/11): il verbo si vede, il nome intero
                      lo legge il lettore di schermo. */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <button
                      type="button"
                      id={`conferma-${a.id}`}
                      aria-label={conVerboDavanti(verboConferma(a), etichettaConferma(a, valori[a.id]))}
                      disabled={inCorso === a.id || !!bloccato}
                      onClick={() =>
                        agisci(
                          a.id,
                          () =>
                            // La fattura dalla PEC ha la sua porta: i dati li
                            // prende il database dalla proposta (08/11/2026).
                            a.tipo === "registra_fattura"
                              ? registraFatturaDallaPosta(a.id)
                              : confermaAzione(a.id, valori[a.id]),
                          dopoDecisione(m, a)
                        )
                      }
                      className="tocco-campo rounded-lg bg-b58-azione hover:bg-b58-azione-dark disabled:opacity-50 transition-colors text-b58-sul-colore font-medium px-4 py-1.5 testo-sala-grande"
                    >
                      {inCorso === a.id ? "…" : verboConferma(a)}
                    </button>
                    {CAMPI[a.tipo]?.length > 0 && (
                      <button
                        type="button"
                        aria-expanded={aperta === a.id}
                        aria-label={`${aperta === a.id ? "Chiudi la correzione" : "Correggi"}: ${a.titolo}`}
                        onClick={() => setAperta(aperta === a.id ? null : a.id)}
                        className={bottoneTenue}
                      >
                        {aperta === a.id ? "Chiudi" : "Correggi"}
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`No, ${etichettaRifiuto(a).toLowerCase()}: ${a.titolo}`}
                      disabled={inCorso === a.id}
                      onClick={() => agisci(a.id, () => rifiutaAzione(a.id), dopoDecisione(m, a))}
                      className={bottoneTenue}
                    >
                      No
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        ))}

        {decise.length > 0 && (
          <ul className="testo-sala-grande text-b58-charcoal-soft flex flex-col gap-1">
            {decise.map((a) => (
              <li key={a.id}>
                {a.stato === "fatta" ? "✓ " : "No: "}
                {a.titolo}
              </li>
            ))}
          </ul>
        )}

        {m.stato === "proposta" && (m.azioni ?? []).length === 0 && (
          <p className="testo-sala-grande text-b58-charcoal-soft">MEMO non ha proposto niente per questa mail.</p>
        )}

        {m.stato !== "archiviata" && (
          <button
            type="button"
            aria-label={`Togli la mail: ${testaDellaMail(m).oggetto || "senza oggetto"}`}
            disabled={inCorso === m.id}
            onClick={() => togli(m)}
            className="tocco-testo self-start testo-sala-grande text-b58-charcoal-soft underline underline-offset-2 hover:text-b58-terracotta-testo mt-2"
          >
            Togli la mail
          </button>
        )}
        {errore?.dove === m.id && <p className={avviso}>{errore.messaggio}</p>}
      </>
    );
  }
}
