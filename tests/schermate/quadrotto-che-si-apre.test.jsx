import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ElencoAdattivo from "../../src/components/ElencoAdattivo";

// =====================================================================
// IL QUADROTTO INTERO SI APRE, E I SUOI COMANDI RESTANO INDIPENDENTI
// =====================================================================
// 10/09/2026, Blocco 2 del mandato notturno.
//
// 🔴 IL DIFETTO. Dove il quadrotto ha dei comandi dentro — nell'Agenda la
//    spunta «fatto», la stella, «rimanda» — il tocco che apre la scheda
//    viveva **solo sul titolo**: una striscia di testo alta un centimetro
//    in mezzo a un riquadro che sembra tutto premibile. Sul telefono si
//    finisce quasi sempre a lato, e quel tocco non faceva niente.
//
// 🔴 E LA METÀ CHE CONTA È IL CASO OPPOSTO: la spunta che chiude un
//    impegno **non deve aprire la scheda**. Se ad allargare il bersaglio si
//    perdesse questo, il gesto più frequente dell'Agenda smetterebbe di
//    funzionare — e a schermo sembrerebbe che il gestionale abbia deciso di
//    aprire una scheda invece di segnare fatto.
//
// ⚠️ SI PROVA SUL COMPONENTE, non sulla schermata, perché la regola vive
//    lì: sono otto elenchi a usarlo, e una prova per schermata direbbe che
//    l'Agenda funziona senza dire niente delle altre sette.

const RIGHE = [
  { id: "a", nome: "Rinnovo firma digitale", scadenza: "12/09/2026", origine: "posta" },
  { id: "b", nome: "Chiamare il tecnico della cella", scadenza: "", origine: null },
];

function elenco(extra = {}) {
  return (
    <ElencoAdattivo
      righe={RIGHE}
      chiave={(r) => r.id}
      titolo={(r) => (
        <span className="flex items-start gap-3">
          <label title="Fatto">
            <input type="checkbox" checked={false} onChange={() => extra.onFatto?.(r)} />
          </label>
          <span>{r.nome}</span>
          <button type="button" onClick={() => extra.onStella?.(r)}>
            ★
          </button>
        </span>
      )}
      campi={(r) => [{ chiave: "scadenza", etichetta: "Scadenza", valore: r.scadenza, vuoto: "quando capita" }]}
      {...extra}
    />
  );
}

// 🔴 LA ZONA VA DICHIARATA, E QUESTA PROVA L'HA IMPARATO ROMPENDO.
//    La prima versione cercava «un antenato con role=button» in tutta la
//    pagina: spegnendo apposta il tocco sul quadrotto del TELEFONO, le
//    prove restavano verdi — perché trovavano la **riga della tabella**,
//    che ce l'ha anche lei. Misuravano l'una credendo di misurare l'altra.
const zonaTelefono = () => document.querySelector(".md\\:hidden.print\\:hidden");
const zonaComputer = () => document.querySelector(".hidden.md\\:block");

const cercaIn = (zona, nome) => {
  const foglie = [...zona.querySelectorAll("*")].filter(
    (n) => n.children.length === 0 && n.textContent.trim() === nome
  );
  return foglie[0]?.closest('[role="button"]');
};

/** Il riquadro del telefono: quello che ascolta il tocco. */
const quadrottoDi = (nome) => cercaIn(zonaTelefono(), nome);
/** La riga della tabella, sul computer. */
const rigaDi = (nome) => cercaIn(zonaComputer(), nome);

describe("il quadrotto con dei comandi dentro", () => {
  const conAzione = (over) => ({
    azione: () => ({ etichetta: "rimanda", onClick: over.onRimanda }),
    onTocco: over.onTocco,
    onFatto: over.onFatto,
    onStella: over.onStella,
    nota: (r) => (r.origine ? "nato dalla posta" : null),
  });

  it("🔴 si apre toccandolo dove capita, non solo sul titolo", () => {
    const onTocco = vi.fn();
    render(elenco(conAzione({ onTocco })));
    const q = quadrottoDi("Rinnovo firma digitale");
    expect(q, "il quadrotto del telefono non ascolta nessun tocco").toBeTruthy();
    // Il tocco sul riquadro, non sul testo del titolo.
    fireEvent.click(q);
    expect(onTocco).toHaveBeenCalledTimes(1);
    expect(onTocco.mock.calls[0][0].id).toBe("a");
  });

  it("e sul computer si apre la riga intera, non la prima colonna", () => {
    // ⚠️ Le due forme dello stesso elenco devono comportarsi uguale: se il
    //    tocco vivesse solo su una, la stessa Agenda si aprirebbe in un
    //    modo dal telefono e in un altro dal computer.
    const onTocco = vi.fn();
    render(elenco(conAzione({ onTocco })));
    const riga = rigaDi("Rinnovo firma digitale");
    expect(riga, "la riga della tabella non ascolta nessun tocco").toBeTruthy();
    fireEvent.click(riga);
    expect(onTocco).toHaveBeenCalledTimes(1);
    // E anche lì la spunta resta sua.
    fireEvent.click(riga.querySelector("input[type=checkbox]"));
    expect(onTocco).toHaveBeenCalledTimes(1);
  });

  it("🔴 la spunta «fatto» NON apre la scheda", () => {
    const onTocco = vi.fn();
    const onFatto = vi.fn();
    render(elenco(conAzione({ onTocco, onFatto })));
    const q = quadrottoDi("Rinnovo firma digitale");
    fireEvent.click(q.querySelector("input[type=checkbox]"));
    expect(onFatto).toHaveBeenCalledTimes(1);
    expect(onTocco, "la spunta ha aperto la scheda invece di segnare fatto").not.toHaveBeenCalled();
  });

  it("🔴 nemmeno la stella, nemmeno «rimanda»", () => {
    const onTocco = vi.fn();
    const onStella = vi.fn();
    const onRimanda = vi.fn();
    render(elenco(conAzione({ onTocco, onStella, onRimanda })));
    const q = quadrottoDi("Rinnovo firma digitale");
    fireEvent.click(q.querySelector("button"));
    fireEvent.click([...q.querySelectorAll("button")].find((b) => b.textContent === "rimanda"));
    expect(onStella).toHaveBeenCalledTimes(1);
    expect(onRimanda).toHaveBeenCalledTimes(1);
    expect(onTocco).not.toHaveBeenCalled();
  });

  it("🔴 e il comando che NON esiste ancora è coperto lo stesso", () => {
    // ⚠️ È la ragione per cui la regola guarda il bersaglio del tocco
    //    invece di chiedere a ogni comando di difendersi: un comando
    //    aggiunto qui fra sei mesi non deve ricordarsi di niente.
    const onTocco = vi.fn();
    const onNuovo = vi.fn();
    render(
      <ElencoAdattivo
        righe={RIGHE}
        chiave={(r) => r.id}
        titolo={(r) => (
          <span>
            <span>{r.nome}</span>
            <select onChange={onNuovo} aria-label="un comando nuovo">
              <option value="x">x</option>
              <option value="y">y</option>
            </select>
          </span>
        )}
        campi={() => [{ chiave: "c", etichetta: "C", valore: "" }]}
        azione={() => ({ etichetta: "rimanda", onClick: () => {} })}
        onTocco={onTocco}
      />
    );
    const q = quadrottoDi("Rinnovo firma digitale");
    expect(q, "il quadrotto del telefono non ascolta nessun tocco").toBeTruthy();
    const comando = q.querySelector("select");
    fireEvent.change(comando, { target: { value: "y" } });
    fireEvent.click(comando);
    expect(onNuovo).toHaveBeenCalled();
    expect(onTocco).not.toHaveBeenCalled();
  });

  it("si apre anche dalla tastiera, con Invio e con la barra", () => {
    const onTocco = vi.fn();
    render(elenco(conAzione({ onTocco })));
    const q = quadrottoDi("Rinnovo firma digitale");
    expect(q.getAttribute("tabindex"), "il quadrotto non si raggiunge col tabulatore").toBe("0");
    expect(q.className, "il fuoco non si vede").toMatch(/focus-visible:outline/);
    fireEvent.keyDown(q, { key: "Enter", target: q });
    fireEvent.keyDown(q, { key: " ", target: q });
    expect(onTocco).toHaveBeenCalledTimes(2);
  });

  it("⚠️ la barra spaziatrice dentro un campo scrive uno spazio, non apre", () => {
    const onTocco = vi.fn();
    render(
      elenco({
        ...conAzione({ onTocco }),
        aperta: () => <input type="date" aria-label="rimanda al" />,
      })
    );
    const q = quadrottoDi("Rinnovo firma digitale");
    fireEvent.keyDown(q.querySelector("input[type=date]"), { key: " " });
    expect(onTocco).not.toHaveBeenCalled();
  });

  it("🔴 e quello che si è aperto sotto non richiude il quadrotto", () => {
    // Trovato censendo gli elenchi: in Magazzino il tocco APRE la riga, e
    // dentro l'area aperta c'è un modulo. Un dito appoggiato accanto a un
    // campo richiuderebbe la riga appena aperta, portandosi via quello che
    // si stava scrivendo.
    const onTocco = vi.fn();
    render(
      elenco({
        ...conAzione({ onTocco }),
        aperta: () => (
          <div>
            <p>Quanto ne è arrivato</p>
            <input type="number" aria-label="quantità" />
          </div>
        ),
      })
    );
    const q = quadrottoDi("Rinnovo firma digitale");
    fireEvent.click([...q.querySelectorAll("p")].find((p) => p.textContent.startsWith("Quanto")));
    expect(onTocco).not.toHaveBeenCalled();
  });
});

describe("la nota in fondo", () => {
  it("compare solo dove c'è qualcosa da dire", () => {
    render(
      elenco({
        azione: () => ({ etichetta: "rimanda", onClick: () => {} }),
        onTocco: () => {},
        nota: (r) => (r.origine ? "nato dalla posta" : null),
      })
    );
    // ⚠️ Sul telefono E sulla tabella: sono due forme dello stesso elenco,
    //    e una nota che c'è solo in una delle due è un'informazione che si
    //    perde cambiando dispositivo.
    expect(screen.getAllByText("nato dalla posta").length).toBe(2);
    // Sull'altra riga non c'è niente: una nota che c'è sempre torna a
    // essere una colonna, ed è quello da cui si veniva.
    expect(screen.queryByText("scritto a mano")).toBeNull();
  });
});
