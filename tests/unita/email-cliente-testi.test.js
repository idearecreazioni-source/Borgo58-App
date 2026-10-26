import { describe, expect, it } from "vitest";
import { esc, testoConferma, testoPreventivo } from "../../supabase/functions/email-cliente/testi";

// =====================================================================
// LE EMAIL AI CLIENTI NON PORTANO MARKUP ALTRUI — 26/10/2026
// =====================================================================
// Il nome della conferma arriva dal modulo pubblico di prenotazione: chi lo
// compila sceglie anche cosa c'è scritto. Prima di oggi finiva nell'HTML
// così com'era, e un link scritto nel campo «nome» diventava un link vero
// in una mail mandata dal dominio del locale.

const LINK = '<a href="https://esempio.invalid">clicca</a>';

describe("esc", () => {
  it("rende innocui i cinque caratteri che l'HTML interpreta", () => {
    expect(esc(`<b>"Tom" & 'Jerry'</b>`)).toBe("&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;");
  });

  it("lascia com'è un nome normale, accenti compresi", () => {
    expect(esc("Niccolò D'Amico")).toBe("Niccolò D&#39;Amico");
  });

  it("non scrive «undefined» né «null»", () => {
    expect(esc(undefined)).toBe("");
    expect(esc(null)).toBe("");
  });
});

describe("la conferma di una prenotazione", () => {
  const prenotazione = { nome: LINK, data: "2027-03-15", ora: "20:30:00", coperti: 4 };

  it("🔴 un link scritto nel nome non diventa un link nell'HTML", () => {
    const { html } = testoConferma(prenotazione);
    expect(html).not.toContain("<a ");
    expect(html).toContain("&lt;a href=&quot;https://esempio.invalid&quot;&gt;clicca&lt;/a&gt;");
  });

  it("il testo semplice resta leggibile com'era", () => {
    const { testo, oggetto } = testoConferma({ ...prenotazione, nome: "Maria Rossi" });
    expect(testo).toContain("Gentile Maria Rossi,");
    expect(oggetto).toBe("Prenotazione confermata — 15/03/2027 alle 20:30");
  });

  it("l'impaginazione del locale resta: il markup nostro passa, quello altrui no", () => {
    const { html } = testoConferma(prenotazione);
    expect(html).toContain("<strong>Quando:</strong> 15/03/2027 alle 20:30<br>");
  });
});

describe("il foglio del preventivo", () => {
  const preventivo = {
    cliente: LINK,
    persone: 2,
    data_evento: "2027-04-10",
    valido_fino_al: "2027-03-10",
    menu: [{ nome: "<script>alert(1)</script>" }],
    extra: [{ descrizione: '<img src=x onerror="x">', importo: 10 }],
    prezzo_a_persona: 40,
    totale: 90,
  };

  it("🔴 cliente, piatti e voci in più entrano come testo, mai come markup", () => {
    const { html } = testoPreventivo(preventivo);
    expect(html).not.toMatch(/<a |<script|<img/);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("ogni riga resta un paragrafo", () => {
    const { html, testo } = testoPreventivo(preventivo);
    expect(html.match(/<p style="margin:0 0 8px">/g)).toHaveLength(testo.split("\n").length);
  });
});
