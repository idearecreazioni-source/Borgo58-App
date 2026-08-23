import { describe, expect, it } from "vitest";
import {
  controllaMigrazione,
  funzioniRidefinite,
  guardieSmarrite,
  impronte,
  rinunceDichiarate,
  spogliaCommenti,
} from "../../scripts/guardie.mjs";

// 🔴 La rete contro la funzione riscritta a memoria (23/08/2026): quattro
// volte una funzione e' stata ricopiata a mano e ha perso per strada un
// portiere, il nome di un campo che una schermata legge, un messaggio che
// spiegava un rifiuto. Il perche' e il come stanno in scripts/guardie.mjs.
//
// ⚠️ Queste prove non guardano il database: guardano la REGOLA. Sono
// scritte al contrario dove conta — non basta che la rete taccia sul caso
// buono, deve gridare su quello cattivo, altrimenti tacerebbe anche una
// rete che non guarda niente.

const VIVO = `create or replace function registra_cosa(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;
  if p_id is null then
    raise exception 'Serve un identificativo';
  end if;
  return jsonb_build_object('esito', 'fatto', 'righe_non_scaricate', 0);
end;
$funzione$`;

describe("cosa si perde riscrivendo una funzione", () => {
  it("il portiere che sparisce fa scattare la rete", () => {
    const senzaPortiere = VIVO.replace(
      "if auth.uid() is null then\n    raise exception 'Operazione consentita solo a un utente autenticato';\n  end if;",
      ""
    );
    const perse = guardieSmarrite(VIVO, senzaPortiere);
    expect(perse.map((p) => p.tipo)).toContain("messaggio");
    expect(perse.map((p) => p.testo)).toContain(
      "Operazione consentita solo a un utente autenticato"
    );
  });

  it("il nome di un campo della risposta e' un patto: rinominarlo si vede", () => {
    // E' il difetto vero del 23/08: la schermata Produzioni legge
    // `righe_non_scaricate` e avrebbe detto zero per sempre, senza errore.
    const rinominato = VIVO.replace("righe_non_scaricate", "ingredienti_mancanti");
    const perse = guardieSmarrite(VIVO, rinominato);
    expect(perse.map((p) => p.testo)).toContain("righe_non_scaricate");
  });

  it("`security definer` tolto si vede", () => {
    const perse = guardieSmarrite(VIVO, VIVO.replace("security definer\n", ""));
    expect(perse.map((p) => p.testo)).toContain("security definer");
  });

  it("aggiungere non fa scattare niente: la rete guarda solo cio' che manca", () => {
    const conUnControlloInPiu = VIVO.replace(
      "return jsonb_build_object(",
      "if p_id = '00000000-0000-0000-0000-000000000000' then\n" +
        "    raise exception 'Identificativo non valido';\n" +
        "  end if;\n  return jsonb_build_object("
    );
    expect(guardieSmarrite(VIVO, conUnControlloInPiu)).toEqual([]);
  });

  it("una colonna in piu' nella risposta non e' una perdita", () => {
    const piuRicco = VIVO.replace(
      "'righe_non_scaricate', 0)",
      "'righe_non_scaricate', 0, 'quanto', 1)"
    );
    expect(guardieSmarrite(VIVO, piuRicco)).toEqual([]);
  });

  it("lo stesso testo mandato a capo non e' una riga persa", () => {
    const riformattato = VIVO.replace(
      "if auth.uid() is null then",
      "if auth.uid()\n       is null\n    then"
    );
    expect(guardieSmarrite(VIVO, riformattato)).toEqual([]);
  });

  it("la stessa frase con l'accento invece dell'apostrofo resta la stessa frase", () => {
    // Misurato il 23/08 sulle migrazioni in attesa: in produzione la frase
    // era `e'' riservata`, nella migrazione nuova `è riservata`. Il portiere
    // era intatto, e la rete gridava.
    const vivo = VIVO.replace("Serve un identificativo", "Questo e'' obbligatorio");
    const nuovo = VIVO.replace("Serve un identificativo", "Questo è obbligatorio");
    expect(guardieSmarrite(vivo, nuovo)).toEqual([]);
  });

  it("una guardia commentata via conta come persa, non come presente", () => {
    // ⚠️ Il verso conta: se i commenti si togliessero solo dal corpo vivo,
    // basterebbe commentare un portiere per farlo passare.
    const commentata = VIVO.replace(
      "if auth.uid() is null then\n    raise exception 'Operazione consentita solo a un utente autenticato';\n  end if;",
      "-- if auth.uid() is null then\n" +
        "  --   raise exception 'Operazione consentita solo a un utente autenticato';\n" +
        "  -- end if;"
    );
    const perse = guardieSmarrite(VIVO, commentata).map((p) => p.testo);
    expect(perse).toContain("auth.uid()");
    expect(perse).toContain("Operazione consentita solo a un utente autenticato");
  });

  it("una chiamata a un'altra funzione del progetto che sparisce si vede", () => {
    const vivo = VIVO.replace("return jsonb", "perform aggiorna_saldo(p_id);\n  return jsonb");
    const perse = guardieSmarrite(vivo, VIVO, new Set(["aggiorna_saldo"]));
    expect(perse.map((p) => p.testo)).toContain("aggiorna_saldo");
  });

  it("ma una funzione che non e' del progetto non conta", () => {
    const vivo = VIVO.replace("return jsonb", "perform pg_sleep(0);\n  return jsonb");
    expect(guardieSmarrite(vivo, VIVO, new Set(["aggiorna_saldo"]))).toEqual([]);
  });
});

describe("i pezzi della rete", () => {
  it("i commenti spariscono, le stringhe no", () => {
    const dentro = spogliaCommenti("select 'a -- b'; -- via\nselect 2;");
    expect(dentro).toContain("'a -- b'");
    expect(dentro).not.toContain("via");
  });

  it("trova tutte le funzioni che una migrazione ridefinisce", () => {
    const sql = `${VIVO};\n\n${VIVO.replace("registra_cosa", "registra_altro")};`;
    expect(funzioniRidefinite(sql).map((f) => f.nome)).toEqual([
      "registra_cosa",
      "registra_altro",
    ]);
  });

  it("«public» non e' una parola-chiave: e' come il database scrive search_path", () => {
    const trovate = impronte(VIVO).filter((i) => i.tipo === "parola");
    expect(trovate.map((t) => t.testo)).not.toContain("public");
    expect(trovate.map((t) => t.testo)).toContain("righe_non_scaricate");
  });

  it("una rinuncia si dichiara per nome, e vale solo per quel nome", () => {
    const righe = rinunceDichiarate(
      "-- rete-guardie: registra_cosa — il portiere si sposta nel corridoio\n"
    );
    expect(righe.get("registra_cosa")).toContain("corridoio");
    expect(righe.has("registra_altro")).toBe(false);
  });
});

describe("il controllo su una migrazione intera", () => {
  const vivi = (nome) => (nome === "registra_cosa" ? VIVO : null);
  const rotta = VIVO.replace("'righe_non_scaricate'", "'ingredienti_mancanti'");

  it("si ferma se la perdita non e' dichiarata", () => {
    const esiti = controllaMigrazione(`${rotta};`, vivi);
    expect(esiti).toHaveLength(1);
    expect(esiti[0].rinuncia).toBeNull();
  });

  it("lascia passare se e' dichiarata, ma dice a cosa si rinuncia", () => {
    const esiti = controllaMigrazione(
      `-- rete-guardie: registra_cosa — il campo cambia nome insieme alla schermata\n${rotta};`,
      vivi
    );
    expect(esiti[0].rinuncia).toContain("schermata");
    expect(esiti[0].smarrite.map((s) => s.testo)).toContain("righe_non_scaricate");
  });

  it("una funzione che nel database non c'e' ancora non puo' aver perso niente", () => {
    expect(controllaMigrazione(`${VIVO};`, () => null)).toEqual([]);
  });
});
