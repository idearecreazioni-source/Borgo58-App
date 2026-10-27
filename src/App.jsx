import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Caricamento from "./components/Caricamento";
import SegnaleDatabase from "./components/SegnaleDatabase";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ModulePlaceholder from "./pages/ModulePlaceholder";
// IL GESTIONALE SI CARICA A PEZZI — 27/10/2026
//
// Fino a oggi ogni schermata era scritta qui con un import fisso, e il
// telefono scaricava tutto il gestionale (1,29 MB di codice, misurati con la
// build del 25/10) prima di mostrare la prima pagina. Da qui partono subito
// solo l'accesso, la Dashboard e la cornice; ogni altra schermata arriva
// quando la si apre. Le pagine sono le stesse, cambia solo quando arrivano.
const RicettarioHome = lazy(() => import("./pages/ricettario/RicettarioHome"));
const IngredientiList = lazy(() => import("./pages/ricettario/IngredientiList"));
const SchedeProdotti = lazy(() => import("./pages/ricettario/SchedeProdotti"));
const BozzeList = lazy(() => import("./pages/ricettario/BozzeList"));
const BozzaDetail = lazy(() => import("./pages/ricettario/BozzaDetail"));
const Estrapola = lazy(() => import("./pages/ricettario/Estrapola"));
const AnteprimaDaTesto = lazy(() => import("./pages/ricettario/AnteprimaDaTesto"));
const Fotografa = lazy(() => import("./pages/assistente/Fotografa"));
const Detta = lazy(() => import("./pages/assistente/Detta"));
const IngredienteForm = lazy(() => import("./pages/ricettario/IngredienteForm"));
const RicetteList = lazy(() => import("./pages/ricettario/RicetteList"));
const RicettaForm = lazy(() => import("./pages/ricettario/RicettaForm"));
const RicettaDetail = lazy(() => import("./pages/ricettario/RicettaDetail"));
const StaffRicettaDetail = lazy(() => import("./pages/ricettario/StaffRicettaDetail"));
const MenuList = lazy(() => import("./pages/ricettario/MenuList"));
const MenuForm = lazy(() => import("./pages/ricettario/MenuForm"));
const MenuDetail = lazy(() => import("./pages/ricettario/MenuDetail"));
const ReservationsList = lazy(() => import("./pages/calendario/ReservationsList"));
const ReservationForm = lazy(() => import("./pages/calendario/ReservationForm"));
const ClientiList = lazy(() => import("./pages/calendario/ClientiList"));
const Comunicazioni = lazy(() => import("./pages/calendario/Comunicazioni"));
const PreventiviList = lazy(() => import("./pages/calendario/PreventiviList"));
const PreventivoDetail = lazy(() => import("./pages/calendario/PreventivoDetail"));
const ClienteDetail = lazy(() => import("./pages/calendario/ClienteDetail"));
const SalaEOrari = lazy(() => import("./pages/calendario/SalaEOrari"));
const PiantaGiornata = lazy(() => import("./pages/calendario/PiantaGiornata"));
const PublicReservationForm = lazy(() => import("./pages/public/PublicReservationForm"));
const InformativaPrivacy = lazy(() => import("./pages/public/InformativaPrivacy"));
const AgendaList = lazy(() => import("./pages/agenda/AgendaList"));
const TaskForm = lazy(() => import("./pages/agenda/TaskForm"));
const MagazzinoHome = lazy(() => import("./pages/magazzino/MagazzinoHome"));
const RegistraCarico = lazy(() => import("./pages/magazzino/RegistraCarico"));
const ListaSpesa = lazy(() => import("./pages/magazzino/ListaSpesa"));
const SpesaSpicciola = lazy(() => import("./pages/magazzino/SpesaSpicciola"));
const Ordini = lazy(() => import("./pages/magazzino/Ordini"));
const Produzioni = lazy(() => import("./pages/magazzino/Produzioni"));
const Tracciabilita = lazy(() => import("./pages/haccp/Tracciabilita"));
const LottoDestinazioni = lazy(() => import("./pages/haccp/LottoDestinazioni"));
const Scadenze = lazy(() => import("./pages/magazzino/Scadenze"));
const Fermi = lazy(() => import("./pages/magazzino/Fermi"));
const Allineamento = lazy(() => import("./pages/magazzino/Allineamento"));
const Cantina = lazy(() => import("./pages/magazzino/Cantina"));
const Materiali = lazy(() => import("./pages/magazzino/Materiali"));
const FornitoriList = lazy(() => import("./pages/magazzino/FornitoriList"));
const FornitoreDetail = lazy(() => import("./pages/magazzino/FornitoreDetail"));
const HaccpHome = lazy(() => import("./pages/haccp/HaccpHome"));
const TemperatureLog = lazy(() => import("./pages/haccp/TemperatureLog"));
const RicevimentoMerci = lazy(() => import("./pages/haccp/RicevimentoMerci"));
const PuliziaESanificazione = lazy(() => import("./pages/haccp/PuliziaESanificazione"));
const NonConformita = lazy(() => import("./pages/haccp/NonConformita"));
const ManualeCompleto = lazy(() => import("./pages/haccp/ManualeCompleto"));
const RaccoltaPropria = lazy(() => import("./pages/haccp/RaccoltaPropria"));
const StampaAdempimenti = lazy(() => import("./pages/agenda/StampaAdempimenti"));
const FattureFornitoriHome = lazy(() => import("./pages/fatture/FattureFornitoriHome"));
const CassaHome = lazy(() => import("./pages/cassa/CassaHome"));
const PrimaNota = lazy(() => import("./pages/cassa/PrimaNota"));
const ScontiOmaggi = lazy(() => import("./pages/cassa/ScontiOmaggi"));
const Causali = lazy(() => import("./pages/cassa/Causali"));
const Previsione = lazy(() => import("./pages/cassa/Previsione"));
const SezionePersonale = lazy(() => import("./pages/cassa/SezionePersonale"));
const Prestiti = lazy(() => import("./pages/cassa/Prestiti"));
const CaparreTenute = lazy(() => import("./pages/cassa/CaparreTenute"));
const DaCollocare = lazy(() => import("./pages/cassa/DaCollocare"));
const Segnalazioni = lazy(() => import("./pages/assistente/Segnalazioni"));
const Scontrinato = lazy(() => import("./pages/cassa/Scontrinato"));
const ContiCorrenti = lazy(() => import("./pages/cassa/ContiCorrenti"));
const MovimentiBanca = lazy(() => import("./pages/cassa/MovimentiBanca"));
const ImportaFatturaElettronica = lazy(() => import("./pages/fatture/ImportaFatturaElettronica"));
const CostoProgetto = lazy(() => import("./pages/cassa/CostoProgetto"));
const Bar = lazy(() => import("./pages/comande/Bar"));
const Cucina = lazy(() => import("./pages/comande/Cucina"));
const Scontrini = lazy(() => import("./pages/comande/Scontrini"));
const Sala = lazy(() => import("./pages/comande/Sala"));
const ProiezioneFiscaleHome = lazy(() => import("./pages/fiscale/ProiezioneFiscaleHome"));
const DeduzioniFiscali = lazy(() => import("./pages/fiscale/DeduzioniFiscali"));
const Deducibilita = lazy(() => import("./pages/fiscale/Deducibilita"));
const CatalogoStrumenti = lazy(() => import("./pages/fiscale/CatalogoStrumenti"));
const SimulatoreFiscale = lazy(() => import("./pages/fiscale/SimulatoreFiscale"));
const Previsioni = lazy(() => import("./pages/fiscale/Previsioni"));
const PrevisioneDettaglio = lazy(() => import("./pages/fiscale/PrevisioneDettaglio"));
const AndamentoMensile = lazy(() => import("./pages/fiscale/AndamentoMensile"));
const ChiusuraAnnuale = lazy(() => import("./pages/fiscale/ChiusuraAnnuale"));
const PrevisioneForm = lazy(() => import("./pages/fiscale/PrevisioneForm"));
const PersonaleHome = lazy(() => import("./pages/personale/PersonaleHome"));
const DipendenteDetail = lazy(() => import("./pages/personale/DipendenteDetail"));
const Mance = lazy(() => import("./pages/personale/Mance"));
const ArchivioDocumentiHome = lazy(() => import("./pages/documenti/ArchivioDocumentiHome"));
const DocumentoDetail = lazy(() => import("./pages/documenti/DocumentoDetail"));
const PostaInArrivo = lazy(() => import("./pages/documenti/PostaInArrivo"));
const ChiediArchivio = lazy(() => import("./pages/documenti/ChiediArchivio"));
const EditorMenuHome = lazy(() => import("./pages/menu-editor/EditorMenuHome"));
const BevandeVini = lazy(() => import("./pages/menu-editor/BevandeVini"));
const PiattiDelGiorno = lazy(() => import("./pages/menu-editor/PiattiDelGiorno"));
const AgricoloHome = lazy(() => import("./pages/agricolo/AgricoloHome"));
const Cessioni = lazy(() => import("./pages/agricolo/Cessioni"));
import { getModule } from "./data/modules";

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? children : <Navigate to="/" replace />;
}

// Rotte riservate al titolare: lo staff che le raggiunge viene rimandato alla
// dashboard. La barriera vera resta la RLS (§3.5); questa è la difesa frontend.
function RequireTitolare({ children }) {
  const { isTitolare, loading } = useAuth();
  if (loading) return null;
  return isTitolare ? children : <Navigate to="/dashboard" replace />;
}

// Placeholder dei moduli non ancora costruiti: il blocco dipende dal modulo
// specifico (staffVisible in data/modules.js), non è un blanket "solo titolare".
function ModulePlaceholderGuarded() {
  const { moduleId } = useParams();
  const { isTitolare, loading } = useAuth();
  const module = getModule(moduleId);
  if (loading) return null;
  if (!isTitolare && !module?.staffVisible) return <Navigate to="/dashboard" replace />;
  return <ModulePlaceholder />;
}

// La scheda ricetta cambia in base al ruolo: editor completo per il titolare,
// vista in sola lettura senza dati economici per lo staff.
function RecipeDetailByRole() {
  const { isTitolare } = useAuth();
  return isTitolare ? <RicettaDetail /> : <StaffRicettaDetail />;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <Suspense fallback={<Caricamento />}>
    <Routes>
      <Route
        path="/"
        element={
          loading ? null : isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Login />
          )
        }
      />
      <Route path="/prenota" element={<PublicReservationForm />} />
      <Route path="/privacy" element={<InformativaPrivacy />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Ricettario */}
        <Route path="/ricettario" element={<RicettarioHome />} />
        <Route path="/ricettario/ricette" element={<RicetteList />} />
        <Route path="/ricettario/ricette/nuova" element={<RequireTitolare><RicettaForm /></RequireTitolare>} />
        <Route path="/ricettario/ricette/:id" element={<RecipeDetailByRole />} />
        <Route path="/ricettario/ingredienti" element={<RequireTitolare><IngredientiList /></RequireTitolare>} />
        <Route path="/ricettario/schede" element={<RequireTitolare><SchedeProdotti /></RequireTitolare>} />
        {/* Le bozze di ricetta (Fase 1A, 06/10/2026): NON nel menu finché la
            migrazione 20261006000001 e il corridoio non sono installati. */}
        <Route path="/ricettario/bozze" element={<RequireTitolare><BozzeList /></RequireTitolare>} />
        <Route path="/ricettario/estrapola" element={<RequireTitolare><Estrapola /></RequireTitolare>} />
        {/* Anteprima locale da testo (Fase 1C): non salva nulla, non nel menu.
            Prima della rotta dinamica qui sotto, apposta. */}
        <Route path="/ricettario/bozze/da-testo" element={<RequireTitolare><AnteprimaDaTesto /></RequireTitolare>} />
        <Route path="/ricettario/bozze/:id" element={<RequireTitolare><BozzaDetail /></RequireTitolare>} />
        {/* Solo il titolare: il personale non c'e' ancora, e restringere
            adesso non costa niente mentre allargare dopo e' una riga. */}
        <Route path="/fotografa" element={<RequireTitolare><Fotografa /></RequireTitolare>} />
        {/* I comandi vocali (26/08/2026). Stessa ragione del limite qui
            sopra: per ora l'assistente lo usa solo Alessio. */}
        <Route path="/detta" element={<RequireTitolare><Detta /></RequireTitolare>} />
        <Route path="/segnalazioni" element={<RequireTitolare><Segnalazioni /></RequireTitolare>} />
        <Route path="/ricettario/ingredienti/nuovo" element={<RequireTitolare><IngredienteForm /></RequireTitolare>} />
        <Route path="/ricettario/ingredienti/:id" element={<RequireTitolare><IngredienteForm /></RequireTitolare>} />
        <Route path="/ricettario/menu" element={<RequireTitolare><MenuList /></RequireTitolare>} />
        <Route path="/ricettario/menu/nuovo" element={<RequireTitolare><MenuForm /></RequireTitolare>} />
        <Route path="/ricettario/menu/:id" element={<RequireTitolare><MenuDetail /></RequireTitolare>} />

        {/* Calendario eventi (staff: vista operativa) */}
        <Route path="/calendario-eventi" element={<ReservationsList />} />
        <Route path="/calendario-eventi/nuova" element={<ReservationForm />} />
        <Route
          path="/calendario-eventi/sala-e-orari"
          element={<RequireTitolare><SalaEOrari /></RequireTitolare>}
        />
        {/* La pianta: la legge anche la sala (serve a sapere chi sta dove),
            ma la muove solo il titolare — lo decide la RLS, non la rotta. */}
        <Route path="/calendario-eventi/pianta" element={<PiantaGiornata />} />
        <Route path="/calendario-eventi/preventivi" element={<RequireTitolare><PreventiviList /></RequireTitolare>} />
        <Route path="/calendario-eventi/preventivi/:id" element={<RequireTitolare><PreventivoDetail /></RequireTitolare>} />
        <Route path="/calendario-eventi/clienti" element={<ClientiList />} />
        <Route
          path="/calendario-eventi/comunicazioni"
          element={<RequireTitolare><Comunicazioni /></RequireTitolare>}
        />
        <Route path="/calendario-eventi/clienti/:id" element={<ClienteDetail />} />
        <Route path="/calendario-eventi/:id" element={<ReservationForm />} />

        {/* Agenda (condivisa titolare/staff) */}
        <Route path="/agenda" element={<AgendaList />} />
        <Route path="/agenda/nuovo" element={<TaskForm />} />
        {/* Adempimenti societari: riservati al titolare (§3.5/§3.18) */}
        <Route
          path="/agenda/adempimenti"
          element={
            <RequireTitolare>
              <StampaAdempimenti />
            </RequireTitolare>
          }
        />
        <Route path="/agenda/:id" element={<TaskForm />} />

        {/* Magazzino (condiviso titolare/staff, senza valore economico per lo staff — §3.5) */}
        <Route path="/magazzino" element={<MagazzinoHome />} />
        <Route path="/magazzino/carico" element={<RegistraCarico />} />
        <Route path="/magazzino/lista-spesa" element={<ListaSpesa />} />
        <Route path="/magazzino/spesa-spicciola" element={<SpesaSpicciola />} />
        <Route path="/magazzino/ordini" element={<Ordini />} />
        <Route path="/magazzino/produzioni" element={<Produzioni />} />
        {/* 🔴 LA TRACCIABILITÀ È PASSATA IN HACCP (23/08/2026, decisione di
            Alessio del 15/08): è lì che serve, davanti a un'ispezione o a un
            richiamo, e tenerla in due moduli era la stessa informazione in
            due posti.
            ⚠️ L'indirizzo vecchio RIMANDA a quello nuovo invece di sparire:
            chi ha il collegamento salvato sul tablet non trova una pagina
            morta. */}
        <Route path="/haccp/tracciabilita" element={<Tracciabilita />} />
        <Route path="/haccp/tracciabilita/:id" element={<LottoDestinazioni />} />
        <Route
          path="/magazzino/tracciabilita"
          element={<Navigate to="/haccp/tracciabilita" replace />}
        />
        <Route path="/magazzino/scadenze" element={<Scadenze />} />
        <Route path="/magazzino/fermi" element={<Fermi />} />
        {/* I materiali di consumo stanno in Magazzino e non nel Ricettario:
            la domanda a cui rispondono è «cosa ho in casa». La SCHEDA resta
            quella degli ingredienti, più corta — due schede per la stessa
            merce divergerebbero al primo campo aggiunto. */}
        <Route path="/magazzino/materiali" element={<Materiali />} />
        <Route path="/magazzino/allineamento" element={<Allineamento />} />
        <Route path="/magazzino/cantina" element={<Cantina />} />
        {/* Anagrafica Fornitori (§3.11): dati economici (P.IVA, condizioni di
            pagamento) — titolare-only, coerente col resto di §3.5. */}
        <Route
          path="/magazzino/fornitori"
          element={
            <RequireTitolare>
              <FornitoriList />
            </RequireTitolare>
          }
        />
        <Route
          path="/magazzino/fornitori/:id"
          element={
            <RequireTitolare>
              <FornitoreDetail />
            </RequireTitolare>
          }
        />

        {/* HACCP (condiviso: staff fa solo immissione operativa, non modifica struttura/storico — §3.5) */}
        <Route path="/haccp" element={<HaccpHome />} />
        <Route path="/haccp/temperature" element={<TemperatureLog />} />
        <Route path="/haccp/ricevimento" element={<RicevimentoMerci />} />
        <Route path="/haccp/pulizia" element={<PuliziaESanificazione />} />
        <Route path="/haccp/non-conformita" element={<NonConformita />} />
        <Route path="/haccp/manuale" element={<ManualeCompleto />} />
        <Route path="/haccp/raccolta-propria" element={<RaccoltaPropria />} />

        {/* Fatture Fornitori (solo titolare, esplicito nel brief) */}
        <Route path="/fatture-fornitori" element={<RequireTitolare><FattureFornitoriHome /></RequireTitolare>} />
        <Route path="/fatture-fornitori/da-file" element={<RequireTitolare><ImportaFatturaElettronica /></RequireTitolare>} />

        {/* Cassa, Banca e Prima Nota (solo titolare — §3.5) */}
        <Route path="/cassa" element={<RequireTitolare><CassaHome /></RequireTitolare>} />
        <Route path="/cassa/prima-nota" element={<RequireTitolare><PrimaNota /></RequireTitolare>} />
        <Route path="/cassa/sconti-omaggi" element={<RequireTitolare><ScontiOmaggi /></RequireTitolare>} />
        <Route path="/cassa/causali" element={<RequireTitolare><Causali /></RequireTitolare>} />
        <Route path="/cassa/conti-correnti" element={<RequireTitolare><ContiCorrenti /></RequireTitolare>} />
        <Route path="/cassa/banca" element={<RequireTitolare><MovimentiBanca /></RequireTitolare>} />
        <Route path="/cassa/previsione" element={<RequireTitolare><Previsione /></RequireTitolare>} />
        <Route path="/cassa/costo-progetto" element={<RequireTitolare><CostoProgetto /></RequireTitolare>} />
        <Route path="/cassa/personale" element={<RequireTitolare><SezionePersonale /></RequireTitolare>} />
        {/* ⚠️ Titolare-only: chi ha prestato soldi ad Alessio e quanto
            gliene deve ancora è un fatto suo e di quelle persone. */}
        <Route path="/cassa/da-collocare" element={<RequireTitolare><DaCollocare /></RequireTitolare>} />
        <Route path="/cassa/prestiti" element={<RequireTitolare><Prestiti /></RequireTitolare>} />
        <Route path="/cassa/caparre-tenute" element={<RequireTitolare><CaparreTenute /></RequireTitolare>} />
        <Route path="/cassa/scontrinato" element={<RequireTitolare><Scontrinato /></RequireTitolare>} />
        {/* Comande (§3.2, §4 mod. 5): staff-accessibile, voce propria in
            sidebar — non sotto /cassa, dato che è una modalità operativa
            diversa dal resto del gestionale (uno schermo che resta aperto
            tutto il servizio, non una pagina consultata ogni tanto). Il
            legame dati col modulo 5 (conto -> futuro RT) resta nello
            schema, non nell'URL.

            Una postazione, una schermata (§3.2.1): /comande è la SALA
            (tablet verticale), /comande/bar il BAR (tablet orizzontale,
            anche cassa), /comande/cucina la postazione di STAMPA della
            cucina — che per scelta lavora solo di carta. Il vecchio
            schermo unico a tre colonne è stato spento il 09/08/2026,
            quando tutte e tre le postazioni hanno avuto la propria. */}
        <Route path="/comande" element={<Sala />} />
        <Route path="/comande/bar" element={<Bar />} />
        <Route path="/comande/cucina" element={<Cucina />} />
        <Route path="/comande/scontrini" element={<Scontrini />} />
        {/* Il vecchio indirizzo resta come reindirizzo: qualche tablet
            potrebbe averlo ancora nei preferiti. */}
        <Route path="/comande/reparti" element={<Navigate to="/comande/cucina" replace />} />

        {/* Proiezione Fiscale (solo titolare — §3.5, materia sensibile §6) */}
        <Route path="/fiscale" element={<RequireTitolare><ProiezioneFiscaleHome /></RequireTitolare>} />
        <Route path="/fiscale/deduzioni" element={<RequireTitolare><DeduzioniFiscali /></RequireTitolare>} />
        <Route path="/fiscale/deducibilita" element={<RequireTitolare><Deducibilita /></RequireTitolare>} />
        <Route path="/fiscale/strumenti" element={<RequireTitolare><CatalogoStrumenti /></RequireTitolare>} />
        <Route path="/fiscale/simulatore" element={<RequireTitolare><SimulatoreFiscale /></RequireTitolare>} />
        <Route path="/fiscale/previsioni" element={<RequireTitolare><Previsioni /></RequireTitolare>} />
        <Route path="/fiscale/previsioni/nuova" element={<RequireTitolare><PrevisioneForm /></RequireTitolare>} />
        <Route path="/fiscale/previsioni/:id/modifica" element={<RequireTitolare><PrevisioneForm /></RequireTitolare>} />
        <Route path="/fiscale/previsioni/:id" element={<RequireTitolare><PrevisioneDettaglio /></RequireTitolare>} />
        <Route path="/fiscale/andamento" element={<RequireTitolare><AndamentoMensile /></RequireTitolare>} />
        <Route path="/fiscale/chiusura-anno" element={<RequireTitolare><ChiusuraAnnuale /></RequireTitolare>} />

        {/* Personale & Buste Paga (solo titolare — §4 mod. 11) */}
        <Route path="/personale" element={<RequireTitolare><PersonaleHome /></RequireTitolare>} />
        <Route path="/personale/mance" element={<RequireTitolare><Mance /></RequireTitolare>} />
        <Route path="/personale/:id" element={<RequireTitolare><DipendenteDetail /></RequireTitolare>} />

        {/* Archivio Documenti (solo titolare — §3.13) */}
        <Route path="/documenti" element={<RequireTitolare><ArchivioDocumentiHome /></RequireTitolare>} />
        {/* Prima di /documenti/:id, altrimenti "posta" verrebbe letto come un id. */}
        <Route path="/documenti/posta" element={<RequireTitolare><PostaInArrivo /></RequireTitolare>} />
        <Route path="/documenti/chiedi" element={<RequireTitolare><ChiediArchivio /></RequireTitolare>} />
        {/* Schermata usa-e-getta: prova della dettatura in cucina prima di
            comprare qualunque microfono. Da togliere dopo la decisione. */}
        <Route path="/documenti/:id" element={<RequireTitolare><DocumentoDetail /></RequireTitolare>} />

        {/* Editor Menu Cartaceo (solo titolare — i menu sono titolare-only) */}
        <Route path="/editor-menu" element={<RequireTitolare><EditorMenuHome /></RequireTitolare>} />
        <Route path="/editor-menu/giorno" element={<RequireTitolare><PiattiDelGiorno /></RequireTitolare>} />
        <Route path="/editor-menu/bevande" element={<RequireTitolare><BevandeVini /></RequireTitolare>} />

        {/* Agricolo / Orto (solo titolare — §1) */}
        <Route path="/agricolo" element={<RequireTitolare><AgricoloHome /></RequireTitolare>} />
        <Route path="/agricolo/cessioni" element={<RequireTitolare><Cessioni /></RequireTitolare>} />

        {/* Placeholder degli altri moduli — bloccati per modulo (staffVisible) */}
        <Route path="/moduli/:moduleId" element={<ModulePlaceholderGuarded />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Sopra le rotte, non dentro il Layout: vale anche sulle Comande
            e sulla pagina pubblica, che il Layout non lo usano. */}
        <SegnaleDatabase />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
