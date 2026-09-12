import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { lasciaPerdereRegistrazione, registrazioneInCorso } from "../lib/registrazioneInCorso";
import Sidebar from "./Sidebar";
import Logo from "./Logo";
import AvvisoLettureTagliate from "./AvvisoLettureTagliate";
import RipresaBozza from "./RipresaBozza";
import AvvisoAggiornamento from "./AvvisoAggiornamento";
import ApriMemo from "./ApriMemo";

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  // Sulla Dashboard il ritorno alla Dashboard non serve.
  const inCasa = pathname === "/" || pathname === "/dashboard";
  // Le Comande sono una postazione touch a sé (§3.2.1 del brief): le
  // larghezze lì dentro sono calibrate sul tablet di sala (vedi il
  // commento su `max-w-3xl` in Sala.jsx), non su un monitor da ufficio.
  // Il telaio desktop qui sotto non deve toccarle.
  const isComande = pathname === "/comande" || pathname.startsWith("/comande/");

  // 🔴 A MICROFONO ACCESO IL MENU CHIEDE PRIMA DI CAMBIARE PAGINA — 12/09/2026,
  //    mandato notturno, blocco C (dal collaudo sull'iPhone). Cambiare pagina
  //    chiude MEMO, e quello che si era detto spariva in silenzio: né mandato
  //    né conservato. Adesso il tocco su una voce del menu (o su «Esci») si
  //    ferma e chiede — «Continua a registrare» oppure «Lascia perdere e
  //    vai». Il menu NON annulla e NON manda niente da solo.
  //    ⚠️ Si controlla AL TOCCO e non prima: a microfono spento il menu
  //       funziona esattamente come sempre, senza nessuna domanda.
  //    ⚠️ Sta nella fase di cattura: la voce del menu non riceve il tocco,
  //       quindi non naviga e non chiude il menu.
  const navigate = useNavigate();
  const { logout } = useAuth();
  // `da` dice dove si è toccato — il menu del telefono, la barra del
  // computer o la testata (il logo) — perché la domanda compaia lì.
  // ⚠️ IL LOGO CHIEDE ANCHE LUI (decisione di Alessio del 12/09/2026): porta
  //    alla Dashboard, quindi chiude MEMO come una voce del menu.
  const [sospeso, setSospeso] = useState(null); // { da, verso } oppure { da, esci: true }
  const trattieni = (da) => (e) => {
    if (!registrazioneInCorso()) return;
    const el = e.target.closest?.("a[href], [data-esci]");
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    setSospeso(el.matches("[data-esci]") ? { da, esci: true } : { da, verso: el.getAttribute("href") });
  };
  const continua = () => {
    setSospeso(null);
    setMobileOpen(false);
  };
  const lasciaEVai = () => {
    const s = sospeso;
    setSospeso(null);
    setMobileOpen(false);
    lasciaPerdereRegistrazione();
    if (s?.esci) logout();
    else if (s?.verso) navigate(s.verso);
  };
  const avviso = sospeso && (
    <div role="alertdialog" aria-label="Stai registrando" className="mx-3 mb-3 rounded-lg bg-b58-terracotta/10 ring-1 ring-b58-terracotta/30 px-3 py-2">
      <p className="testo-sala text-b58-charcoal">
        <strong>Stai registrando.</strong> Se cambi pagina, quello che hai detto finora non viene
        mandato.
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <button
          type="button"
          onClick={continua}
          className="tocco-bottone rounded-lg bg-b58-charcoal text-b58-parchment testo-sala font-medium px-3"
        >
          Continua a registrare
        </button>
        <button
          type="button"
          onClick={lasciaEVai}
          className="tocco-bottone rounded-lg border border-b58-charcoal/20 text-b58-charcoal testo-sala px-3"
        >
          Lascia perdere e vai
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-b58-cream flex">
      {/* IL MENU SPARISCE FINO A 1024 PUNTI (`lg:`), non piu' a 768 (`md:`).

          🔴 Misurato il 21/08 col mini tablet in verticale di Alessio, che e'
          lo strumento vero del servizio: **768 punti esatti**, cioe' il
          confine di `md:` preso per un punto. Il menu si apriva, si prendeva
          256 punti, e alla sala delle Comande ne restavano ~575 su 768 —
          un quarto dello schermo nella schermata che ne ha piu' bisogno.

          ⚠️ PERCHE' 1024 E NON UN ALTRO NUMERO. E' l'unico che non passa
          vicino a nessuno dei due casi: sta **256 punti sopra** il tablet
          verticale (768) e **256 punti sotto** il portatile piu' stretto in
          commercio (1280). Alzarlo a 1280 lo farebbe rasentare dall'altra
          parte — cioe' rifare lo stesso errore allo specchio.

          ⚠️ Questi tre `lg:` SONO UNA COSA SOLA e vanno insieme: la barra
          fissa, il pannello che scorre da lato, e la riga in alto col
          pulsante. Cambiarne uno solo lascia il gestionale senza modo di
          riaprire il menu — cioe' inutilizzabile sul tablet. */}
      {/* Sidebar desktop/tablet.

          🔴 `xl:w-80` E' UN BREAKPOINT NUOVO, DIVERSO DA QUELLO SOPRA
          (05/09/2026, segnalazione: sidebar troppo stretta su monitor
          1920×1080). I tre `lg:` del commento sopra sono la soglia
          mobile/tablet-vs-desktop e non si toccano. Questo è un secondo
          gradino, solo per schermi da scrivania: **1280 punti** (`xl:`),
          il primo breakpoint di Tailwind sopra il portatile più stretto
          in commercio — resta invariato tutto ciò che sta sotto, tablet
          compreso. Vedi la stessa soglia in index.css per la larghezza
          del contenuto. */}
      <aside className="hidden lg:block lg:w-64 xl:w-80 shrink-0 border-r border-b58-charcoal/10 print:hidden">
        <div className="sticky top-0 h-screen" onClickCapture={trattieni("barra")}>
          {/* L'avviso compare dove si è toccato. */}
          <Sidebar sopra={sospeso?.da === "barra" ? avviso : null} />
        </div>
      </aside>

      {/* Sidebar mobile (overlay)

          🔴 `z-50` E NON `z-40` — 12/09/2026, dal collaudo sull'iPhone. La
          barra fissa di «Premi e parla» (`BarraDelPollice`) è `z-40` e sta
          DOPO nella pagina: a pari livello vince chi viene dopo, quindi da
          MEMO voce la barra passava sopra il menu e ne copriva le ultime
          voci. Il menu aperto deve coprire tutto; chiuso, la barra torna
          com'era. */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-72 h-full shadow-xl" onClickCapture={trattieni("menu")}>
            <Sidebar
              onNavigate={() => setMobileOpen(false)}
              sopra={sospeso?.da === "menu" ? avviso : null}
            />
          </div>
          <button
            aria-label="Chiudi menu"
            className="flex-1 bg-b58-charcoal/40"
            onClick={() => {
              setSospeso(null);
              setMobileOpen(false);
            }}
          />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar mobile */}
        <header
          onClickCapture={trattieni("testata")}
          className="lg:hidden print:hidden flex items-center justify-between px-4 py-3 border-b border-b58-charcoal/10 bg-b58-parchment"
        >
          {/* 🔴 DALLA DASHBOARD NON SI TORNAVA INDIETRO (27/08, visto da
              Alessio col telefono): si tocca una sezione, si arriva nel
              modulo, e in alto a sinistra non c'è niente che riporti a casa.
              Misurato: **18 rotte di primo livello su 18** erano senza.
              ⚠️ LA CURA È UNA SOLA, ED È QUI. Il difetto sta nel layout —
                 cioè in nessuna schermata e in tutte — e curarlo schermata
                 per schermata vorrebbe dire quindici modifiche e la
                 sedicesima dimenticata. È la stessa forma del pulsante del
                 menu, che per lo stesso motivo nessun censimento per
                 schermata aveva visto (22/08).
              ⚠️ E IL BERSAGLIO È IL LOGO, non un'icona in più: era già lì,
                 è dove il pollice arriva, e «il logo riporta a casa» è la
                 cosa che si prova per prima su qualunque schermo. Aggiungere
                 una freccia accanto avrebbe messo due gesti a un centimetro
                 l'uno dall'altro per fare la stessa cosa. */}
          {inCasa ? (
            <Logo size="sm" />
          ) : (
            <Link
              to="/dashboard"
              aria-label="Torna alla schermata iniziale"
              className="tocco-bottone inline-flex items-center gap-1 rounded-lg pr-2 text-b58-charcoal hover:bg-b58-cream-dark"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <Logo size="sm" />
            </Link>
          )}
          {/* 🔴 IL BERSAGLIO CHE NESSUN CENSIMENTO POTEVA VEDERE (22/08,
              trovato da una sessione parallela). Misurava **5,14 × 5,14
              mm** — `p-2` più un'icona da 22 punti — contro un criterio di
              8,50, ed è su **tutte** le schermate.
              ⚠️ Il setaccio del giro delle misure guardava una schermata
              per volta: questo sta nel LAYOUT, cioè in nessuna di quelle
              che apriva e in tutte quelle che mostrava. *Un difetto che
              sta dappertutto non compare in nessun elenco per schermata.*
              ⚠️ E compare **solo sugli schermi stretti** (`lg:hidden`) —
              cioè esattamente sul tablet e sul telefono, dove si tocca col
              dito. Sul computer non c'è. */}
          {/* 🔴 MEMO VOCE DA QUALUNQUE MODULO — 11/09/2026. Qui, e non in
              un pulsante che galleggia sopra la schermata: la testata sta
              FUORI dal contenuto, quindi non copre nessun gesto della
              pagina. Sul computer la stessa porta è la voce «MEMO voce» in
              cima alla barra laterale, che è sempre aperta — e porta con
              sé la stessa partenza (vedi `statoVersoMemo`).
              ⚠️ Lo stacco dal menu è in centimetri veri, come i bersagli:
                 due gesti diversi attaccati si prendono l'uno per l'altro. */}
          <div className="flex items-center" style={{ gap: "calc(var(--pxcm) * 0.3)" }}>
            <ApriMemo />
            <button
              aria-label="Apri menu"
              onClick={() => setMobileOpen(true)}
              className="tocco-bottone inline-flex items-center justify-center rounded-lg text-b58-charcoal hover:bg-b58-cream-dark"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </header>

        {/* La domanda del logo compare subito sotto la testata, dove si è
            appena toccato: il menu in quel momento è chiuso. */}
        {sospeso?.da === "testata" && (
          <div className="lg:hidden print:hidden pt-3">{avviso}</div>
        )}

        {/* 🔴 IL TELAIO DESKTOP (05/09/2026): molte pagine restano incollate
            a `max-w-3xl`/`4xl`/`5xl`/`6xl` anche su un monitor 1920×1080,
            con metà schermo vuoto — e diminuire lo zoom del browser non
            cambia la proporzione, la scala soltanto. La classe
            `contenuto-ampio` (definita in index.css, sotto lo stesso
            `xl:` di 1280 punti usato qui sopra per la sidebar) allarga il
            tetto di quei `max-w-*` SOLO oltre quella soglia: sotto,
            compreso ogni tablet, non cambia niente.
            ⚠️ Le Comande restano fuori (`isComande`): sono calibrate sul
            tablet di sala, non su un monitor da ufficio. */}
        <main
          className={`flex-1 px-4 py-6 md:px-8 md:py-8 ${
            isComande ? "" : "contenuto-ampio"
          }`}
        >
          {/* Sopra ogni schermata: se una lettura e tornata a meta, chi guarda
              deve saperlo prima di leggere i numeri, non dopo. */}
          <AvvisoLettureTagliate />
          <AvvisoAggiornamento />
          <RipresaBozza />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
