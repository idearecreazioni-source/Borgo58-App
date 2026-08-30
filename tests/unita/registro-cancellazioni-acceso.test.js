import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 🔴 UNA VERIFICA NON SPEGNE PIÙ IL REGISTRO DELLE CANCELLAZIONI — 30/08/2026,
// decisione di Alessio.
//
// IL PROBLEMA, misurato. Le verifiche delle migrazioni costruiscono e
// cancellano righe dentro il gestionale **vero** — fra cui un conto, che il
// 26/08 Alessio ha deciso che sta **dentro** il registro delle cancellazioni.
// Per poter ripulire, quelle verifiche **spengono il registro**: cioè per
// mezzo secondo, nel database vero, le cancellazioni non vengono registrate.
// ⚠️ E non è un'abitudine nata ieri: misurato il 30/08, sono **23 file di
// migrazione** e **30 occorrenze**, il più vecchio del 20/08.
//
// LA DECISIONE. La verifica resta — *provare dove conta è giusto* — ma la
// pulizia non deve spegnere quella guardia.
//
// 🔴 LA STRADA SCELTA È UNA TERZA, e non una delle due proposte: **la verifica
// non cancella, ANNULLA**. Tutto ciò che costruisce vive dentro una
// sotto-transazione che alla fine viene fatta rientrare, quindi non c'è
// niente da cancellare, il registro **resta acceso per tutto il tempo** e non
// nasce nessuna lapide da togliere.
// ⚠️ Le due strade del mandato hanno un prezzo che questa non ha: far
// **registrare** la cancellazione di prova e poi togliere la lapide vuol dire
// scrivere righe finte in un registro **esibibile** e poi correggerlo — cioè
// il difetto chiuso il 19/08; usare **solo tabelle fuori dal perimetro** vuol
// dire provare lo scarico senza toccare i conti, cioè provare un'altra cosa.
//
// ✅ PROVATA sul progetto di prova il 30/08, non dedotta: dentro la
// sotto-transazione il conto **esiste** (è quello che serve per provare
// qualcosa di vero); fuori restano **zero** conti, le lapidi sono **10475
// prima e 10475 dopo**, e i trigger spenti sono **zero**. La forma è:
//
//     begin
//       ...si costruisce e si controlla...
//       raise exception 'ZZ_ANNULLA' using errcode = 'P0001';
//     exception when sqlstate 'P0001' then
//       if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;   -- un guasto vero risale
//     end;
//
// ⚠️ Il `raise` dentro il gestore non è un dettaglio: senza, una verifica
// **fallita** verrebbe inghiottita dallo stesso meccanismo che serve ad
// annullare, e la migrazione passerebbe verde con la verifica rotta. È la
// trappola del 15/08 sui gestori d'eccezione nei blocchi di verifica.
//
// ⚠️ E LE VARIABILI SOPRAVVIVONO all'annullamento (vivono in memoria, non nel
// database): quello che si è misurato dentro si può controllare fuori.

const CARTELLA = "supabase/migrations";
const FORMULA = "disable trigger trg_log_delete";

// 🔴 LO STATO DI PARTENZA, CONGELATO al 30/08/2026. Non è un elenco di cose
// perdonate per sempre: è la linea da cui in poi il numero non deve crescere.
// Riscriverle tutte e ventitré vorrebbe dire riscrivere migrazioni già
// applicate, che in questo progetto non si fa (regola del 23/08).
// ⚠️ Le si toglie da qui solo quando quella migrazione viene **superata** da
// una nuova che rifà la stessa verifica con la strada dell'annullamento.
const GIA_COSI = [
  "20260820000004_l_elenco_che_si_fa_notare.sql",
  "20260821000005_i_turni_dei_pasti.sql",
  "20260822000001_la_sera_dell_evento.sql",
  "20260822000005_i_prestiti_di_privati.sql",
  "20260823000002_scende_quello_che_si_puo.sql",
  "20260823000003_le_spezie_e_il_vino.sql",
  "20260824000015_una_commissione_una_unita.sql",
  "20260824000018_le_cinque_aree_scoperte.sql",
  "20260824000019_il_posto_dove_sta_il_conto.sql",
  "20260824000028_il_bis_scarica_il_magazzino.sql",
  "20260824000035_la_sostituzione_arriva_in_cucina.sql",
  "20260824000036_le_due_porte_che_avevo_aperto.sql",
  "20260824000039_in_sala_i_due_no_si_dicono_diversi.sql",
  "20260825000001_la_scala_si_prova_con_roba_propria.sql",
  "20260825000004_una_previsione_chiusa_si_legge.sql",
  "20260825000005_il_magazzino_scarica_le_preparazioni.sql",
  "20260825000006_il_food_cost_di_un_conto_viene_dal_magazzino.sql",
  "20260825000007_la_preparazione_che_il_magazzino_non_segue.sql",
  "20260825000008_l_anomalia_dice_il_nome_e_basta.sql",
  "20260825000009_un_movimento_di_banca_ha_il_suo_conto.sql",
  "20260825000012_le_tre_verifiche_si_rifanno_con_roba_propria.sql",
  "20260830000002_il_vino_entra_nel_magazzino.sql",
  "20260830000004_lo_zero_che_non_e_un_prezzo.sql",
];

function migrazioniCheSpengonoIlRegistro() {
  return readdirSync(CARTELLA)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => readFileSync(join(CARTELLA, f), "utf8").includes(FORMULA))
    .sort();
}

describe("il registro delle cancellazioni non si spegne più", () => {
  it("nessuna migrazione NUOVA spegne il registro", () => {
    const nuove = migrazioniCheSpengonoIlRegistro().filter((f) => !GIA_COSI.includes(f));
    expect(
      nuove,
      "Queste migrazioni spengono il registro delle cancellazioni dentro il\n" +
        "gestionale vero. Non farlo: fai vivere la verifica dentro una\n" +
        "sotto-transazione e falla rientrare alla fine (`raise exception\n" +
        "'ZZ_ANNULLA'` + `exception when sqlstate 'P0001'`, con il `raise` che\n" +
        "rilancia un guasto vero). Così non c'è niente da cancellare e la\n" +
        "guardia resta accesa. La spiegazione per esteso è in cima a questo file:\n  " +
        nuove.join("\n  ")
    ).toEqual([]);
  });

  it("e lo stato di partenza non è cresciuto in silenzio", () => {
    // ⚠️ Il verso opposto: se una delle ventitré viene sistemata, va tolta da
    //    `GIA_COSI` — altrimenti l'elenco perdona una cosa che non succede
    //    più, e il giorno che qualcuno ci rimette dentro quella formula il
    //    guardiano tace.
    const vive = migrazioniCheSpengonoIlRegistro();
    const perdonateInutilmente = GIA_COSI.filter((f) => !vive.includes(f));
    expect(
      perdonateInutilmente,
      "Queste migrazioni non spengono più il registro: toglile da GIA_COSI,\n" +
        "o l'elenco continuerà a perdonarle e coprirà chi ce le rimettesse:\n  " +
        perdonateInutilmente.join("\n  ")
    ).toEqual([]);
    expect(vive.length, "il numero di partenza misurato il 30/08 era 23").toBe(GIA_COSI.length);
  });
});
