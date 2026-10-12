import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import SegnaleDatabase from "./components/SegnaleDatabase";
import PublicReservationForm from "./pages/public/PublicReservationForm";
import InformativaPrivacy from "./pages/public/InformativaPrivacy";

// LE DUE PAGINE PUBBLICHE, SENZA IL GESTIONALE — 11/10/2026.
//
// 🔴 PERCHE' ESISTE: chi apre `/prenota` dal telefono, per strada, scaricava
//    l'intero gestionale (400 kB compressi) per compilare quattro caselle.
//    Deciso da Alessio l'11/10: le pagine che vede un cliente partono da qui,
//    e il resto del gestionale non viene nemmeno chiesto al server.
//
// ⚠️ LE STESSE DUE ROTTE RESTANO ANCHE IN `App.jsx`: chi e' dentro il
//    gestionale e segue un collegamento a `/privacy` non ricarica la pagina,
//    e trova la stessa schermata. Sono gli STESSI componenti, non una copia.
//
// ⚠️ OGNI ALTRO INDIRIZZO, da qui, RICARICA la pagina: e' l'unico modo di
//    arrivare al gestionale, che vive in un altro pezzo di codice. Senza,
//    un collegamento a «/» finirebbe su una pagina bianca.
function Ricarica() {
  useEffect(() => {
    window.location.reload();
  }, []);
  return null;
}

export default function Pubblico() {
  return (
    <BrowserRouter>
      <SegnaleDatabase />
      <Routes>
        <Route path="/prenota" element={<PublicReservationForm />} />
        <Route path="/privacy" element={<InformativaPrivacy />} />
        <Route path="*" element={<Ricarica />} />
      </Routes>
    </BrowserRouter>
  );
}
