import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Logo from "./Logo";
import AvvisoLettureTagliate from "./AvvisoLettureTagliate";

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  // Sulla Dashboard il ritorno alla Dashboard non serve.
  const inCasa = pathname === "/" || pathname === "/dashboard";

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
      {/* Sidebar desktop/tablet */}
      <aside className="hidden lg:block lg:w-64 shrink-0 border-r border-b58-charcoal/10 print:hidden">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
      </aside>

      {/* Sidebar mobile (overlay) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-72 h-full shadow-xl">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
          <button
            aria-label="Chiudi menu"
            className="flex-1 bg-b58-charcoal/40"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar mobile */}
        <header className="lg:hidden print:hidden flex items-center justify-between px-4 py-3 border-b border-b58-charcoal/10 bg-b58-parchment">
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
          <button
            aria-label="Apri menu"
            onClick={() => setMobileOpen(true)}
            className="tocco-bottone inline-flex items-center justify-center rounded-lg text-b58-charcoal hover:bg-b58-cream-dark"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          {/* Sopra ogni schermata: se una lettura e tornata a meta, chi guarda
              deve saperlo prima di leggere i numeri, non dopo. */}
          <AvvisoLettureTagliate />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
