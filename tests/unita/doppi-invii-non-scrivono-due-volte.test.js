import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// REVISIONE DELL'11/11/2026, punto 8: rimborso anticipo, restituzione di prestito e caparra bloccano la riga che decide
// mentre la controllano. La corsa vera si prova su Prova (tests/app/doppio-invio-restituzione.test.js); qui si controllano
// le cose che non devono cambiare per sbaglio nella migrazione.

const migrazione = readFileSync(new URL("../../supabase/migrations/20261124000001_i_doppi_invii_non_scrivono_due_volte.sql", import.meta.url), "utf8");

describe("migrazione 20261124000001: le tre funzioni bloccano la riga che decide", () => {
  it("il rimborso blocca la nota", () => {
    expect(migrazione).toContain("'select * into a from anticipazioni_socio where id = p_anticipazione_id for update;'");
  });

  it("la restituzione blocca il prestito", () => {
    expect(migrazione).toContain("'select * into v_p from prestiti_privati where id = p_prestito_id for update;'");
  });

  it("la caparra blocca la prenotazione", () => {
    expect(migrazione).toContain("'select reservation_date into v_data from reservations where id = p_reservation_id for update;'");
  });

  it("cambia il corpo vivo in una riga sola per funzione e si ferma se l'ancora non c'è o c'è due volte", () => {
    expect(migrazione).toContain("if v_n <> 1 then");
    expect(migrazione).toContain("non ha una sola riga");
    expect(migrazione).toContain("if v_def like '%' || v_caso.nuovo || '%' then continue; end if;");
  });

  it("non aggiunge vincoli unici (un secondo movimento legittimo per la stessa prenotazione o lo stesso prestito esiste)", () => {
    expect(migrazione).not.toMatch(/create unique index|add constraint/i);
  });

  it("si registra col proprio numero", () => {
    expect(migrazione).toMatch(/values \('20261124000001', 'i_doppi_invii_non_scrivono_due_volte'\)/);
  });
});
