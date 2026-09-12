// =====================================================================
// LE DUE LINEE DELLA SETTIMANA — 12/09/2026, secondo collaudo sull'iPhone
// =====================================================================
// 🔴 COSA SI MISURA. Nella vista Settimana ci sono due linee diverse, e non
//    devono confondersi:
//    · FRA DUE GIORNI: lunga (tutto il riquadro) e discreta;
//    · FRA DUE IMPEGNI dello stesso giorno: corta — comincia dove comincia
//      il titolo, dopo la colonna dell'ora — e un poco più scura; mai prima
//      del primo impegno né dopo l'ultimo; e non aggiunge spazio.
//
// ⚠️ UN FILE SOLO PER DUE GIRI: lo usa la prova visiva del progetto
//    (`scripts/prova-visiva.mjs`) e chiunque apra la vista in un browser
//    vero. `MISURA_LINEE` si valuta nella pagina; `difettiDelleLinee` è
//    pura e dice, in italiano, cosa non torna.

/** Da valutare nella pagina, con la Settimana disegnata. */
export const MISURA_LINEE = `(() => {
  const alfa = (c) => {
    if (!c || c === "transparent") return 0;
    const barra = c.match(/\\/\\s*([0-9.]+%?)\\s*\\)$/);
    if (barra) return barra[1].endsWith("%") ? parseFloat(barra[1]) / 100 : parseFloat(barra[1]);
    const rgba = c.match(/^rgba\\(([^)]+)\\)$/);
    if (rgba) return parseFloat(rgba[1].split(",")[3]);
    return 1;
  };
  const s = document.querySelector("[data-settimana]");
  if (!s) return null;
  const ol = s.querySelector("ol");
  if (!ol) return null;
  const colonne = getComputedStyle(ol).display === "grid";
  const olBox = ol.getBoundingClientRect();
  const pxcm = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pxcm")) || 37.8;
  const giorni = [...ol.children].filter((li) => li.matches("[data-giorno]"));
  // La linea fra due giorni è il bordo di un giorno (sopra o sotto).
  const lineeGiorno = [];
  for (const li of giorni) {
    const c = getComputedStyle(li);
    const b = li.getBoundingClientRect();
    for (const lato of ["Top", "Bottom"]) {
      const spessore = parseFloat(c["border" + lato + "Width"]) || 0;
      if (spessore > 0) lineeGiorno.push({ giorno: li.dataset.giorno, spessore, alfa: alfa(c["border" + lato + "Color"]), sinistra: b.left, destra: b.right, larga: b.width });
    }
  }
  const perGiorno = giorni.map((li) => {
    const righe = [...li.querySelectorAll("ul > li")];
    const impegni = righe.map((r, i) => {
      const bottone = r.querySelector("[data-impegno]");
      const titolo = bottone?.querySelector("[data-titolo]")?.getBoundingClientRect();
      const sep = r.querySelector(":scope > [data-separatore-impegno]");
      const tratto = sep?.lastElementChild?.getBoundingClientRect();
      const bb = bottone?.getBoundingClientRect();
      const contenuto = r.getBoundingClientRect();
      return {
        indice: i,
        separatore: sep
          ? { sinistra: tratto.left, destra: tratto.right, larga: tratto.width, alta: tratto.height, sopra: tratto.top, sotto: tratto.bottom, alfa: alfa(getComputedStyle(sep.lastElementChild).backgroundColor) }
          : null,
        bottone: bb ? { sopra: bb.top, sotto: bb.bottom } : null,
        titoloSinistra: titolo?.left ?? null,
        contenutoDestra: contenuto.right,
      };
    });
    // Un separatore fuori posto: fuori da una riga, o dopo l'ultimo impegno.
    const fuoriPosto = li.querySelectorAll("[data-separatore-impegno]").length - impegni.filter((x) => x.separatore).length;
    return { giorno: li.dataset.giorno, impegni, fuoriPosto };
  });
  return { colonne, pxcm, larghezzaRiquadro: olBox.width, lineeGiorno, perGiorno };
})()`;

// Le soglie, in centimetri veri (si moltiplicano per la densità della
// forma misurata) o come rapporti.
export const SOGLIE_LINEE = {
  // La linea fra impegni deve essere più corta di quella fra giorni di
  // almeno tanto: è la colonna dell'ora, meno qualcosa.
  piuCortaCm: 0.4,
  // «Leggermente» più scura: più opaca di quella fra giorni, ma non oltre
  // due volte e mezza.
  alfaMassimoRapporto: 2.5,
  // La linea fra giorni attraversa il riquadro.
  giornoLungaQuota: 0.9,
};

/** Cosa non torna, in italiano. Vuoto se va tutto bene. */
export function difettiDelleLinee(nome, m) {
  if (!m) return [`${nome}: la settimana non si è disegnata, le linee non si possono misurare.`];
  const d = [];
  const tolleranza = 1.5;
  const alfaGiorno = m.lineeGiorno.length ? Math.max(...m.lineeGiorno.map((l) => l.alfa)) : null;
  const giornoPiuCorta = m.lineeGiorno.length ? Math.min(...m.lineeGiorno.map((l) => l.larga)) : null;
  let separatori = 0;

  if (!m.colonne) {
    if (!m.lineeGiorno.length) d.push(`${nome}: a righe non c'è nessuna linea fra i giorni.`);
    for (const l of m.lineeGiorno) {
      if (l.larga < SOGLIE_LINEE.giornoLungaQuota * m.larghezzaRiquadro) {
        d.push(`${nome}: la linea sotto/sopra il ${l.giorno} è lunga ${l.larga.toFixed(0)} punti su ${m.larghezzaRiquadro.toFixed(0)}: dovrebbe attraversare il riquadro.`);
      }
    }
  }

  for (const g of m.perGiorno) {
    if (g.fuoriPosto > 0) d.push(`${nome}, ${g.giorno}: ${g.fuoriPosto} linee fra impegni fuori posto.`);
    for (const x of g.impegni) {
      if (x.indice === 0 && x.separatore) d.push(`${nome}, ${g.giorno}: c'è una linea prima del primo impegno.`);
      if (x.indice > 0 && !x.separatore) d.push(`${nome}, ${g.giorno}: manca la linea sopra l'impegno ${x.indice + 1}.`);
      if (!x.separatore) continue;
      separatori++;
      const s = x.separatore;
      const prima = g.impegni[x.indice - 1]?.bottone;
      const dopo = x.bottone;
      if (prima && dopo) {
        if (s.sopra < prima.sotto - 0.5 || s.sotto > dopo.sopra + 0.5) {
          d.push(`${nome}, ${g.giorno}: la linea sopra l'impegno ${x.indice + 1} non sta fra i due impegni.`);
        }
        const vuoto = dopo.sopra - prima.sotto;
        if (vuoto > s.alta + 0.5) {
          d.push(`${nome}, ${g.giorno}: fra l'impegno ${x.indice} e il ${x.indice + 1} ci sono ${vuoto.toFixed(1)} punti per una linea di ${s.alta.toFixed(1)}: la linea ha aggiunto spazio.`);
        }
      }
      if (s.alta < 0.5 || s.alta > 1.5) d.push(`${nome}, ${g.giorno}: la linea fra impegni è alta ${s.alta.toFixed(2)} punti.`);
      if (x.titoloSinistra != null && Math.abs(s.sinistra - x.titoloSinistra) > tolleranza) {
        d.push(`${nome}, ${g.giorno}: la linea fra impegni comincia a ${s.sinistra.toFixed(1)}, il titolo a ${x.titoloSinistra.toFixed(1)}: il rientro non segue il testo.`);
      }
      if (s.destra > x.contenutoDestra + tolleranza) d.push(`${nome}, ${g.giorno}: la linea fra impegni esce dal testo a destra.`);
      if (!m.colonne && giornoPiuCorta != null && s.larga > giornoPiuCorta - SOGLIE_LINEE.piuCortaCm * m.pxcm) {
        d.push(`${nome}, ${g.giorno}: la linea fra impegni è lunga ${s.larga.toFixed(0)} punti, quella fra giorni ${giornoPiuCorta.toFixed(0)}: dovrebbe essere più corta di almeno ${SOGLIE_LINEE.piuCortaCm} cm.`);
      }
      if (alfaGiorno != null) {
        if (s.alfa <= alfaGiorno) {
          d.push(`${nome}, ${g.giorno}: la linea fra impegni (opacità ${s.alfa}) non è più marcata di quella fra giorni (${alfaGiorno}).`);
        } else if (s.alfa > alfaGiorno * SOGLIE_LINEE.alfaMassimoRapporto) {
          d.push(`${nome}, ${g.giorno}: la linea fra impegni (opacità ${s.alfa}) è molto più scura di quella fra giorni (${alfaGiorno}), non «leggermente».`);
        }
      }
    }
  }
  if (separatori === 0 && m.perGiorno.some((g) => g.impegni.length > 1)) {
    d.push(`${nome}: ci sono giorni con più impegni e nessuna linea fra loro.`);
  }
  return d;
}
