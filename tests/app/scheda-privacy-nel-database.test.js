import { beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio } from "./aiuto";

// REVISIONE DEL 23/11/2026, punto 8: la privacy della Scheda sta nel database. Su Prova, testi inventati.
// ⚠️ Qui si provano solo i RIFIUTI: le voci della Scheda non si cancellano (lo vieta il database), quindi una prova
//    che ne scrivesse una la lascerebbe lì. Il caso accettato lo prova la verifica interna della migrazione, annullata.

const SIGLA = marchio("PROVA PRIVACY SCHEDA");

describe("scheda: il database rifiuta i testi che non deve accettare", () => {
  let titolare;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
  });

  const scrivi = (testo, chiave) =>
    titolare.from("scheda_voci").insert({ sezione: "decisioni", chiave: `decisioni:${chiave}`, testo, fonte: "riferito" }).select("id");

  it("una voce con una parola delicata (prestito) non entra, e dice quale", async () => {
    const r = await scrivi(`${SIGLA} voce inventata sul prestito di una persona.`, "privacy-prestito");
    expect(r.error).not.toBeNull();
    expect(r.error.message).toMatch(/argomenti delicati/i);
    expect(r.error.message).toMatch(/prestito/i);
  });

  it("anche debiti, avvocato e salute sono rifiutati", async () => {
    for (const [i, testo] of [
      `${SIGLA} voce inventata sui debiti.`,
      `${SIGLA} voce inventata: ha chiamato l'avvocato.`,
      `${SIGLA} voce inventata sulla salute di un socio.`,
    ].entries()) {
      const r = await scrivi(testo, `privacy-parola-${i}`);
      expect(r.error, testo).not.toBeNull();
      expect(r.error.message).toMatch(/argomenti delicati/i);
    }
  });

  it("un IBAN con lo spazio dopo la sigla del paese non entra", async () => {
    const r = await scrivi(`${SIGLA} voce inventata con IT 60 X054 2811 1010 0000 0123 456.`, "privacy-iban");
    expect(r.error).not.toBeNull();
    expect(r.error.message).toMatch(/IBAN/i);
  });
});
