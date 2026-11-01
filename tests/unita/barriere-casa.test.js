import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { eCasa, eProva, PORTA_DB_CASA, REF_PRODUZIONE, REF_PROVA } from "../../scripts/comune.mjs";
import { ambienteDa } from "../../src/lib/ambiente";
import {
  CLOUD,
  FUNZIONI_DI_CASA,
  RICONOSCITORI,
  nomiDelCloud,
  rigaDelRuntime,
  soloLErrore,
  sqlBloccoDelCloud,
} from "../../scripts/casa-comune.mjs";

// 🔴 LE BARRIERE A TRE DATABASE (31/10/2026). Con «Casa», la copia
// personale di Alessio sul suo PC, i database veri diventano due: il locale
// e Casa. Fino a ieri `soloProva()` fermava solo la produzione, e il
// database di Casa sarebbe passato come «prova» — cioe' `prova:ricostruisci`
// gli avrebbe fatto `drop schema public cascade`.
//
// ⚠️ Scritte AL CONTRARIO dove conta: non basta che passi la stringa giusta,
// deve fermarsi tutto il resto. Una barriera che non guarda niente
// passerebbe la prima meta' di queste prove e nessuna della seconda.

const pooler = (utente) => `postgresql://${utente}:x@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;
const CASA = `postgresql://postgres:postgres@127.0.0.1:${PORTA_DB_CASA}/postgres`;

const tutte = {
  "Prova sul pooler": pooler(`postgres.${REF_PROVA}`),
  "Prova diretta": `postgresql://postgres:x@db.${REF_PROVA}.supabase.co:5432/postgres`,
  "produzione sul pooler": pooler(`postgres.${REF_PRODUZIONE}`),
  "produzione diretta": `postgresql://postgres:x@db.${REF_PRODUZIONE}.supabase.co:5432/postgres`,
  Casa: CASA,
  "Casa con localhost": `postgresql://postgres:postgres@localhost:${PORTA_DB_CASA}/postgres`,
};

describe("eProva: passa solo Prova", () => {
  it("lascia passare Prova, dal pooler e diretta", () => {
    expect(eProva(tutte["Prova sul pooler"])).toBe(true);
    expect(eProva(tutte["Prova diretta"])).toBe(true);
  });

  it("ferma la produzione", () => {
    expect(eProva(tutte["produzione sul pooler"])).toBe(false);
    expect(eProva(tutte["produzione diretta"])).toBe(false);
  });

  it("ferma Casa: e' il caso per cui la barriera e' cambiata", () => {
    expect(eProva(CASA)).toBe(false);
    expect(eProva(tutte["Casa con localhost"])).toBe(false);
  });

  it("ferma Prova nominata solo nella password, nei parametri o su un altro host", () => {
    expect(eProva(`postgresql://postgres:${REF_PROVA}@127.0.0.1:${PORTA_DB_CASA}/postgres`)).toBe(false);
    expect(eProva(`${CASA}?options=${REF_PROVA}`)).toBe(false);
    expect(eProva(`postgresql://postgres.${REF_PROVA}:x@127.0.0.1:${PORTA_DB_CASA}/postgres`)).toBe(false);
  });

  // ⚠️ I casi della revisione ecc:security-reviewer del 31/10: stringhe che
  // qui sembrano Prova e che psql porterebbe altrove.
  it("ferma i parametri in coda che cambiano host, utente o servizio", () => {
    const prova = pooler(`postgres.${REF_PROVA}`);
    for (const coda of ["?host=127.0.0.1&port=54322", "?hostaddr=127.0.0.1", "?user=postgres", "?service=casa"]) {
      expect(eProva(prova + coda), coda).toBe(false);
    }
    expect(eCasa(`${CASA}?host=db.${REF_PRODUZIONE}.supabase.co`)).toBe(false);
  });

  it("lascia passare solo sslmode in coda", () => {
    expect(eProva(`${pooler(`postgres.${REF_PROVA}`)}?sslmode=require`)).toBe(true);
  });

  it("ferma due @ e gli host multipli", () => {
    expect(eProva(`postgresql://postgres:x@127.0.0.1:${PORTA_DB_CASA}@db.${REF_PROVA}.supabase.co:5432/postgres`)).toBe(false);
    expect(
      eProva(`postgresql://postgres.${REF_PROVA}:x@127.0.0.1:${PORTA_DB_CASA},aws-0-eu-west-1.pooler.supabase.com:5432/postgres`)
    ).toBe(false);
  });

  it("ferma il vuoto e cio' che non e' una stringa di collegamento", () => {
    for (const v of ["", undefined, null, "boh", `https://${REF_PROVA}.supabase.co`]) {
      expect(eProva(v)).toBe(false);
    }
  });
});

describe("eCasa: passa solo il database sul PC", () => {
  it("lascia passare Casa", () => {
    expect(eCasa(CASA)).toBe(true);
    expect(eCasa(tutte["Casa con localhost"])).toBe(true);
  });

  it("ferma Prova e la produzione", () => {
    for (const nome of ["Prova sul pooler", "Prova diretta", "produzione sul pooler", "produzione diretta"]) {
      expect(eCasa(tutte[nome]), nome).toBe(false);
    }
  });

  it("ferma un'altra porta del PC e un altro utente", () => {
    expect(eCasa("postgresql://postgres:postgres@127.0.0.1:5432/postgres")).toBe(false);
    expect(eCasa(`postgresql://postgres.${REF_PROVA}:x@127.0.0.1:${PORTA_DB_CASA}/postgres`)).toBe(false);
  });

  it("ferma un altro computer della rete", () => {
    expect(eCasa(`postgresql://postgres:postgres@192.168.1.20:${PORTA_DB_CASA}/postgres`)).toBe(false);
  });
});

describe("nessuna stringa e' insieme Prova e Casa", () => {
  it("le due barriere si escludono a vicenda", () => {
    for (const [nome, url] of Object.entries(tutte)) {
      expect(eProva(url) && eCasa(url), nome).toBe(false);
    }
  });
});

// ⚠️ La barriera serve solo se i comandi la chiamano. Questa parte legge i
// sorgenti: se qualcuno toglie la chiamata da un comando che scrive su
// Prova, diventa rossa. Ogni comando che legge DB_URL_PROVA e ci scrive o
// ci confronta le migrazioni compare qui.
const CHE_DEVONO_CHIAMARLA = [
  "backup-ripristina",
  "censimento-numeri",
  "funzione-viva",
  "migra",
  "numeri-sospetti",
  "prova-base",
  "prova-copia",
  "prova-migra",
  "prova-ricostruisci",
  "prova-ripristina",
  "prova-stato",
  "ricostruzione-verifica",
];

// Chi nomina DB_URL_PROVA senza collegarsi (solo nei messaggi d'aiuto).
const NOMINANO_SENZA_COLLEGARSI = ["chiavi", "comune"];

describe("i comandi su Prova chiamano la barriera", () => {
  for (const nome of CHE_DEVONO_CHIAMARLA) {
    it(nome, () => {
      const testo = readFileSync(`scripts/${nome}.mjs`, "utf8");
      expect(testo).toMatch(/\bsoloProva\(/);
    });
  }

  // ⚠️ L'elenco qui sopra non vede uno script NUOVO: questa prova li cerca
  // tutti. Uno script che legge DB_URL_PROVA e non chiama la barriera la fa
  // diventare rossa finche' non la chiama (o finche' non lo si mette, con
  // una ragione, fra quelli che la nominano soltanto).
  it("nessuno script legge DB_URL_PROVA senza barriera", () => {
    const scoperti = readdirSync("scripts")
      .filter((f) => f.endsWith(".mjs") && !f.includes(".local."))
      .map((f) => f.replace(/\.mjs$/, ""))
      .filter((nome) => !NOMINANO_SENZA_COLLEGARSI.includes(nome))
      .filter((nome) => {
        const testo = readFileSync(`scripts/${nome}.mjs`, "utf8");
        return testo.includes("DB_URL_PROVA") && !/\b(soloProva|eProva)\(/.test(testo);
      });
    expect(scoperti).toEqual([]);
  });
});

// I comandi che lavorano su Casa: la barriera e' quella di Casa, e nessuno
// ha un modo di svuotarla (niente opzioni dalla riga di comando, niente
// `drop schema`).
const DI_CASA = ["casa-costruisci", "casa-pin", "casa-verifica", "casa-accendi", "casa-impacchetta", "casa-copia"];

describe("i comandi di Casa chiamano la barriera di Casa", () => {
  it("casa-comune la chiama, e pretende il contenitore di Casa", () => {
    const testo = readFileSync("scripts/casa-comune.mjs", "utf8");
    expect(testo).toMatch(/=\s*soloCasa\(/);
    expect(testo).toMatch(/export function pretendiCasa\(/);
  });

  for (const nome of DI_CASA) {
    it(nome, () => {
      const testo = readFileSync(`scripts/${nome}.mjs`, "utf8");
      expect(testo).toMatch(/from "\.\/casa-comune\.mjs"/);
      expect(testo).toMatch(/\bpretendiCasa\(\)/);
      expect(testo).not.toMatch(/drop\s+schema|process\.argv/i);
    });
  }
});

describe("i pezzi puri di casa-comune", () => {
  it("dall'errore di psql tiene la spiegazione e butta la riga della SQL", () => {
    const uscita = [
      "psql:<stdin>:3: ERROR:  syntax error at or near \"x\"",
      "LINE 1: select vault.create_secret('parolasegreta', 'notifiche_firma')",
      "                                    ^",
      "DETAIL:  qualcosa",
    ].join("\n");
    const testo = soloLErrore(uscita);
    expect(testo).toContain("ERROR:");
    expect(testo).toContain("DETAIL:");
    expect(testo).not.toContain("parolasegreta");
  });

  it("il blocco nel database scarta tutti e due i progetti del cloud, senza fermare chi chiama", () => {
    const testo = sqlBloccoDelCloud(CLOUD);
    expect(CLOUD).toEqual([REF_PRODUZIONE, REF_PROVA]);
    for (const ref of CLOUD) expect(testo).toContain(ref);
    expect(testo).toMatch(/before insert on net\.http_request_queue/);
    expect(testo).toMatch(/return null;/);
    expect(testo).not.toMatch(/raise exception/);
  });

  it("le porte chiuse coprono anche le funzioni online di ogni progetto", () => {
    for (const ref of CLOUD) {
      expect(nomiDelCloud(CLOUD)).toEqual(expect.arrayContaining([`${ref}.supabase.co`, `${ref}.functions.supabase.co`]));
    }
  });

  it("chi nomina il cloud per riconoscerlo o bloccarlo e' dichiarato con la ragione", () => {
    for (const ragione of Object.values(RICONOSCITORI)) expect(ragione.length).toBeGreaterThan(10);
    expect(Object.keys(RICONOSCITORI)).toContain("funzione casa.niente_cloud");
  });
});

describe("le funzioni di Casa (01/11/2026)", () => {
  // MEMO dal 01/11 sera (decisione di Alessio: la stessa AI del gestionale vero).
  it("sono accese solo operazioni-atomiche e le quattro di MEMO", () => {
    expect(FUNZIONI_DI_CASA).toEqual(["operazioni-atomiche", "ascolta-voce", "leggi-foto", "documento-leggi", "assistente-archivio"]);
  });

  // 🔴 Nell'ambiente del motore la CLI mette anche la chiave service_role e
  // l'indirizzo del database: le funzioni di Casa, che vanno su internet,
  // non devono leggerli. Solo l'indirizzo di Casa, la chiave anon e Claude.
  it("ogni funzione di Casa legge dall'ambiente solo SUPABASE_URL, SUPABASE_ANON_KEY e ANTHROPIC_API_KEY", () => {
    const ammesse = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "ANTHROPIC_API_KEY"];
    for (const nome of FUNZIONI_DI_CASA) {
      for (const f of readdirSync(`supabase/functions/${nome}`, { recursive: true }).filter((x) => /\.(ts|js|mjs)$/.test(x))) {
        const testo = readFileSync(`supabase/functions/${nome}/${f}`, "utf8");
        // Niente letture dell'ambiente intero: sfuggirebbero al controllo.
        expect(testo, `${nome}/${f}`).not.toMatch(/Deno\.env\.toObject|process\.env/);
        for (const [, variabile] of testo.matchAll(/Deno\.env\.get\(\s*([^)]*)\)/g)) {
          expect(ammesse, `${nome}/${f}: ${variabile}`).toContain(variabile.trim().replace(/^["'`]|["'`]$/g, ""));
        }
      }
    }
  });

  // ⚠️ Su Casa si copia solo la cartella della funzione: un import da
  // ../_shared o da un'altra funzione la romperebbe solo li'.
  it("ogni funzione di Casa importa solo dalla sua cartella o da npm", () => {
    for (const nome of FUNZIONI_DI_CASA) {
      const file = readdirSync(`supabase/functions/${nome}`, { recursive: true }).filter((f) => /\.(ts|js|mjs)$/.test(f));
      expect(file.length).toBeGreaterThan(0);
      for (const f of file) {
        const testo = readFileSync(`supabase/functions/${nome}/${f}`, "utf8");
        // Niente import dinamici ne' require: sfuggirebbero al controllo qui sotto.
        expect(testo, `${nome}/${f}`).not.toMatch(/\bimport\s*\(|\brequire\s*\(/);
        const importi = /^\s*(?:import\s+(?:[^"';]*?\bfrom\s*)?|export\s[^"';=]*?\bfrom\s*)["']([^"']+)["']/gm;
        for (const [, da] of testo.matchAll(importi)) {
          // npm: solo Supabase, l'SDK di Claude e fflate (gli zip dei documenti).
          expect(da, `${nome}/${f}`).toMatch(/^(\.\/(?!\.)|npm:@supabase\/|npm:@anthropic-ai\/sdk$|npm:fflate@\d)/);
        }
      }
    }
  });

  it("legge «enabled» solo nella sezione [edge_runtime] di config.toml", () => {
    const toml = ["[analytics]", "enabled = true", "", "[edge_runtime]", "# commento", "enabled = false", "policy = 1", "[x]", "enabled = true"];
    expect(rigaDelRuntime(toml)).toEqual({ indice: 5, acceso: false });
    expect(rigaDelRuntime(["[edge_runtime]\r", "enabled = true\r"])).toEqual({ indice: 1, acceso: true });
    expect(rigaDelRuntime(["[edge_runtime]", "policy = 1", "[analytics]", "enabled = true"])).toBeNull();
    expect(rigaDelRuntime(["[analytics]", "enabled = true"])).toBeNull();
  });
});

describe("il gestionale nel browser riconosce Casa", () => {
  it("con la dichiarazione e un indirizzo che non e' del cloud", () => {
    const a = ambienteDa("https://pc-alessio.esempio.ts.net:8443", "casa");
    expect(a.genere).toBe("casa");
    expect(a.produzione).toBe(false);
  });

  it("senza dichiarazione lo stesso indirizzo resta sconosciuto", () => {
    expect(ambienteDa("https://pc-alessio.esempio.ts.net:8443").genere).toBe("sconosciuto");
  });

  it("la dichiarazione non vince mai sul cloud", () => {
    expect(ambienteDa(`https://${REF_PRODUZIONE}.supabase.co`, "casa").genere).toBe("produzione");
    expect(ambienteDa(`https://${REF_PRODUZIONE}.supabase.co`, "casa").produzione).toBe(true);
    expect(ambienteDa(`https://${REF_PROVA}.supabase.co`, "casa").genere).toBe("prova");
  });

  it("un indirizzo non protetto non vale come Casa", () => {
    expect(ambienteDa("http://192.168.1.20:8443", "casa").genere).toBe("sconosciuto");
  });

  // ⚠️ Due domande diverse: «e' il locale?» (le barriere) e «quello che
  // scrivi e' vero?» (il colore degli avvisi). Casa: vero, ma non il locale.
  it("i dati veri sono quelli del locale e di Casa, e il locale resta uno solo", () => {
    const casa = ambienteDa("https://pc-alessio.esempio.ts.net:8443", "casa");
    expect(casa.datiVeri).toBe(true);
    expect(casa.produzione).toBe(false);
    expect(ambienteDa(`https://${REF_PRODUZIONE}.supabase.co`).datiVeri).toBe(true);
    expect(ambienteDa(`https://${REF_PROVA}.supabase.co`).datiVeri).toBe(false);
    expect(ambienteDa("https://pc-alessio.esempio.ts.net:8443").datiVeri).toBe(false);
  });
});

describe("l'app e il server di Casa", () => {
  const sito = readFileSync("scripts/casa-sito.mjs", "utf8");
  const impacchetta = readFileSync("scripts/casa-impacchetta.mjs", "utf8");

  it("il server ascolta solo sul PC", () => {
    expect(sito).toMatch(/listen\(PORTA_SITO_CASA, "127\.0\.0\.1"/);
  });

  it("il server risponde solo al nome di Casa o al PC stesso", () => {
    expect(sito).toMatch(/if \(!servitoDaCasa\(req\)\)/);
  });

  it("la costruzione dell'app si ferma se dentro c'e' un indirizzo del cloud", () => {
    expect(impacchetta).toMatch(/CLOUD\.filter\(\(ref\) => testo\.includes\(`\$\{ref\}\.supabase\.co`\)\)/);
    expect(impacchetta).toMatch(/VITE_AMBIENTE: "casa"/);
  });

  it("la porta del server sta nel blocco chiuso dal firewall", async () => {
    const { PORTA_SITO_CASA, PORTE_FIREWALL } = await import("../../scripts/casa-comune.mjs");
    const [da, a] = PORTE_FIREWALL.split("-").map(Number);
    expect(PORTA_SITO_CASA).toBeGreaterThanOrEqual(da);
    expect(PORTA_SITO_CASA).toBeLessThanOrEqual(a);
  });
});
