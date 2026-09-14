import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AppuntoDaApprovare from "./AppuntoDaApprovare";
import { appuntiDaApprovare } from "../lib/api/voce";
import { leggi, nonLetto } from "../lib/calcoli/letture";
import { daQuantoAspetta } from "../lib/calcoli/voce";
import { useGestiAppunti } from "../lib/useGestiAppunti";
import { INDIRIZZO_MEMO, statoVersoMemo } from "../lib/calcoli/ritornoMemo";

// =====================================================================
// GLI APPUNTI DA APPROVARE, DALLA DASHBOARD — 11/09/2026
// =====================================================================
// 🔴 IL MANDATO «MEMO AFFIDABILE»: dalla Dashboard si deve poter approvare,
//    correggere o buttare OGNI proposta, senza toccare le altre. Fino a
//    oggi il riquadro era soltanto un collegamento a MEMO: per dire sì a
//    un appuntamento bisognava cambiare schermata.
//
// ⚠️ LA SCHEDA È LA STESSA DI MEMO (`AppuntoDaApprovare`), e anche i gesti
//    (`useGestiAppunti`): una seconda scheda qui mostrerebbe un giorno dati
//    diversi da quelli che poi si scrivono. «Correggere» è la stessa strada
//    di MEMO — «Fallo a mano →», che apre il modulo coi campi già scritti.
//
// ⚠️ SI APRE COL TOCCO, non è aperto da sé. È «la prima schermata che
//    aprirò ogni mattina» (Alessio, 24/08), e dieci schede aperte in cima
//    spingerebbero giù tutto il resto. Chiuso, il riquadro è la stessa riga
//    di prima; aperto, ha tutto quello che serve per decidere.
//
// ⚠️ E L'ELENCO SI LEGGE ALL'APERTURA, non insieme alla mattina: la
//    Dashboard conta gli appunti (una lettura leggera), le schede servono
//    solo a chi le apre.
export default function AppuntiInDashboard({ dettate, onCambiato }) {
  const location = useLocation();
  const [aperto, setAperto] = useState(false);
  const [appunti, setAppunti] = useState(null);
  const { inAzione, esiti, approva, butta, scegli } = useGestiAppunti();

  // 🔴 VINCE LA LETTURA PIÙ RECENTE, NON LA PIÙ VELOCE — trovato dalla
  //    revisione del diff, 11/09/2026. Aprire, chiudere e riaprire mette in
  //    volo due letture: se la prima tornasse per ultima, riporterebbe schede
  //    già approvate o buttate. È la stessa guardia di `ricarica()` in MEMO.
  const giro = useRef(0);
  const rileggi = () => {
    const mio = giro.current + 1;
    giro.current = mio;
    return leggi(appuntiDaApprovare()).then((v) => {
      if (giro.current === mio) setAppunti(v);
    });
  };

  const apriOChiudi = () => {
    const ora = !aperto;
    setAperto(ora);
    if (ora) rileggi();
  };

  // Dopo un gesto RIUSCITO: la lista e il conteggio della mattina.
  const dopo = async () => {
    await rileggi();
    onCambiato?.();
  };

  const quante = dettate?.quante ?? 0;
  const elenco = Array.isArray(appunti) ? appunti : [];

  return (
    <div className="rounded-xl border border-b58-gold bg-b58-gold/10">
      <button
        type="button"
        aria-expanded={aperto}
        onClick={apriOChiudi}
        className="tocco-riga flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left"
      >
        {/* 🔴 SI CONTANO GLI APPUNTI, NON LE RIGHE — SPEC-0013. Il numero lo
            dà il database (`voce_da_guardare`), lo stesso che si trova
            aprendo l'elenco. */}
        <span className="testo-sala text-b58-charcoal">
          <span className="font-medium">{quante === 1 ? "Un appunto" : `${quante} appunti`}</span>{" "}
          {quante === 1 ? "aspetta che tu lo approvi" : "aspettano che tu li approvi"}
          {dettate?.laPiuVecchia > 0 && ` — il più vecchio ${daQuantoAspetta(dettate.laPiuVecchia)}`}
        </span>
        <span aria-hidden="true" className="testo-sala text-b58-terracotta shrink-0">
          {aperto ? "▲" : "▼"}
        </span>
      </button>

      {aperto && (
        <div className="border-t border-b58-gold/40 px-4 py-3">
          {appunti === null ? (
            <p className="testo-sala text-b58-charcoal-soft">Sto leggendo gli appunti…</p>
          ) : nonLetto(appunti) ? (
            // ⚠️ Non letto non è «nessuno»: si dice, con la via per riprovare.
            <p className="testo-sala text-b58-terracotta-dark">
              Non sono riuscito a leggere gli appunti.{" "}
              <button type="button" onClick={rileggi} className="tocco-inline underline">
                Riprova
              </button>
            </p>
          ) : elenco.length === 0 ? (
            <p className="testo-sala text-b58-charcoal-soft">Non ne aspetta più nessuno.</p>
          ) : (
            <ul className="space-y-3">
              {elenco.map((a) => (
                <AppuntoDaApprovare
                  key={a.id}
                  appunto={a}
                  occupato={inAzione === a.id}
                  esito={esiti[a.id]}
                  onApprova={() => approva(a, dopo)}
                  onScarta={() => butta(a, dopo)}
                  onScegli={(elementoId, sceltaId) => scegli(a, elementoId, sceltaId, dopo)}
                />
              ))}
            </ul>
          )}
          <Link
            to={INDIRIZZO_MEMO}
            state={statoVersoMemo(location)}
            className="tocco-riga mt-3 inline-flex items-center rounded-lg px-2 -mx-1 testo-sala text-b58-terracotta hover:underline"
          >
            Apri MEMO voce →
          </Link>
        </div>
      )}
    </div>
  );
}
