/**
 * Il lettore delle fatture elettroniche (FatturaPA, il formato dello SdI).
 *
 * Una fattura d'acquisto arriva come XML, quasi sempre FIRMATO: il file
 * `.xml.p7m` è una busta CMS (PKCS#7) con dentro l'XML intatto. Si
 * scarica dal portale «Fatture e Corrispettivi» dell'Agenzia delle Entrate
 * o dal servizio di ricezione (Aruba). Come il flusso CBI, è un formato
 * STRUTTURATO: numero, data, importi e partita IVA si leggono dai loro
 * campi, senza nessun modello e senza la possibilità di leggere male una
 * cifra — che è tutta la differenza rispetto a una foto o a un PDF.
 *
 * ⚠️ «SI FERMA O CONTINUA ZITTO?» — si ferma su ciò che rende la fattura
 * inutilizzabile (manca il numero, un importo non si legge, è una nota di
 * credito che qui non si sa ancora registrare), e DICHIARA ciò che è
 * strano ma non sbagliato (il totale che non è imponibile + imposta, di
 * solito per una marca da bollo o un arrotondamento): `errori` blocca,
 * `avvisi` si mostra accanto a ciò che si sta per confermare.
 *
 * ⚠️ La firma NON si verifica: si estrae il contenuto e basta. Verificarla
 * vorrebbe la catena dei certificati, e il documento è già passato dallo
 * SdI, che la firma l'ha controllata prima di consegnarlo. Lo si dice qui
 * perché nessuno legga «p7m aperto» come «firma valida».
 *
 * Le posizioni dei campi sono quelle dello schema FPR12 v1.2, provate il
 * 24/10/2026 su una fattura vera ricevuta dal locale (non nel repository:
 * il repository è pubblico).
 */

// --- la busta firmata ----------------------------------------------------

/** Legge un'intestazione TLV (BER/DER) a partire da `pos`. */
function tlv(b, pos) {
  if (pos + 2 > b.length) throw new Error("busta troncata");
  const tag = b[pos];
  let p = pos + 1;
  if ((tag & 0x1f) === 0x1f) {
    // Tag su più byte: nelle buste CMS non capita, ma non si legge storto.
    while (p < b.length && b[p] & 0x80) p++;
    p++;
  }
  let len = b[p++];
  let indefinita = false;
  if (len === 0x80) {
    indefinita = true;
    len = null;
  } else if (len & 0x80) {
    const n = len & 0x7f;
    if (n > 4 || p + n > b.length) throw new Error("lunghezza illeggibile");
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + b[p++];
  }
  return { tag, costruito: (tag & 0x20) !== 0, inizio: p, len, indefinita };
}

/** Fine di un elemento (salta anche quelli a lunghezza indefinita). */
function fine(b, el) {
  if (!el.indefinita) {
    const f = el.inizio + el.len;
    if (f > b.length) throw new Error("busta troncata");
    return f;
  }
  let p = el.inizio;
  while (!(b[p] === 0 && b[p + 1] === 0)) {
    if (p >= b.length) throw new Error("busta troncata");
    p = fine(b, tlv(b, p));
  }
  return p + 2;
}

/** I figli diretti di un elemento costruito. */
function figliTlv(b, el) {
  const out = [];
  let p = el.inizio;
  const limite = el.indefinita ? b.length : el.inizio + el.len;
  while (p < limite) {
    if (el.indefinita && b[p] === 0 && b[p + 1] === 0) break;
    const f = tlv(b, p);
    out.push(f);
    p = fine(b, f);
  }
  return out;
}

/** Il contenuto di un OCTET STRING, anche spezzato in pezzi (BER). */
function ottetti(b, el) {
  if (!el.costruito) return b.subarray(el.inizio, el.inizio + el.len);
  const pezzi = figliTlv(b, el).map((f) => ottetti(b, f));
  const tot = pezzi.reduce((s, x) => s + x.length, 0);
  const out = new Uint8Array(tot);
  let o = 0;
  for (const x of pezzi) {
    out.set(x, o);
    o += x.length;
  }
  return out;
}

function decodificaBase64(testo) {
  const pulito = testo.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(pulito);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Dal file scaricato all'XML della fattura.
 *
 * Accetta l'XML in chiaro, il `.p7m` binario e il `.p7m` in base64 (alcuni
 * servizi lo consegnano così). Solleva un errore leggibile se il file non
 * è nessuna delle tre cose.
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function xmlDaFile(bytes) {
  let b = bytes;
  const testoIniziale = new TextDecoder("utf-8").decode(b.subarray(0, 64)).replace(/^﻿/, "").trimStart();
  if (testoIniziale.startsWith("<")) return new TextDecoder("utf-8").decode(b).replace(/^﻿/, "");
  if (b[0] !== 0x30) {
    // Non è DER: forse base64.
    try {
      b = decodificaBase64(new TextDecoder("ascii").decode(b));
    } catch {
      throw new Error("Il file non è una fattura elettronica: né XML né busta firmata (.p7m).");
    }
    if (b[0] !== 0x30) throw new Error("Il file non è una fattura elettronica: né XML né busta firmata (.p7m).");
  }
  try {
    // ContentInfo ::= SEQUENCE { contentType OID, [0] EXPLICIT SignedData }
    const ci = figliTlv(b, tlv(b, 0));
    const signedData = figliTlv(b, figliTlv(b, ci[1])[0]);
    // SignedData ::= SEQUENCE { version, digestAlgorithms, encapContentInfo, … }
    const encap = figliTlv(b, signedData[2]);
    // EncapsulatedContentInfo ::= SEQUENCE { eContentType, [0] EXPLICIT OCTET STRING }
    const contenuto = ottetti(b, figliTlv(b, encap[1])[0]);
    const xml = new TextDecoder("utf-8").decode(contenuto).replace(/^﻿/, "");
    if (!xml.trimStart().startsWith("<")) throw new Error("contenuto non XML");
    return xml;
  } catch {
    throw new Error("La busta firmata (.p7m) non si apre: il file potrebbe essere rovinato o incompleto.");
  }
}

// --- l'XML ----------------------------------------------------------------

/** I figli diretti con quel nome locale (lo spazio dei nomi varia fra file). */
function figli(el, nome) {
  return el ? Array.from(el.children).filter((c) => c.localName === nome) : [];
}

/** Il primo discendente lungo un percorso «A/B/C». */
function nodo(el, percorso) {
  let cur = el;
  for (const pezzo of percorso.split("/")) {
    cur = figli(cur, pezzo)[0];
    if (!cur) return null;
  }
  return cur;
}

function testo(el, percorso) {
  const n = percorso ? nodo(el, percorso) : el;
  const t = n?.textContent?.replace(/\s+/g, " ").trim();
  return t ? t : null;
}

/**
 * «4941.00» → 494100. Due decimali al massimo (è ciò che lo schema
 * ammette per i totali); null se non è un importo.
 */
export function centesimiDecimale(s) {
  if (s == null) return null;
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(s).trim());
  if (!m) return null;
  const c = Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0"));
  return m[1] ? -c : c;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * I tipi di documento che il gestionale sa registrare come fattura
 * d'acquisto. Gli altri si fermano con una frase: una nota di credito
 * registrata come fattura farebbe crescere il debito invece di ridurlo.
 */
export const TIPI_REGISTRABILI = {
  TD01: "Fattura",
  TD02: "Acconto o anticipo su fattura",
  TD06: "Parcella",
  TD24: "Fattura differita",
  TD25: "Fattura differita (triangolazione)",
};

const TIPI_NON_GESTITI = {
  TD04: "è una nota di credito: per ora va registrata a mano dalla fattura che corregge",
  TD05: "è una nota di debito: per ora va registrata a mano",
  TD03: "è un acconto su parcella: per ora va registrata a mano",
};

function soggetto(el) {
  if (!el) return null;
  const ana = nodo(el, "DatiAnagrafici");
  const paese = testo(ana, "IdFiscaleIVA/IdPaese");
  const codice = testo(ana, "IdFiscaleIVA/IdCodice");
  const denominazione = testo(ana, "Anagrafica/Denominazione")
    ?? ([testo(ana, "Anagrafica/Nome"), testo(ana, "Anagrafica/Cognome")].filter(Boolean).join(" ") || null);
  return {
    denominazione,
    partitaIva: codice ? `${paese ?? ""}${codice}` : null,
    codiceFiscale: testo(ana, "CodiceFiscale"),
    email: testo(el, "Contatti/Email"),
  };
}

function euro(c) {
  return `${(c / 100).toFixed(2).replace(".", ",")} €`;
}

/**
 * Legge l'XML di una fattura elettronica. Un file può contenere più
 * fatture (un «lotto»: stesso fornitore, più corpi): ognuna è una voce.
 *
 * @param {string} xml
 * @param {{ parseFromString(s: string, t: string): Document }} [parser]
 * @returns {{ fatture: object[], errori: string[] }}
 *   Importi in centesimi. Ogni fattura ha i suoi `errori` (bloccano) e
 *   `avvisi` (si mostrano); `errori` in cima riguarda il file intero.
 */
export function leggiFatturaPA(xml, parser = new DOMParser()) {
  const doc = parser.parseFromString(String(xml ?? ""), "application/xml");
  const radice = doc.documentElement;
  if (!radice || radice.localName !== "FatturaElettronica" || doc.getElementsByTagName("parsererror").length) {
    return { fatture: [], errori: ["Il file non è una fattura elettronica (manca «FatturaElettronica»)."] };
  }
  const testa = figli(radice, "FatturaElettronicaHeader")[0];
  const corpi = figli(radice, "FatturaElettronicaBody");
  if (!testa || corpi.length === 0) {
    return { fatture: [], errori: ["La fattura elettronica è incompleta: manca l'intestazione o il corpo."] };
  }
  const fornitore = soggetto(nodo(testa, "CedentePrestatore"));
  const cliente = soggetto(nodo(testa, "CessionarioCommittente"));
  const errori = [];
  if (!fornitore?.partitaIva && !fornitore?.codiceFiscale) {
    errori.push("Il fornitore non ha né partita IVA né codice fiscale.");
  }
  if (!fornitore?.denominazione) errori.push("Il fornitore non ha un nome.");

  const fatture = corpi.map((corpo) => {
    const e = [];
    const a = [];
    const gen = nodo(corpo, "DatiGenerali/DatiGeneraliDocumento");
    const tipo = testo(gen, "TipoDocumento");
    const numero = testo(gen, "Numero");
    const data = testo(gen, "Data");
    const divisa = testo(gen, "Divisa");
    if (!numero) e.push("Manca il numero della fattura.");
    if (!data || !DATA.test(data)) e.push("Manca la data della fattura, o non si legge.");
    if (divisa && divisa !== "EUR") e.push(`La fattura è in ${divisa}: il gestionale registra solo euro.`);
    if (tipo && TIPI_NON_GESTITI[tipo]) e.push(`Il documento ${numero ?? ""} ${TIPI_NON_GESTITI[tipo]}.`.replace("  ", " "));
    else if (!TIPI_REGISTRABILI[tipo]) e.push(`Tipo di documento «${tipo ?? "?"}» non ancora gestito: va registrato a mano.`);

    let imponibile = 0;
    let imposta = 0;
    for (const r of figli(nodo(corpo, "DatiBeniServizi"), "DatiRiepilogo")) {
      const i = centesimiDecimale(testo(r, "ImponibileImporto"));
      const t = centesimiDecimale(testo(r, "Imposta") ?? "0");
      if (i === null || t === null) {
        e.push("Un riepilogo IVA ha un importo che non si legge.");
        continue;
      }
      imponibile += i;
      imposta += t;
    }

    const dichiarato = testo(gen, "ImportoTotaleDocumento");
    let totale = centesimiDecimale(dichiarato);
    if (dichiarato != null && totale === null) e.push("Il totale della fattura non si legge.");
    const arrotondamento = centesimiDecimale(testo(gen, "Arrotondamento")) ?? 0;
    const bollo = centesimiDecimale(testo(gen, "DatiBollo/ImportoBollo")) ?? 0;
    if (dichiarato == null) {
      totale = imponibile + imposta + arrotondamento;
      a.push(`Il fornitore non ha scritto il totale: è calcolato dai riepiloghi IVA (${euro(totale)}).`);
    } else if (totale !== null && totale !== imponibile + imposta + arrotondamento) {
      const differenza = totale - (imponibile + imposta + arrotondamento);
      a.push(
        `Il totale dichiarato (${euro(totale)}) non è imponibile + IVA (${euro(imponibile + imposta)}): differenza ${euro(differenza)}`
        + (bollo && differenza === bollo ? ", pari alla marca da bollo." : "."),
      );
    }

    const scadenze = figli(corpo, "DatiPagamento").flatMap((dp) =>
      figli(dp, "DettaglioPagamento").map((d) => ({
        data: testo(d, "DataScadenzaPagamento"),
        centesimi: centesimiDecimale(testo(d, "ImportoPagamento")),
        modalita: testo(d, "ModalitaPagamento"),
        iban: testo(d, "IBAN"),
      })),
    );
    const daPagare = scadenze.length && scadenze.every((s) => s.centesimi !== null)
      ? scadenze.reduce((s, x) => s + x.centesimi, 0)
      : null;
    if (daPagare !== null && totale !== null && daPagare !== totale) {
      a.push(`Le scadenze di pagamento sommano ${euro(daPagare)}, il totale è ${euro(totale)} (una ritenuta o un pagamento già fatto?).`);
    }

    const righe = figli(nodo(corpo, "DatiBeniServizi"), "DettaglioLinee").map((l) => ({
      descrizione: testo(l, "Descrizione"),
      quantita: testo(l, "Quantita") === null ? null : Number(testo(l, "Quantita")),
      unita: testo(l, "UnitaMisura"),
      prezzoTotale: testo(l, "PrezzoTotale") === null ? null : Number(testo(l, "PrezzoTotale")),
      aliquota: testo(l, "AliquotaIVA") === null ? null : Number(testo(l, "AliquotaIVA")),
    }));

    return {
      tipo,
      tipoNome: TIPI_REGISTRABILI[tipo] ?? null,
      numero,
      data: data && DATA.test(data) ? data : null,
      totaleCentesimi: totale,
      imponibileCentesimi: imponibile,
      impostaCentesimi: imposta,
      daPagareCentesimi: daPagare,
      scadenza: scadenze.map((s) => s.data).filter((d) => d && DATA.test(d)).sort()[0] ?? null,
      scadenze,
      righe,
      fornitore,
      cliente,
      errori: e,
      avvisi: a,
    };
  });

  return { fatture, errori };
}

/**
 * La fattura letta nella forma che il database si aspetta
 * (`registra_fattura_elettronica`): importi in euro, e una nota che dice
 * da dove viene.
 *
 * ⚠️ L'IBAN a cui pagare va nella nota apposta: quando arriva il bonifico,
 * l'abbinamento col movimento della banca lo usa come indizio in più.
 */
export function payloadFattura(f, nomeFile) {
  const ibans = [...new Set(f.scadenze.map((s) => s.iban).filter(Boolean))];
  const note = [
    `Dalla fattura elettronica ${nomeFile}.`,
    ibans.length ? `Da pagare su ${ibans.join(", ")}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const euro = (c) => (c == null ? null : c / 100);
  return {
    tipo: f.tipo,
    numero: f.numero,
    data: f.data,
    scadenza: f.scadenza,
    totale: euro(f.totaleCentesimi),
    imponibile: euro(f.imponibileCentesimi),
    imposta: euro(f.impostaCentesimi),
    file_sdi: nomeFile,
    note,
    fornitore: {
      denominazione: f.fornitore.denominazione,
      partita_iva: f.fornitore.partitaIva,
      codice_fiscale: f.fornitore.codiceFiscale,
      email: f.fornitore.email,
    },
    cliente: { partita_iva: f.cliente?.partitaIva ?? null, codice_fiscale: f.cliente?.codiceFiscale ?? null },
  };
}
