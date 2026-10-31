// LE SCHERMATE VERE, MONTATE COME NEL GESTIONALE — prova visiva del 26/09/2026.
//
// Una pagina sola, e la schermata si sceglie dall'indirizzo:
//   ?pagina=dashboard | agenda | primanota | causali | salaorari | spesa | ingrediente | archivio | stampanti
//
// ⚠️ Il telaio è quello vero (`Layout.jsx`): la barra laterale occupa lo
//    stesso spazio da 1024 punti in su, e il contenuto ha gli stessi
//    margini e la stessa classe `contenuto-ampio`. Senza, sul computer si
//    misurerebbe una pagina più larga di quella che Alessio vede.
//
// ⚠️ I dati sono FINTI (`tests/visive/finti/supabase.js`) e scelti per
//    mettere alla prova i casi difficili: titoli lunghi, categorie, una
//    chiusura di più giorni, un avviso con una descrizione lunga.
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../../src/index.css";
// Inter locale, come quello che il gestionale carica da Google Fonts (27/09/2026).
import "../caratteri/inter.css";
import "../caratteri/bricolage.css";
import { applyPxCm } from "../../../src/lib/touch";
import Dashboard from "../../../src/pages/Dashboard";
import AgendaList from "../../../src/pages/agenda/AgendaList";
import PrimaNota from "../../../src/pages/cassa/PrimaNota";
import Causali from "../../../src/pages/cassa/Causali";
import SalaEOrari from "../../../src/pages/calendario/SalaEOrari";
import SpesaSpicciola from "../../../src/pages/magazzino/SpesaSpicciola";
import IngredienteForm from "../../../src/pages/ricettario/IngredienteForm";
import ArchivioDocumentiHome from "../../../src/pages/documenti/ArchivioDocumentiHome";
import Stampanti from "../../../src/pages/comande/Stampanti";
import { agendaCorsie } from "../finti/tasks.js";

applyPxCm();
// Lo schermo dell'apparecchio (29/10/2026): come lo propone il gestionale,
// guardando la larghezza della finestra di prova — sul banco il puntatore non
// dice niente. `?schermo=…` lo forza, per le foto «prima / dopo».
document.documentElement.setAttribute(
  "data-schermo",
  new URLSearchParams(location.search).get("schermo") ??
    // La scelta salvata, come nel gestionale (31/10/2026): la forma
    // «computer 900 calibrato» la scrive prima che la pagina parta.
    localStorage.getItem("b58-schermo") ??
    (innerWidth >= 1024 ? "computer" : innerWidth < 768 ? "telefono" : "tablet"),
);

const impegno = (id, title, category, priority) => ({
  id,
  title,
  category,
  priority,
  status: "da_fare",
  due_date: null,
  due_time: null,
  description: "",
  preferito: false,
  visibile_staff: true,
  origine_modulo: null,
});

const fraGiorni = (n) => {
  const d = new Date(Date.now() + n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const causale = (id, label, kind = "uscita") => ({
  id,
  label,
  kind,
  active: true,
  di_sistema: false,
  e_costo_fisso: false,
});

// Un movimento di prima nota, con la causale già incorporata come la legge
// `listCashMovements`.
const movimento = (n, direction, amount, etichetta, mezzo, extra = {}) => {
  const { di_sistema = false, ...resto } = extra;
  return {
    id: `m${n}`,
    direction,
    amount,
    movement_date: `2026-09-${String(27 - n).padStart(2, "0")}`,
    causale: { id: `cm${n}`, label: etichetta, di_sistema },
    mezzo,
    note: null,
    document_reference: null,
    business_purpose: null,
    is_owner_injection: false,
    e_investimento: false,
    tipo_documento: null,
    entity_id: "e1",
    ...resto,
  };
};

// Un'ora fissa e non quella del momento: le foto «prima / dopo» del
// 29/10 si confrontano byte per byte, e un orologio che cambia le farebbe
// diverse sempre.
const ORA_FISSA = "2026-10-28T20:30:00.000Z";

const DATI = {
  dashboard: {
    tabelle: {
      tasks: [
        impegno("t1", "Titolare effettivo — verificare con Laura e la Camera di commercio", "fisco_scadenze", "alta"),
        impegno("t2", "Comunicazione dell'occupazione del suolo pubblico per il dehors", "documenti", "media"),
        impegno("t3", "Valutare il secondo forno", "altro", "bassa"),
      ],
    },
    rpc: {
      avvisi_del_gestionale: [
        {
          chiave: "haccp",
          quanti: 2,
          titolo: "Non conformità aperte in HACCP",
          dettaglio: "Congelatore: −17,0 °C, fuori dal range −22,0/−18,0 °C, registrato ieri sera",
          gravita: "alta",
          dove: "/haccp/non-conformita",
          rimandato_a: null,
        },
        // 27/09/2026: un secondo avviso lungo e uno rimandato. A 768 il
        // dettaglio si tagliava con «…» proprio sulla coda che dice quando;
        // sul telefono il rimandato diventava «Prodotti sotto sc…».
        {
          chiave: "fatture",
          quanti: 5,
          titolo: "Fatture da pagare scadute",
          dettaglio: "La più vecchia è di Mililli Ortofrutta, 412,80 €, scaduta da 12 giorni",
          gravita: "alta",
          dove: "/fatture",
          rimandato_a: null,
        },
        {
          chiave: "sotto_scorta",
          quanti: 1,
          titolo: "Prodotti sotto scorta",
          dettaglio: "Olio extravergine",
          gravita: "bassa",
          dove: "/magazzino/lista-spesa",
          rimandato_a: "2026-09-30",
        },
      ],
    },
  },
  // Le stesse righe difficili della prova visiva dell'Agenda.
  agenda: { rpc: { agenda_corsie: await agendaCorsie(), agenda_fatti: [] } },
  primanota: {
    tabelle: {
      cash_causali: [causale("c1", "Spesa alimentare"), causale("c2", "Manutenzione"), causale("c3", "Incasso", "entrata")],
      entities: [{ id: "e1", name: "Borgo 58", entity_type: "srls" }],
      // 27/09/2026: sei movimenti, con una nota lunga, un riferimento di
      // documento e due righe scritte dal gestionale. A 768 la tabella
      // chiedeva 799 punti in 656 e l'importo finiva fuori dalla vista.
      cash_movements: [
        movimento(1, "uscita", 38.5, "Spesa alimentare", "cassa", {
          note: "Pane e verdure dal mercato di piazza, pagato in contanti al banco del signor Rizzo",
        }),
        movimento(2, "entrata", 1250, "Incasso", "banca"),
        movimento(3, "uscita", 12, "Manutenzione", "cassa", { note: "Guarnizione" }),
        movimento(4, "uscita", 2480.35, "Materiale di consumo / economato", "banca", {
          note: "Stoviglie nuove per la sala",
          document_reference: "FT 2026/0412 del 10/09",
        }),
        movimento(5, "entrata", 500, "Versamento dalla cassa", "banca", { di_sistema: true }),
        movimento(6, "uscita", 500, "Versamento in banca", "cassa", { di_sistema: true }),
      ],
    },
  },
  causali: {
    tabelle: {
      cash_causali: [
        causale("c1", "Spesa alimentare"),
        causale("c2", "Materiale di consumo / economato"),
        causale("c3", "Trasporti"),
        causale("c4", "Incasso extra", "entrata"),
      ],
    },
  },
  salaorari: {
    tabelle: {
      service_closures: [
        { id: "k1", dal: "2026-12-24", al: "2026-12-27", motivo: "Chiusura per le feste", si_lavora_in_cucina: false },
        { id: "k2", dal: "2026-11-02", al: "2026-11-02", motivo: "", si_lavora_in_cucina: null },
      ],
    },
  },
  spesa: {},
  // Le due società, come nel gestionale vero: senza, la scheda apriva con un
  // errore in inglese in cima, che nel locale non compare (27/09/2026).
  ingrediente: {
    tabelle: {
      entities: [
        { id: "e1", name: "Borgo 58", entity_type: "srls" },
        { id: "e2", name: "Azienda agricola", entity_type: "azienda_agricola" },
      ],
    },
  },
  archivio: {
    tabelle: {
      entities: [{ id: "e1", name: "Borgo 58", entity_type: "srls" }],
      documents: [
        { id: "d1", title: "Polizza assicurativa del locale", doc_type: "contratto", expiry_date: fraGiorni(20), entity_id: "e1" },
        { id: "d2", title: "Certificato di prevenzione incendi", doc_type: "certificato", expiry_date: fraGiorni(45), entity_id: "e1" },
      ],
    },
  },
  // Le stampanti (28/10/2026): un registratore, una stampante con la carta
  // finita e la sua frase lunga, e un lavoro «incerto» col suo testo — i
  // casi che vanno a capo.
  stampanti: {
    tabelle: {
      dispositivi: [
        { id: "s1", nome: "Registratore telematico della cassa", tipo: "registratore_fiscale", protocollo: "fpmate_http", indirizzo: "192.168.100.250", porta: 8043, reparto: null, attivo: true, ultimo_contatto_il: ORA_FISSA, ultimo_stato: "pronto", ultimo_stato_testo: null },
        { id: "s2", nome: "Stampante cucina", tipo: "stampante_comande", protocollo: "escpos_tcp", indirizzo: "192.168.1.51", porta: 9100, reparto: "cucina", attivo: true, ultimo_contatto_il: ORA_FISSA, ultimo_stato: "carta_finita", ultimo_stato_testo: "La stampante dice che la carta è finita: cambia il rotolo e riprova." },
      ],
      lavori_stampa: [
        { id: "l1", dispositivo_id: "s2", tipo: "prova", stato: "incerto", tentativi: 1, creato_il: ORA_FISSA, finito_il: ORA_FISSA, errore_codice: "interrotto", errore_testo: "Il ponte ha preso questo lavoro e non ha più risposto: forse è uscito, forse no. Guarda la stampante e decidi tu." },
        { id: "l2", dispositivo_id: "s1", tipo: "stato", stato: "stampato", tentativi: 1, creato_il: ORA_FISSA, finito_il: ORA_FISSA, errore_codice: null, errore_testo: null },
      ],
    },
    rpc: {
      chiavi_ponte_elenco: [
        { id: "k1", nome: "Mini-PC ristorante", creata_il: ORA_FISSA, ultimo_battito: ORA_FISSA, versione: "0.1.0", host: "MINIPC-BORGO58", acceso: true, revocata_il: null },
      ],
    },
  },
};

const PAGINE = {
  dashboard: ["/dashboard", <Dashboard key="d" />],
  agenda: ["/agenda", <AgendaList key="a" />],
  primanota: ["/cassa/prima-nota", <PrimaNota key="p" />],
  causali: ["/cassa/causali", <Causali key="c" />],
  salaorari: ["/calendario-eventi/sala-e-orari", <SalaEOrari key="s" />],
  spesa: ["/magazzino/spesa-spicciola", <SpesaSpicciola key="sp" />],
  ingrediente: ["/ricettario/ingredienti/nuovo", <IngredienteForm key="i" />],
  archivio: ["/documenti", <ArchivioDocumentiHome key="ar" />],
  stampanti: ["/comande/stampanti", <Stampanti key="st" />],
};

const nome = new URLSearchParams(location.search).get("pagina") ?? "dashboard";

// 🔴 LA BARRA IN ALTO E IL MENU A CASSETTO (31/10/2026, M14): il banco non
//    monta il Layout vero (chiede login e quaderno dei difetti), quindi ne
//    rifà i due pezzi con le stesse classi: quelle che contano per il
//    profilo «Computer». Solo a finestra stretta col profilo «Computer»:
//    sulle altre forme il banco resta quello di sempre.
const conTelaio = document.documentElement.dataset.schermo === "computer" && innerWidth < 1024;
const telaio = conTelaio && (
  <>
    <header className="telaio-del-gestionale lg:hidden flex items-center justify-between px-4 py-3 border-b border-b58-charcoal/10 bg-b58-parchment">
      <span className="tocco-bottone inline-flex items-center rounded-lg pr-2 testo-sala">Borgo 58</span>
      <button type="button" aria-label="Apri menu" className="tocco-bottone inline-flex items-center justify-center rounded-lg">☰</button>
    </header>
    <div className="telaio-del-gestionale lg:hidden fixed bottom-0 right-0 w-72 bg-b58-parchment shadow-xl" data-cassetto>
      <a className="tocco-bottone flex items-center gap-3 rounded-lg px-3 testo-sala">Agenda</a>
      <a className="tocco-bottone flex items-center gap-3 rounded-lg px-3 testo-sala">Prima nota</a>
    </div>
  </>
);
window.__DATI_FINTI = DATI[nome] ?? {};
const [percorso, schermata] = PAGINE[nome] ?? PAGINE.dashboard;

createRoot(document.getElementById("root")).render(
  <MemoryRouter initialEntries={[percorso]}>
    <div className="min-h-screen bg-b58-cream flex">
      <aside className="hidden lg:block lg:w-64 xl:w-80 shrink-0 border-r border-b58-charcoal/10" />
      <div className="flex-1 min-w-0 flex flex-col">
        {telaio}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 contenuto-ampio" data-pagina={nome}>
          <Routes>
            <Route path={percorso} element={schermata} />
          </Routes>
        </main>
      </div>
    </div>
  </MemoryRouter>,
);
