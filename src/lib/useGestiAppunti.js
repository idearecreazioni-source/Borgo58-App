// =====================================================================
// I GESTI SU UN APPUNTO — approvare, buttare, scegliere (11/09/2026)
// =====================================================================
// 🔴 PERCHÉ UN FILE SUO. Fino a oggi questi gesti vivevano soltanto dentro
//    la schermata di MEMO. Il mandato «MEMO affidabile» vuole che si
//    possano fare ANCHE dalla Dashboard: copiarli là avrebbe voluto dire
//    due guardie contro il doppio tocco, due modi di dire «non è stato
//    scritto niente» — e il giorno che uno dei due cambia, l'altro no.
//
// ⚠️ LE REGOLE SONO QUELLE CHE C'ERANO, spostate e non riscritte:
//    · la guardia contro il doppio tocco è SINCRONA (27/08): il secondo
//      tocco non parte nemmeno;
//    · SOLO LA CHIAMATA CHE SCRIVE decide com'è andata (06/09): quello che
//      viene dopo — rileggere la lista — è rimettere a posto la schermata,
//      e se non riesce non trasforma in «fallito» un gesto già riuscito;
//    · l'esito sta SULLA RIGA toccata, non in cima alla pagina (17/08).
//
// 🔴 E LA SECONDA REGOLA ORA VALE ANCHE PER «SCEGLI», dove prima no. La
//    rilettura dopo una scelta stava dentro lo stesso `try` della scelta:
//    se rileggere falliva, una scelta già fatta compariva come «Non è
//    stato scritto niente — riprova». Vedi il riepilogo del mandato.
//
// 🔴 TRE COSE TROVATE DALLA REVISIONE DEL DIFF, curate qui (11/09/2026),
//    ognuna con una prova che era rossa prima della cura:
//    · la guardia si libera solo quando anche la rilettura è tornata —
//      prima si liberava a metà, e fra la scelta e la rilettura un secondo
//      tocco su un altro candidato partiva;
//    · la scelta ha per chiave l'APPUNTO, come l'approvazione. Con la
//      chiave dell'elemento l'esito finiva dove la scheda non guarda: una
//      scelta rifiutata non diceva niente, e la scheda non si spegneva
//      mentre la scelta era in corso;
//    · (la terza, la rilettura che arriva tardi, sta in chi la chiede:
//      `Detta.jsx` e `AppuntiInDashboard.jsx`).

import { useCallback, useRef, useState } from "react";
import { approvaAppunto, scartaAppunto, scegliPerAzione } from "./api/voce";
import { unaVoltaSola } from "./calcoli/voce";

/**
 * @returns `inAzione` (l'appunto in corso), `esiti` (per appunto), e i tre
 *          gesti. Ogni gesto accetta `dopo`: il rinfresco della schermata,
 *          che parte SOLO a gesto riuscito e non ne cambia l'esito.
 */
export function useGestiAppunti() {
  const [inAzione, setInAzione] = useState(null);
  const [esiti, setEsiti] = useState({});
  const guardia = useRef(unaVoltaSola());

  const segna = useCallback((id, esito) => setEsiti((e) => ({ ...e, [id]: esito })), []);

  /**
   * Esegue `scrivi` sotto guardia; `true` se è riuscito.
   *
   * ⚠️ `riuscito` è la parola con cui si segna l'esito: un appunto BUTTATO
   * non è «fatto». Con la stessa parola, per un istante prima che la lista
   * si rilegga, la scheda buttata mostrerebbe «✓ Fatto» sul pulsante di
   * approvazione — cioè direbbe di aver scritto quello che si è appena
   * scartato.
   */
  const sottoGuardia = useCallback(
    async (id, scrivi, dopo, riuscito = "fatta") => {
      if (!guardia.current.prendi(id)) return false;
      setInAzione(id);
      segna(id, { stato: "in_corso" });
      try {
        try {
          await scrivi();
        } catch (e) {
          segna(id, { stato: "fallita", messaggio: e.message });
          return false;
        } finally {
          setInAzione(null);
        }
        // Da qui la scrittura c'è già.
        segna(id, { stato: riuscito });
        try {
          await dopo?.();
        } catch {
          // ⚠️ SILENZIO MOTIVATO: il gesto è riuscito, e questo era solo il
          //    rinfresco di ciò che si vede. Dirlo come un guasto farebbe
          //    credere che non sia andato — e inviterebbe a rifarlo.
        }
        return true;
      } finally {
        // ⚠️ Solo qui, a rilettura tornata: finché la schermata non mostra
        //    com'è andata, un secondo tocco sullo stesso appunto non parte.
        guardia.current.lascia(id);
      }
    },
    [segna],
  );

  const approva = useCallback(
    (appunto, dopo) => sottoGuardia(appunto.id, () => approvaAppunto(appunto.id), dopo),
    [sottoGuardia],
  );

  const butta = useCallback(
    (appunto, dopo) => sottoGuardia(appunto.id, () => scartaAppunto(appunto.id), dopo, "scartata"),
    [sottoGuardia],
  );

  // ⚠️ Si sceglie per un ELEMENTO, ma la chiave è l'APPUNTO che lo contiene:
  //    è lì che la scheda legge l'esito, ed è la stessa chiave
  //    dell'approvazione — le due cose non devono partire insieme sulla
  //    stessa scheda.
  const scegli = useCallback(
    (appunto, elementoId, sceltaId, dopo) =>
      sottoGuardia(appunto.id, () => scegliPerAzione(elementoId, sceltaId), dopo),
    [sottoGuardia],
  );

  return { inAzione, esiti, approva, butta, scegli };
}
