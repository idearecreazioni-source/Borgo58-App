// =====================================================================
// IL TELAIO DELLA VIA D'USCITA A MANO — 27/08/2026
// =====================================================================
//
// 🔴 DECISIONE DI ALESSIO, sue parole: *«se ti dico segna trenta euro
//    pagati al fornitore, mi aspetto che un collegamento mi porti dove si
//    segnano le spese, coi campi noti già compilati, e io aggiungo solo il
//    nome del fornitore che ho omesso»*.
//
// 🔴 PERCHÉ UN TELAIO E NON DIECI VOLTE LO STESSO LAVORO. Le schermate
//    dove si può finire a mano una cosa detta sono **dieci**, misurate una
//    per una. Insegnarne una sola ricreerebbe l'incoerenza appena tolta
//    dalla lista della spesa; insegnarle dieci volte a mano vuol dire che
//    l'undicesima verrà dimenticata. È la stessa forma del ritorno alla
//    Dashboard, curato in UN punto per diciotto moduli: *quando lo stesso
//    lavoro si ripete, il lavoro è uno solo fatto nel posto sbagliato*.
//
// COSA COSTA A UNA SCHERMATA, per intero:
//   const venuto = useDaVoce((campi) => setForm((f) => ({ ...f, ...campi })));
//   … <StriscaDallaVoce venuto={venuto} /> in cima …
//   … await venuto.chiudi(); dopo che il salvataggio è RIUSCITO …
//
// ⚠️ QUELLO CHE QUESTO FILE NON DECIDE: dove si va e quali campi. Vive nel
//    database (`azione_percorso`, `azione_campi`), perché è l'unico posto
//    da cui una verifica può accorgersi che un tipo nuovo è rimasto senza
//    via d'uscita — ed è esattamente com'è nato, il 27/08, il buco dei
//    quattro tipi accesi che nessuno sapeva eseguire.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { azioneAMano, chiudiAMano } from "./api/voce";
import { PARAMETRO } from "./calcoli/aMano";

/**
 * La schermata è stata aperta per finire a mano una cosa detta a voce?
 *
 * @param applica riceve i campi già capiti, UNA VOLTA SOLA.
 *
 * ⚠️ **Una volta sola**, ed è la trappola del 12/08: una schermata che
 * riapplica i valori a ogni giro butterebbe via quello che si sta
 * scrivendo. Qui si riempie la partenza e poi non si tocca più niente.
 *
 * ⚠️ E se la lettura fallisce **non si finge**: `errore` viene riempito e
 * la striscia lo dice, invece di aprire un modulo vuoto che sembra
 * normale. Un modulo che doveva essere pieno e non lo è, senza spiegazione,
 * si legge «il gestionale non aveva capito niente».
 */
export function useDaVoce(applica) {
  const [parametri] = useSearchParams();
  const id = parametri.get(PARAMETRO);

  const [azione, setAzione] = useState(null);
  const [errore, setErrore] = useState("");
  const [chiusa, setChiusa] = useState(false);

  // ⚠️ La funzione arriva nuova a ogni render: tenerla in un riferimento
  //    evita di rifare la lettura a ogni giro senza obbligare chi la usa a
  //    ricordarsi di `useCallback` — e una regola che si può dimenticare è
  //    una regola che verrà dimenticata.
  const fn = useRef(applica);
  fn.current = applica;
  const applicato = useRef(false);

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    azioneAMano(id)
      .then((a) => vivo && setAzione(a))
      .catch((e) => vivo && setErrore(e.message));
    return () => {
      vivo = false;
    };
  }, [id]);

  useEffect(() => {
    if (!azione || applicato.current) return;
    applicato.current = true;
    const campi = azione.campi;
    if (campi && Object.keys(campi).length > 0) fn.current?.(campi);
  }, [azione]);

  /**
   * Da chiamare DOPO che il salvataggio è riuscito, mai prima.
   *
   * 🔴 Se si chiamasse prima, un salvataggio fallito lascerebbe la riga
   * chiusa e la cosa non fatta: sparirebbe dall'elenco senza essere mai
   * successa — che è il difetto opposto, e peggiore.
   */
  const chiudi = useCallback(async () => {
    if (!id || chiusa) return;
    if (azione && azione.da_finire === false) return;
    try {
      await chiudiAMano(id);
      setChiusa(true);
    } catch (e) {
      setErrore(e.message);
    }
  }, [id, azione, chiusa]);

  return { id, azione, errore, chiusa, chiudi, cePer: Boolean(id) };
}
