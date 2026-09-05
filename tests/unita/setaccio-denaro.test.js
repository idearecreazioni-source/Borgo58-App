import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// IL SETACCIO DEL DENARO, PROVATO SENZA DATABASE — 05/09/2026
//
// 🔴 PERCHE' ESISTE, e non e' una precauzione teorica: il setaccio di
//    `viste_che_scavalcano_rls()` ha gridato su
//    `shopping_list_display.quantita_arrivata` — una quantita' di merce —
//    perche' dentro «arr-IVA-ta» ci sono le lettere di «iva». Il difetto
//    e' saltato fuori solo APPLICANDO la migrazione sul progetto di
//    prova, cioe' nel posto piu' caro in cui potesse saltare fuori.
//
// ⚠️ UN SETACCIO E' UN MISURATORE, e la regola del 26/08 dice che un
//    misuratore si prova su casi di cui si conosce gia' la risposta —
//    altrimenti misura, e non si sa cosa. Qui i casi noti sono scritti
//    sotto, nei DUE versi: le colonne che devono essere prese e quelle
//    che non devono.
//
// ⚠️ E SI PROVA IL COMPORTAMENTO, NON IL TESTO. L'espressione non e'
//    ricopiata qui dentro: si legge dalla migrazione. Una copia sarebbe
//    un secondo elenco della stessa cosa, e due elenchi della stessa cosa
//    prima o poi divergono — che e' precisamente il difetto che quella
//    rete esiste per chiudere.
//
// ⚠️ IL LIMITE, dichiarato: questa e' l'espressione di **Postgres** letta
//    da un file ed eseguita dal motore di **JavaScript**. Le due sintassi
//    coincidono su quello che qui si usa (ancoraggio, alternanza, classi),
//    ma restano due motori: questa prova e' un surrogato che gira a ogni
//    commit, non la prova vera. Quella vera e' il blocco di verifica della
//    migrazione, che costruisce una vista finta con tutt'e due le colonne
//    e pretende che il setaccio ne nomini una sola.

const CARTELLA = path.join(process.cwd(), "supabase", "migrations");

/** L'ultima migrazione che scrive il setaccio: la rete si segue, non si pinza a un nome di file. */
function setaccioVivo() {
  const file = readdirSync(CARTELLA)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .reverse();
  for (const f of file) {
    const sql = readFileSync(path.join(CARTELLA, f), "utf8");
    const m = /a\.attname\s+~\*\s+'([^']+)'/.exec(sql);
    if (m) return { file: f, sorgente: sql, pattern: m[1] };
  }
  return null;
}

const vivo = setaccioVivo();

describe("il setaccio delle colonne economiche riservate", () => {
  it("si trova, altrimenti e' questa prova a essere rotta", () => {
    // ⚠️ La rete che protegge la rete: senza questo, un file rinominato
    //    darebbe «nessun setaccio» e tutte le prove qui sotto passerebbero
    //    senza aver guardato niente.
    expect(vivo, "nessuna migrazione contiene piu' il setaccio su a.attname").not.toBeNull();
  });

  const setaccio = new RegExp(vivo.pattern, "i");

  // 🔴 LE COLONNE VERE DI DENARO. Se una di queste smette di essere presa,
  //    una vista che scavalca la RLS puo' mostrarla allo staff in silenzio.
  const DEVONO_ESSERE_PRESE = [
    "unit_cost",
    "costo",
    "costo_ingredienti",
    "food_cost_percento",
    "prezzo_unitario",
    "price",
    "selling_price",
    "current_price",
    "importo",
    "total_amount",
    "amount",
    "margine",
    "ricavi",
    "utile_netto",
    "iva",
    "importo_iva",
    "vat_rate",
    "saldo_banca",
    "balance",
    "entrate",
    "uscite_previste",
    "takings",
    "float_cassa",
    "prestito_residuo",
    "revenue_forgone",
    "tips_collected",
    "total_full",
  ];

  // 🔴 I FALSI ALLARMI, e sono i sedici misurati sui nomi di colonna veri
  //    del progetto piu' i due che li spiegano. Nessuno di questi e'
  //    denaro: sono date di prenotazione (reser-VAT-ion), interruttori
  //    (att-IVA), quantita' di merce (arr-IVA-ta), scostamenti
  //    (s-COST-amenti).
  const NON_DEVONO_ESSERE_PRESE = [
    "quantita_arrivata",
    "reservation_date",
    "reservation_id",
    "reservation_time",
    "reservation_count",
    "first_reservation_date",
    "last_reservation_date",
    "attiva",
    "email_conferma_attiva",
    "maxideduzione_attiva",
    "privacy_consent_at",
    "aliquota_foglio_informativa",
    "giornate_con_scostamenti",
    "rilevato_il",
    "salvato",
    "trovate",
    "riuscita",
    "concentrato",
  ];

  for (const nome of DEVONO_ESSERE_PRESE) {
    it(`prende «${nome}»`, () => {
      expect(setaccio.test(nome), `${nome} non viene piu' segnalata: e' denaro`).toBe(true);
    });
  }

  for (const nome of NON_DEVONO_ESSERE_PRESE) {
    it(`non prende «${nome}»`, () => {
      expect(setaccio.test(nome), `${nome} viene segnalata come denaro, e non lo e'`).toBe(false);
    });
  }

  it("cerca all'inizio di un segmento del nome, non a lettera qualsiasi", () => {
    // ⚠️ La PROPRIETA' che rende impossibile la famiglia intera, invece del
    //    caso singolo. Un setaccio riscritto senza ancoraggio tornerebbe a
    //    gridare su ogni «reservation_date» del progetto, e un guardiano
    //    che grida sempre viene spento.
    expect(vivo.pattern.startsWith("(^|_)"), vivo.pattern).toBe(true);
  });

  it("ha una sola esenzione dichiarata, ed e' una coppia vista × colonna", () => {
    // 🔴 Il giorno che qualcuno ne aggiunge una seconda per far tacere un
    //    allarme, questa riga diventa rossa e lo costringe a scriverne la
    //    ragione. Una lista di eccezioni che cresce in silenzio non e' piu'
    //    un elenco di eccezioni: e' il setaccio spento un pezzo per volta.
    const esenzioni = [...vivo.sorgente.matchAll(/and not \(v\.nome = '([a-z_]+)' and a\.attname = '([a-z_]+)'\)/g)];
    expect(esenzioni.map((m) => `${m[1]}.${m[2]}`)).toEqual(["menu_items_display.selling_price"]);
  });
});
