import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";

// Blocco 6 del mandato di correzione: i registri che si esibiscono.
//
// ⚠️ Il destinatario di questi vincoli non è Alessio: è chi verrà a
// controllare. Un registro che si mostra a un'ispezione non può contenere
// una riga che dichiara qualcosa che non è avvenuto — una non conformità
// «risolta» senza rimedio, o un conto «fatturato» senza numero di
// fattura.
//
// Le prove entrano con lo STAFF dove il gesto è di sala (le non
// conformità le chiude chi lavora), col titolare dove il dato è suo.
const MARCA = "TEST-AUTO registri";

describe("i registri che si esibiscono non accettano righe che mentono", () => {
  let staff;
  let titolare;

  async function pulisci() {
    await titolare.from("haccp_non_conformities").delete().like("description", `${MARCA}%`);
    await titolare.from("orders").delete().like("table_label", `${MARCA}%`);
  }

  beforeAll(async () => {
    staff = await clientAutenticato(credenziali().staff);
    titolare = await clientAutenticato(credenziali().titolare);
    await pulisci();
  });

  afterAll(async () => {
    await pulisci();
    await staff.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
  });

  // ⚠️ CHIUDERE una non conformità è già riservato al titolare (policy
  // haccp_nc_upd_titolare), mentre APRIRLA la può fare tutto lo staff. Le
  // due cose stanno bene così: chi è in cucina deve poter registrare un
  // problema, chi risponde a un’ispezione deve poterlo chiudere. Provato
  // scrivendo questa prova con lo staff: l’update non dava errore perché
  // non toccava nessuna riga — un rifiuto silenzioso che, in una prova,
  // sarebbe passato per un vincolo che non funziona.
  it("una non conformità non si chiude senza dire cosa è stato fatto", async () => {
    const { data: nc, error: eIns } = await staff
      .from("haccp_non_conformities")
      .insert({ category: "temperatura", description: `${MARCA} frigo`, detected_at: new Date().toISOString() })
      .select()
      .single();
    expect(eIns).toBeNull();

    const { error: eVuoto } = await titolare
      .from("haccp_non_conformities")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", nc.id);
    expect(eVuoto, "si è chiusa col campo vuoto: nel manuale esibibile risulterebbe risolta").toBeTruthy();

    const { error: eSpazi } = await titolare
      .from("haccp_non_conformities")
      .update({ resolved: true, resolved_at: new Date().toISOString(), corrective_action: "   " })
      .eq("id", nc.id);
    expect(eSpazi, "uno spazio bianco è passato come azione correttiva").toBeTruthy();

    const { error: eOk } = await titolare
      .from("haccp_non_conformities")
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        corrective_action: "Merce respinta e fornitore avvisato",
      })
      .eq("id", nc.id);
    expect(eOk).toBeNull();
  });

  it("ma registrare un problema resta libero: una misurazione persa è irrecuperabile", async () => {
    // ⚠️ Il vincolo tocca la CHIUSURA, non la registrazione. Di sera,
    // davanti a un campo obbligatorio, non si scrive il rimedio: si smette
    // di registrare la temperatura. È la decisione del 13/08, e questa
    // prova esiste per impedire che si allarghi senza che nessuno lo noti.
    const { error } = await staff.from("haccp_non_conformities").insert({
      category: "ricevimento",
      description: `${MARCA} merce non conforme`,
      detected_at: new Date().toISOString(),
    });
    expect(error).toBeNull();
  });

  it("un conto dichiarato «fattura» deve avere un numero", async () => {
    const { data: conto } = await titolare
      .from("orders")
      .insert({
        table_label: `${MARCA} conto`,
        status: "chiuso",
        coperti: 1,
        coperto_unit_price: 5,
        closed_at: new Date().toISOString(),
      })
      .select()
      .single();

    const { error: eSenzaNumero } = await titolare
      .from("orders")
      .update({ documento_fiscale: "fattura", documento_emesso_il: "2026-08-16" })
      .eq("id", conto.id);
    expect(eSenzaNumero, "un conto si è dichiarato fatturato senza numero di fattura").toBeTruthy();

    const { error: eOk } = await titolare
      .from("orders")
      .update({
        documento_fiscale: "fattura",
        documento_emesso_il: "2026-08-16",
        documento_numero: "TEST-1",
      })
      .eq("id", conto.id);
    expect(eOk).toBeNull();

    // E lo scontrino non chiede né data né numero: il vincolo non si è
    // allargato a ciò che non riguarda.
    const { error: eScontrino } = await titolare
      .from("orders")
      .update({ documento_fiscale: "scontrino", documento_emesso_il: null, documento_numero: null })
      .eq("id", conto.id);
    expect(eScontrino).toBeNull();
  });

  // 🔴 NATA DA UN DIFETTO VERO, il 19/08/2026: applicando otto migrazioni in
  // produzione, le lapidi del registro delle cancellazioni sono passate da
  // 26 a 31. Cinque righe finte, lasciate dalle verifiche di tre migrazioni
  // che cancellavano i propri movimenti di prova senza ripulire la copia
  // che il trigger ne conserva.
  //
  // ⚠️ `deleted_records` è un registro **esibibile** e nessuno lo può
  // ripulire dall'app: righe finte lì dentro sono dati di prova in mezzo ai
  // dati veri, ed è la regola di Alessio del 12/08. E rompono il guardiano
  // che ogni migrazione usa per difendersi — *«le lapidi prima e dopo devono
  // essere le stesse»* — che smette di poter essere affermato da chiunque.
  //
  // ⚠️ Questa prova guarda una PROPRIETÀ e non un numero: quante lapidi ci
  // siano non lo dice (cresce coi dati veri), dice che nessuna nomina una
  // verifica. Un conteggio qui sarebbe il fossile del 16/08.
  //
  // 🔴 E LA DOMANDA SI FA AL DATABASE, non leggendo le righe da qui: la
  // prima stesura le leggeva tutte e cercava la parola fra quelle — e
  // mettendole davanti una lapide finta apposta **non è diventata rossa**.
  // Misurato: PostgREST ne restituisce al massimo **mille**, e sul progetto
  // di prova sono ben oltre. Guardava una parte del registro credendo di
  // guardarlo tutto — la famiglia dell'avvertenza sui `.limit()` (§8), con
  // l'aggravante che quel limite non si vede leggendo il codice.
  it("il registro delle cancellazioni non conserva le righe delle verifiche", async () => {
    const { data, error } = await titolare.rpc("lapidi_di_prova");
    expect(error).toBeNull();
    const finte = (data ?? []).map((r) => `${r.tabella}: ${r.firma}`);
    expect(finte, "lapidi lasciate da una verifica").toEqual([]);
  });
});
