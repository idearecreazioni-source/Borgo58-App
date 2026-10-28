// LA SECONDA RETE: IL PONTE RICONTROLLA DA SÉ DOVE PUÒ CHIAMARE — 28/10/2026.
//
// Il database accetta solo indirizzi della rete del locale (vincolo
// `dispositivo_nella_rete_del_locale`, migrazione 20261028000005). Il ponte
// non si fida e rifà lo stesso controllo prima di aprire una connessione:
// se un giorno il vincolo venisse allentato per sbaglio, il mini-PC non
// diventerebbe comunque una porta verso internet o verso i propri servizi.
//
// ⚠️ STESSE REGOLE DEL DATABASE, scritte una seconda volta apposta: è una
//    seconda rete, non una copia da tenere allineata per comodità. Se una
//    delle due cambia, la prova `tests/unita/ponte-sicurezza.test.js` lo
//    deve dire.

const PORTE = {
  escpos_tcp: (p) => p === 9100,
  fpmate_http: (p) => [80, 443, 8008, 8043].includes(p),
  epos_xml_http: (p) => [80, 443, 8008, 8043].includes(p),
  simulatore: (p) => p >= 18000 && p <= 19999,
};

/** I quattro numeri di un indirizzo IPv4 scritto per esteso, o null. */
export function numeriIPv4(testo) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(testo ?? ""));
  if (!m) return null;
  const n = m.slice(1).map(Number);
  if (n.some((x) => x > 255) || m.slice(1).some((x) => x.length > 1 && x.startsWith("0"))) return null;
  return n;
}

/** È un apparecchio della rete del locale? (10/8, 172.16/12, 192.168/16, mai .0 né .255) */
export function nellaReteDelLocale(indirizzo) {
  const n = numeriIPv4(indirizzo);
  if (!n) return false;
  const [a, b, , d] = n;
  if (d === 0 || d === 255) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/**
 * Il ponte può chiamare questo apparecchio? Restituisce `null` se sì,
 * altrimenti la frase che spiega perché no.
 *
 * @param {{protocollo: string, indirizzo: string, porta: number}} d
 * @param {{simulatore?: boolean}} config — l'apparecchio finto si accetta
 *   solo se il ponte è stato avviato per le prove.
 */
export function perchéNonSiChiama(d, { simulatore = false } = {}) {
  const porta = Number(d?.porta);
  const porteGiuste = PORTE[d?.protocollo];
  if (!porteGiuste) return `Questo ponte non sa parlare «${d?.protocollo}».`;
  if (!Number.isInteger(porta) || !porteGiuste(porta)) {
    return `La porta ${d?.porta} non è quella di un apparecchio «${d.protocollo}».`;
  }
  if (d.protocollo === "simulatore") {
    if (!simulatore) return "Questo ponte non è stato avviato per le prove: l'apparecchio finto non si chiama.";
    if (d.indirizzo !== "127.0.0.1") return "L'apparecchio finto sta solo su 127.0.0.1.";
    return null;
  }
  if (!nellaReteDelLocale(d.indirizzo)) {
    return `${d.indirizzo} non è un indirizzo della rete del locale: il ponte non chiama fuori.`;
  }
  return null;
}
