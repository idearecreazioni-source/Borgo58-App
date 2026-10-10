// =====================================================================
// LA RICETTA DENTRO UNA PAGINA — la parte pura di `ricetta-da-link`
// 10/10/2026
// =====================================================================
// Una pagina di Clove (e di molti siti di ricette) porta, oltre a cio' che
// si vede, la ricetta in una forma standard pensata per i programmi: un
// blocco `<script type="application/ld+json">` con un oggetto `Recipe`
// (schema.org). Qui si legge SOLO quello: niente intelligenza artificiale,
// niente interpretazione — titolo, porzioni, righe degli ingredienti e
// passaggi, cosi' come la pagina li dichiara. Misurato il 10/10/2026 su una
// ricetta vera: 11 ingredienti gia' separati riga per riga, 9 passaggi.
//
// ⚠️ NIENTE IMPORT E NIENTE RETE, apposta: questo file riceve testo e
//    restituisce dati. Apre la pagina `index.ts`, che sta accanto, e solo
//    verso gli indirizzi che `indirizzoAmmesso` lascia passare.
//
// ⚠️ LE QUANTITA' NON SI LEGGONO QUI. Le righe degli ingredienti escono
//    com'erano scritte («6 g gelatina, in fogli»), e a smontarle e' lo
//    stesso lettore dell'anteprima da testo (`src/lib/calcoli/ricettaDaTesto.js`):
//    una regola sola per dire cosa e' una quantita' e cosa e' un buco.
// =====================================================================

/**
 * Gli unici siti da cui si legge. Un elenco CHIUSO, non «qualunque https»:
 * la funzione gira su un server, e un indirizzo libero le farebbe bussare
 * dove chiunque vuole (anche a indirizzi interni). Un sito nuovo entra qui,
 * con una riga e una prova.
 */
export const SITI_AMMESSI: readonly string[] = Object.freeze(["clove.kitchen", "www.clove.kitchen"]);

/** Quanto puo' essere grande una pagina letta: oltre, non e' una ricetta. */
export const PESO_MASSIMO = 3_000_000;

export type EsitoIndirizzo = { ok: true; url: string } | { ok: false; messaggio: string };

/** L'indirizzo, ripulito dei parametri di tracciamento, se il sito e' ammesso. */
export function indirizzoAmmesso(grezzo: unknown): EsitoIndirizzo {
  if (typeof grezzo !== "string" || grezzo.trim() === "") {
    return { ok: false, messaggio: "Serve il link della ricetta." };
  }
  let u: URL;
  try {
    u = new URL(grezzo.trim());
  } catch {
    return { ok: false, messaggio: "Questo non sembra un link: deve cominciare con https://" };
  }
  if (u.protocol !== "https:") {
    return { ok: false, messaggio: "Il link deve cominciare con https://" };
  }
  if (u.username || u.password || u.port) {
    return { ok: false, messaggio: "Questo link ha una forma che non accetto." };
  }
  const sito = u.hostname.toLowerCase();
  if (!SITI_AMMESSI.includes(sito)) {
    return {
      ok: false,
      messaggio: `Per ora leggo solo le ricette di Clove (clove.kitchen). Questo link è di «${sito}».`,
    };
  }
  // I parametri (utm_source, …) servono a chi condivide, non alla ricetta:
  // via, cosi' lo stesso link letto due volte e' lo stesso riferimento.
  u.search = "";
  u.hash = "";
  return { ok: true, url: u.toString() };
}

export type RicettaLetta = {
  titolo: string | null;
  porzioni: string | null;
  ingredienti: string[];
  passaggi: string[];
  video: string | null;
};

export type EsitoPagina = { ok: true; ricetta: RicettaLetta } | { ok: false; messaggio: string };

const BLOCCO = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function eRicetta(o: unknown): boolean {
  if (!o || typeof o !== "object") return false;
  const tipo = (o as Record<string, unknown>)["@type"];
  return tipo === "Recipe" || (Array.isArray(tipo) && tipo.includes("Recipe"));
}

/** Cerca un oggetto Recipe in un blocco: da solo, in un elenco, o dentro @graph. */
function trovaRicetta(dato: unknown): Record<string, unknown> | null {
  if (Array.isArray(dato)) {
    for (const d of dato) {
      const r = trovaRicetta(d);
      if (r) return r;
    }
    return null;
  }
  if (!dato || typeof dato !== "object") return null;
  if (eRicetta(dato)) return dato as Record<string, unknown>;
  const grafo = (dato as Record<string, unknown>)["@graph"];
  return grafo ? trovaRicetta(grafo) : null;
}

/** Il testo di una pagina ha entita' HTML anche dentro il JSON: si sciolgono le comuni. */
function sciogliEntita(t: string): string {
  return t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function pulito(v: unknown): string | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const t = sciogliEntita(String(v)).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return t === "" ? null : t;
}

/**
 * Il titolo come lo scrive Clove nella pagina: «Panna Cotta al Mandarino
 * Recipe (with video) | Clove». La coda e' del sito, non della ricetta.
 */
export function titoloSenzaCoda(t: string | null): string | null {
  if (!t) return null;
  const senza = t
    .replace(/\s*\|\s*[^|]*$/, "")
    .replace(/\s+Recipe(\s*\(with video\))?\s*$/i, "")
    .trim();
  return senza === "" ? null : senza;
}

function passaggiDi(v: unknown): string[] {
  const fuori: string[] = [];
  const visita = (x: unknown) => {
    if (typeof x === "string") {
      const t = pulito(x);
      if (t) fuori.push(t);
    } else if (Array.isArray(x)) {
      x.forEach(visita);
    } else if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      // HowToSection: un gruppo di passaggi con il suo elenco.
      if (o.itemListElement) visita(o.itemListElement);
      else {
        const t = pulito(o.text) ?? pulito(o.name);
        if (t) fuori.push(t);
      }
    }
  };
  visita(v);
  return fuori;
}

function porzioniDi(v: unknown): string | null {
  if (Array.isArray(v)) {
    for (const x of v) {
      const t = pulito(x);
      if (t) return t;
    }
    return null;
  }
  return pulito(v);
}

function videoDi(v: unknown): string | null {
  const primo = Array.isArray(v) ? v[0] : v;
  if (!primo || typeof primo !== "object") return null;
  const o = primo as Record<string, unknown>;
  return pulito(o.contentUrl) ?? pulito(o.embedUrl) ?? pulito(o.url);
}

/** La ricetta dichiarata nella pagina, o perche' non c'e'. */
export function ricettaDallaPagina(html: string): EsitoPagina {
  if (typeof html !== "string" || html === "") {
    return { ok: false, messaggio: "La pagina è vuota." };
  }
  let ricetta: Record<string, unknown> | null = null;
  for (const m of html.matchAll(BLOCCO)) {
    try {
      ricetta = trovaRicetta(JSON.parse(m[1].trim()));
    } catch {
      // Un blocco malformato non e' una ricetta: si passa al successivo.
      continue;
    }
    if (ricetta) break;
  }
  if (!ricetta) {
    return {
      ok: false,
      messaggio:
        "In questa pagina non trovo una ricetta leggibile. Può essere una ricetta privata, o una pagina che non è una ricetta: copia il testo e usa l'anteprima da testo.",
    };
  }

  const ingredienti = (Array.isArray(ricetta.recipeIngredient) ? ricetta.recipeIngredient : [])
    .map(pulito)
    .filter((t): t is string => t !== null);
  const passaggi = passaggiDi(ricetta.recipeInstructions);

  if (ingredienti.length === 0 && passaggi.length === 0) {
    return {
      ok: false,
      messaggio: "La pagina dichiara una ricetta, ma senza ingredienti e senza passaggi: non c'è niente da importare.",
    };
  }

  return {
    ok: true,
    ricetta: {
      titolo: titoloSenzaCoda(pulito(ricetta.name)),
      porzioni: porzioniDi(ricetta.recipeYield),
      ingredienti,
      passaggi,
      video: videoDi(ricetta.video),
    },
  };
}
