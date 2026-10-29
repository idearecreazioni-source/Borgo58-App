import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eseguiLavoro } from "../../ponte/esegui.mjs";
import { gestionale } from "../../ponte/gestionale.mjs";
import { unGiro } from "../../ponte/ponte.mjs";
import { postHttp, scambioTcp } from "../../ponte/rete.mjs";
import { avviaSimulatore } from "../../ponte/simulatore.mjs";
import { clientAnonimo, clientAutenticato, credenziali, marchio, righeMie } from "./aiuto";

// IL PONTE VERO, CONTRO PROVA E CONTRO L'APPARECCHIO FINTO — 28/10/2026.
//
// Il giro intero come succederà il giorno del collaudo, meno l'apparecchio:
// il titolare preme «Prova di stampa», il ponte (lo stesso codice che girerà
// sul mini-PC, con la sola chiave pubblica e la sua chiave) prende il
// lavoro, lo porta al simulatore, e il gestionale rilegge «Fatto». Poi lo
// stesso con la stampante che ha la carta finita.
const NOME = marchio("TEST-AUTO ponte");
const PORTA = 18000 + (process.pid % 900) * 2 + 101;

const reteVeloce = {
  scambioTcp: (i, p, d, o) => scambioTcp(i, p, d, { ...o, attesaConnessione: 1500, attesaRisposta: 1500 }),
  postHttp: (o) => postHttp({ ...o, attesaConnessione: 1500, attesaRisposta: 1500 }),
};

describe("il ponte dal vivo, su Prova", () => {
  let titolare;
  let mie;
  let disp;
  let g;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    clientAnonimo(); // si ferma da sé se l'indirizzo non è quello di Prova
    mie = righeMie(titolare);
    const { data, error } = await titolare
      .from("dispositivi")
      .insert({ nome: NOME, tipo: "stampante_comande", protocollo: "simulatore", indirizzo: "127.0.0.1", porta: PORTA, reparto: "bar", attivo: true })
      .select("id")
      .single();
    if (error) throw error;
    disp = mie.segna("dispositivi", data.id);
    const k = await titolare.rpc("crea_chiave_ponte", { p_nome: NOME });
    if (k.error) throw k.error;
    mie.segna("chiavi_ponte", k.data.id);
    g = gestionale({ indirizzo: process.env.VITE_SUPABASE_URL, chiavePubblica: process.env.VITE_SUPABASE_ANON_KEY, chiavePonte: k.data.chiave });
  });

  afterAll(async () => {
    await mie?.pulisci();
    await titolare?.auth.signOut({ scope: "local" });
  });

  const giro = () => unGiro(g, { simulatore: true, esegui: (l, o) => eseguiLavoro(l, { ...o, rete: reteVeloce }) });
  const statoDel = async (id) => (await titolare.from("lavori_stampa").select("stato, errore_codice").eq("id", id).single()).data;

  it("battito: il ponte riceve l'apparecchio", async () => {
    const b = await g.battito("prova", "vitest");
    expect(b.dispositivi.map((d) => d.id)).toContain(disp);
  });

  it("«Prova di stampa» → il ponte → il foglio esce → il gestionale legge «stampato»", async () => {
    const s = await avviaSimulatore({ cartella: mkdtempSync(path.join(os.tmpdir(), "b58-ponte-")), portaStampante: PORTA, portaRegistratore: PORTA + 1, silenzioso: true });
    try {
      const r = await titolare.rpc("chiedi_lavoro_dispositivo", { p_dispositivo_id: disp, p_tipo: "prova" });
      expect(r.error).toBeNull();
      await giro();
      expect(await statoDel(r.data)).toEqual({ stato: "stampato", errore_codice: null });
      for (let i = 0; i < 40 && s.fogli.length === 0; i++) await new Promise((ok) => setTimeout(ok, 50));
      expect(s.fogli.some((f) => f.testo.includes("PROVA DI STAMPA"))).toBe(true);
    } finally {
      await s.chiudi();
    }
  });

  it("carta finita → fallito, e l'apparecchio dice «carta finita» nella pagina", async () => {
    const s = await avviaSimulatore({ modo: "carta_finita", cartella: mkdtempSync(path.join(os.tmpdir(), "b58-ponte-")), portaStampante: PORTA, portaRegistratore: PORTA + 1, silenzioso: true });
    try {
      const r = await titolare.rpc("chiedi_lavoro_dispositivo", { p_dispositivo_id: disp, p_tipo: "prova" });
      expect(r.error).toBeNull();
      await giro();
      expect(await statoDel(r.data)).toEqual({ stato: "fallito", errore_codice: "carta_finita" });
      const { data } = await titolare.from("dispositivi").select("ultimo_stato").eq("id", disp).single();
      expect(data.ultimo_stato).toBe("carta_finita");
    } finally {
      await s.chiudi();
    }
  });
});
