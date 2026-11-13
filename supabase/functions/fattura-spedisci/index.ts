// Edge Function: fattura-spedisci — la fattura ai clienti parte dalla PEC
// di Borgo 58 verso lo SdI (13/11/2026, pezzo 3 di 5).
//
// Giustificazione (Contratto Architetturale v2, §2): B2 — custodisce la
// password della PEC (Secrets PEC_UTENTE e PEC_PASSWORD), che non può mai
// arrivare al browser. Le scritture nel database restano funzioni Postgres
// (prepara_invio_fattura, chiudi_invio_fattura), chiamate col JWT
// dell'utente REALE: decidono RLS e is_titolare(), non questo file.
//
// IL GIRO, in quest'ordine apposta:
//   1. legge fattura, righe, cliente e società;
//   2. fa il file PRIMA di numerare: se manca un dato si ferma qui, e la
//      bozza non consuma un numero;
//   3. su work, controlla che la password della PEC ci sia — sempre prima
//      di numerare;
//   4. prepara_invio_fattura(): il numero (se è una bozza) e il progressivo
//      dell'invio, nuovo a ogni giro;
//   5. rifà il file col numero vero e lo spedisce. ⚠️ SOLO SU work: su
//      Prova e a casa l'invio è simulato (`ambiente.js`);
//   6. chiudi_invio_fattura(): partito → «inviata»; fallito → resta «da
//      inviare» col suo numero, e il titolare lo sa subito (avviso).
//
// Con { verifica_pec: true } prova solo utente e password della PEC, senza
// mandare niente: è il primo gesto dopo aver messo i Secrets.

import { createClient } from "npm:@supabase/supabase-js@2";
import { esitoVerificaUtente } from "../operazioni-atomiche/sessione.ts";
import { xmlFattura } from "../_shared/fatturaEmessa.js";
import { dialogoSmtp, messaggioConAllegato } from "../_shared/smtp.js";
import { siamoInProduzione } from "./ambiente.js";
import { apriTubo } from "./tubo.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function risposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
const errore = (status: number, codice: string, messaggio: string) =>
  risposta(status, { errore: { codice, messaggio } });

function configurazionePec() {
  return {
    utente: Deno.env.get("PEC_UTENTE") ?? "",
    password: Deno.env.get("PEC_PASSWORD") ?? "",
    host: Deno.env.get("PEC_SMTP_HOST") || "smtps.pec.aruba.it",
    porta: Number(Deno.env.get("PEC_SMTP_PORTA") || 465),
  };
}

const MANCA_PASSWORD =
  "La password della PEC non è ancora nei Secrets di Supabase (PEC_UTENTE e PEC_PASSWORD): " +
  "la fattura NON è stata numerata e non è partita.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return errore(405, "metodo", "Metodo non ammesso");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !supabaseAnon) return errore(500, "config", "Configurazione dell'ambiente mancante");
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return errore(401, "auth", "Autenticazione mancante");

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: utente, error: authError } = await supabase.auth.getUser();
  const esito = esitoVerificaUtente(authError, utente?.user);
  if (esito) return errore(esito.stato, esito.codice, esito.messaggio);

  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return errore(400, "corpo", "Richiesta senza corpo JSON valido");
  }

  const davvero = siamoInProduzione(supabaseUrl);
  const pec = configurazionePec();

  // ---- solo la prova della PEC
  if (corpo?.verifica_pec === true) {
    const { data: titolare } = await supabase.rpc("is_titolare");
    if (titolare !== true) return errore(403, "42501", "Solo il titolare prova la PEC.");
    if (!davvero) {
      return risposta(200, { risultato: { simulato: true, messaggio: "Qui siamo su Prova o a casa: la PEC non si usa." } });
    }
    if (!pec.utente || !pec.password) return errore(500, "pec_config", MANCA_PASSWORD.split(":")[0] + ".");
    let tubo;
    try {
      tubo = await apriTubo(pec.host, pec.porta);
      await dialogoSmtp(tubo, { utente: pec.utente, password: pec.password });
      return risposta(200, { risultato: { simulato: false, messaggio: `La PEC ${pec.utente} risponde e accetta utente e password.` } });
    } catch (e) {
      return errore(502, "pec", (e as Error).message);
    } finally {
      tubo?.chiudi();
    }
  }

  const fatturaId = corpo?.fattura_id;
  if (typeof fatturaId !== "string" || !UUID.test(fatturaId)) {
    return errore(400, "corpo", "Manca la fattura da mandare.");
  }

  // ---- 1. i dati
  const leggi = async () => {
    const { data: f, error: ef } = await supabase
      .from("fatture_emesse")
      .select("*, righe:fatture_emesse_righe(*)")
      .eq("id", fatturaId)
      .maybeSingle();
    if (ef) throw ef;
    if (!f) return null;
    const [{ data: cliente, error: ec }, { data: societa, error: es }] = await Promise.all([
      supabase.from("clienti_fattura").select("*").eq("id", f.cliente_id).maybeSingle(),
      supabase.from("entities").select("*").eq("id", f.entity_id).maybeSingle(),
    ]);
    if (ec) throw ec;
    if (es) throw es;
    return { fattura: f, righe: f.righe ?? [], cliente, societa };
  };

  let dati;
  try {
    dati = await leggi();
  } catch (e) {
    return errore(500, "lettura", `Non riesco a leggere la fattura: ${(e as Error).message}`);
  }
  if (!dati) return errore(404, "P0002", "Questa fattura non c'è (o non è tua da vedere): rileggi la pagina.");
  if (!["bozza", "da_inviare", "scartata"].includes(dati.fattura.stato)) {
    return errore(409, "P0001", "Questa fattura è già partita: aspetta la risposta dello SdI.");
  }

  // ---- 2. il file prima del numero
  const prima = xmlFattura({
    ...dati,
    fattura: { ...dati.fattura, totale: null },
    progressivo: "00000",
    numero: dati.fattura.numero ? `${dati.fattura.numero}/${dati.fattura.anno}` : "PROVA",
  });
  if (prima.errori.length) {
    return errore(422, "dati", `Prima di mandarla sistema: ${prima.errori.join(" ")}`);
  }

  // ---- 3. la password, prima del numero
  if (davvero && (!pec.utente || !pec.password)) return errore(500, "pec_config", MANCA_PASSWORD);
  // ⚠️ I segreti della PEC esistono SOLO su work. Se ci sono e questo non
  //    sembra work (l'indirizzo del progetto è cambiato, un dominio nuovo),
  //    simulare segnerebbe «inviata» una fattura mai partita: ci si ferma
  //    (revisione del 13/11).
  if (!davvero && pec.utente) {
    return errore(500, "ambiente",
      "La PEC è configurata, ma questo non sembra il gestionale vero: non mando e non simulo. " +
      "La fattura NON è stata numerata. Chiama l'assistenza.");
  }

  // ---- 4. numero e progressivo
  const { data: invio, error: ep } = await supabase.rpc("prepara_invio_fattura", { p_fattura: fatturaId });
  if (ep) {
    const previsto = ["P0001", "P0002", "42501"].includes(ep.code ?? "");
    return errore(previsto ? 409 : 500, ep.code ?? "db", ep.message);
  }
  const numero = `${invio.numero}/${invio.anno}`;

  const chiudi = (esitoInvio: string, xml: string | null, motivo: string | null) =>
    supabase.rpc("chiudi_invio_fattura", {
      p_invio: invio.invio_id,
      p_esito: esitoInvio,
      p_xml: xml,
      p_errore: motivo,
    });

  const avvisa = async (tipo: string, frase: string, dettagli: Record<string, unknown>) => {
    try {
      await supabase.rpc("segnala_allarme", {
        p_tipo: tipo,
        p_messaggio: frase,
        p_dettagli: { fattura_id: fatturaId, numero, nome_file: invio.nome_file, ...dettagli },
      });
    } catch {
      // l'avviso è un di più: la risposta dice comunque cos'è successo
    }
  };

  // Non è partita, ed è SICURO: l'invio si chiude, la fattura si rimanda.
  const fallito = async (motivo: string, xml: string | null = null) => {
    const { error: ec } = await chiudi("fallito", xml, motivo);
    const frase =
      `La fattura ${numero} ha il suo numero ma NON è partita: ${motivo} ` +
      `Quando è sistemato, premi «Manda»: ripartirà con lo stesso numero.`;
    await avvisa("fattura_non_partita", frase, { chiusura: ec?.message ?? null });
    return errore(502, "spedizione", frase);
  };

  // Forse è partita: l'invio resta «in partenza» e blocca il rinvio, finché
  // il titolare non guarda nella posta inviata (sblocca_invio_fattura).
  const incerto = async (motivo: string) => {
    const frase =
      `La fattura ${numero} POTREBBE ESSERE PARTITA (${invio.nome_file}): ${motivo} ` +
      `NON rimandarla: fra 10 minuti guarda nella posta inviata della PEC e dimmi se c'è, da «Le fatture».`;
    await avvisa("fattura_invio_incerto", frase, {});
    return errore(502, "spedizione_incerta", frase);
  };

  // ⚠️ DA QUI OGNI USCITA CHIUDE L'INVIO (revisione del 13/11): un errore
  //    imprevisto non deve lasciare una fattura numerata con un invio
  //    appeso, che nessuno può più rimandare.
  let xml: string | null = null;
  let messaggioScritto = false;
  try {
    // ---- 5. il file vero, e la spedizione
    const finale = await leggi();
    if (!finale) return await fallito("non sono riuscito a rileggerla dopo il numero.");
    const file = xmlFattura({ ...finale, progressivo: invio.progressivo });
    if (file.errori.length || !file.xml) return await fallito(file.errori.join(" "));
    if (file.nomeFile !== invio.nome_file) {
      return await fallito(`il nome del file non torna (${file.nomeFile} invece di ${invio.nome_file}).`);
    }
    xml = file.xml;

    if (!davvero) {
      const { error: ec } = await chiudi("simulato", xml, null);
      if (ec) return await fallito(`non sono riuscito a segnare l'invio simulato (${ec.message}).`, xml);
      return risposta(200, {
        risultato: { numero, nome_file: invio.nome_file, destinatario: invio.destinatario, simulato: true },
      });
    }

    let tubo;
    let accettato: string | null = null;
    try {
      tubo = await apriTubo(pec.host, pec.porta);
      const messaggio = messaggioConAllegato({
        da: pec.utente,
        a: invio.destinatario,
        oggetto: `Invio fattura ${invio.nome_file}`,
        testo: `Fattura elettronica ${numero} di Borgo 58, in allegato (${invio.nome_file}).`,
        allegato: { nome: invio.nome_file, contenuto: xml },
      });
      messaggioScritto = true; // da qui in poi `dialogoSmtp` marca «incerto» quello che non è certo
      ({ accettato } = await dialogoSmtp(tubo, {
        utente: pec.utente,
        password: pec.password,
        da: pec.utente,
        a: invio.destinatario,
        messaggio,
      }));
    } catch (e) {
      if ((e as { incerto?: boolean }).incerto) return await incerto((e as Error).message);
      return await fallito((e as Error).message, xml);
    } finally {
      tubo?.chiudi();
    }

    // ⚠️ Da qui la mail è PARTITA: se il database non lo registra, l'invio
    //    resta «in partenza» e blocca il rinvio (sarebbe un doppione).
    const { error: ec } = await chiudi("partito", xml, null);
    if (ec) {
      await avvisa("fattura_partita_non_registrata",
        `La fattura ${numero} è PARTITA (${invio.nome_file}) ma il gestionale non è riuscito a segnarla: ` +
          `NON rimandarla. Fra 10 minuti segnala da «Le fatture» che è partita.`,
        { errore: ec.message });
      return errore(500, "registrazione",
        `La fattura ${numero} è partita, ma non sono riuscito a segnarlo: NON rimandarla. ` +
          `Fra 10 minuti, da «Le fatture», segnala che è partita.`);
    }
    return risposta(200, {
      risultato: { numero, nome_file: invio.nome_file, destinatario: invio.destinatario, simulato: false, accettato },
    });
  } catch (e) {
    // Un imprevisto: prima del messaggio è sicuro che non è partita.
    const motivo = `si è fermato tutto per un imprevisto (${(e as Error).message}).`;
    return messaggioScritto ? await incerto(motivo) : await fallito(motivo, xml);
  }
});
