// =====================================================================
// IL RITORNO DA MEMO VOCE — le regole pure (11/09/2026)
// =====================================================================
// 🔴 IL MANDATO: MEMO voce si apre da qualunque modulo, e quando si è
//    finito — o si è cambiato idea — si torna **dove si era**. Senza,
//    dettare una cosa dalla Cassa voleva dire: menu, MEMO, parlare, menu,
//    Cassa. Cinque tocchi per una frase.
//
// ⚠️ STANNO QUI E NON NEL COMPONENTE per la ragione di sempre: una regola
//    dentro una schermata si prova solo aprendo quella schermata.
//
// ⚠️ DELLA SCHERMATA DI PARTENZA SI PORTA DIETRO SOLO L'INDIRIZZO. Non il
//    modulo come «contesto» per la voce: se partendo dall'Agenda MEMO
//    capisse di più «promemoria», la stessa frase detta dalla Cassa
//    diventerebbe un'altra cosa — cioè le azioni vocali cambierebbero
//    significato a seconda di dove si è premuto. Il mandato lo vieta
//    esplicitamente, ed è anche la regola che rende MEMO prevedibile.

/** Dove vive MEMO voce. Scritto una volta sola. */
export const INDIRIZZO_MEMO = "/detta";

const percorsoDi = (indirizzo) => String(indirizzo).split(/[?#]/)[0];

/** L'indirizzo è MEMO voce stesso? */
export function eMemo(pathname) {
  const p = percorsoDi(pathname ?? "");
  return p === INDIRIZZO_MEMO || p.startsWith(`${INDIRIZZO_MEMO}/`);
}

/**
 * Un indirizzo a cui si può tornare, oppure `null`.
 *
 * 🔴 SOLO INDIRIZZI DI QUESTO GESTIONALE. Il valore viaggia nello stato
 * della cronologia del browser, che una pagina qualunque può riempire:
 * un «torna a» che accettasse `//altro-sito` o `https://…` porterebbe
 * fuori dal gestionale con un tocco che sembra innocuo.
 *
 * ⚠️ E MAI MEMO STESSO, né la pagina d'ingresso: «torna in MEMO» da MEMO
 * sarebbe un pulsante che non fa niente, e tornare al login dopo aver
 * dettato vorrebbe dire uscire.
 */
export function origineValida(da) {
  if (typeof da !== "string") return null;
  const d = da.trim();
  if (!d.startsWith("/") || d.startsWith("//") || d.includes("\\")) return null;
  if (eMemo(d)) return null;
  if (percorsoDi(d) === "/login") return null;
  return d;
}

/**
 * Lo stato da consegnare al collegamento verso MEMO, partendo da qui.
 *
 * ⚠️ SE SI È GIÀ IN MEMO, LA PARTENZA NON SI PERDE: si riconsegna quella
 * che c'era. Senza, toccare «MEMO voce» nel menu mentre si è già dentro
 * cancellerebbe il ritorno — un tocco innocuo che toglie una strada.
 */
export function statoVersoMemo(location) {
  const { pathname = "", search = "", state = null } = location ?? {};
  if (eMemo(pathname)) {
    const gia = origineValida(state?.da);
    return gia ? { da: gia } : null;
  }
  const da = origineValida(`${pathname}${search}`);
  return da ? { da } : null;
}

/**
 * Il nome della schermata di partenza, per dire dove si torna.
 *
 * ⚠️ Si prende dall'elenco dei moduli e non da una mappa scritta qui: il
 * giorno che nasce un modulo nuovo, una mappa qui dentro direbbe «la
 * schermata di prima» senza che nessuno se ne accorga. Vince la rotta più
 * lunga che combacia, perché le rotte si annidano.
 */
export function nomeDellaPartenza(da, moduli = []) {
  const ok = origineValida(da);
  if (!ok) return null;
  const p = percorsoDi(ok);
  if (p === "/" || p === "/dashboard") return "Dashboard";
  const voci = [];
  for (const m of moduli ?? []) {
    if (m?.route) voci.push({ route: m.route, nome: m.name });
    for (const porta of m?.porte ?? []) voci.push({ route: porta.a, nome: porta.nome });
  }
  const trovata = voci
    .filter((v) => p === v.route || p.startsWith(`${v.route}/`))
    .sort((a, b) => b.route.length - a.route.length)[0];
  return trovata?.nome ?? null;
}

/**
 * Le parole del ritorno, oppure `null` se non si è arrivati da nessuna parte.
 *
 * ⚠️ «Torna IN …» e non «torna A …»: con i nomi dei moduli la preposizione
 * articolata cambia ogni volta (all'Agenda, al Magazzino, alle Comande),
 * e sbagliarla su una riga che si legge venti volte al giorno si nota.
 * «In» regge tutti i nomi, compreso «in Dashboard».
 */
export function ritornoDaMemo(da, moduli = []) {
  const ok = origineValida(da);
  if (!ok) return null;
  const nome = nomeDellaPartenza(ok, moduli);
  return {
    da: ok,
    nome,
    frase: nome ? `Torna in ${nome}` : "Torna alla schermata di prima",
    // ⚠️ Mentre il microfono è acceso lo stesso tocco ANNULLA: si dice,
    //    perché chi lo preme deve sapere che quello che ha detto non parte.
    annulla: nome ? `Annulla e torna in ${nome}` : "Annulla e torna alla schermata di prima",
  };
}
