/**
 * Il lettore dei flussi CBI «Rendicontazione saldi e movimenti» (RH).
 *
 * È il file che la banca prepara ogni giorno lavorativo e che da Credem
 * Business On si scarica da «Conti correnti → Scarico flussi CBI». È un
 * formato a posizioni fisse (righe da 120 caratteri), lo standard
 * interbancario italiano: si legge per posizione, senza nessuna
 * interpretazione — quindi senza nessun modello e senza la possibilità
 * di leggere male un importo.
 *
 * Le righe che contano:
 *   RH  testa del file (chi lo manda, quando, come si chiama)
 *   61  saldo iniziale di un conto
 *   62  un movimento
 *   63  il dettaglio di un movimento (una o più righe sotto il 62)
 *   64  saldo finale
 *   65  liquidità futura (letta e ignorata)
 *   EF  coda del file, con il numero di righe
 *
 * ⚠️ «SI FERMA O CONTINUA ZITTO?» — si ferma. Un file letto a metà
 * sembrerebbe intero (la famiglia del §8 di CLAUDE.md, «una risposta più
 * corta che ha l'aria di essere intera»), quindi ogni rendicontazione si
 * controlla due volte con dati che il file stesso dichiara:
 *   - saldo iniziale + movimenti = saldo finale, al centesimo;
 *   - il numero di righe dichiarato nella coda = le righe lette.
 * Se uno dei due non torna, `errori` non è vuoto e chi chiama non deve
 * caricare niente. Gli errori si raccolgono TUTTI, non solo il primo.
 *
 * ⚠️ Le posizioni sono state misurate il 24/10/2026 su tre file veri di
 * Credem, non prese da una documentazione. Una sola non era verificabile
 * su quei file: quale delle due date del 62 sia la VALUTA e quale la
 * CONTABILE — nei tre file coincidevano. Seguono l'ordine dello standard
 * (valuta prima, contabile dopo) e vanno riguardate sul primo file in cui
 * differiscono (le competenze trimestrali: contabile 08/10, valuta 30/09).
 */

const LUNGHEZZA = 120;

/** Il pezzo di riga fra due posizioni, contate da 1 come nello standard. */
function campo(riga, da, a) {
  return riga.slice(da - 1, a);
}

/** «201026» → «2026-10-20». Restituisce null se non è una data vera. */
export function dataCbi(s) {
  if (!/^\d{6}$/.test(s)) return null;
  const gg = Number(s.slice(0, 2));
  const mm = Number(s.slice(2, 4));
  const aa = 2000 + Number(s.slice(4, 6));
  const d = new Date(Date.UTC(aa, mm - 1, gg));
  if (d.getUTCFullYear() !== aa || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== gg) {
    return null;
  }
  return `${aa}-${String(mm).padStart(2, "0")}-${String(gg).padStart(2, "0")}`;
}

/**
 * Segno + importo in centesimi: («D», «000000004941,00») → -494100.
 * I centesimi interi evitano che 0,1 + 0,2 faccia 0,30000000000000004
 * proprio dentro il controllo della quadratura.
 */
export function centesimiCbi(segno, importo) {
  if (segno !== "C" && segno !== "D") return null;
  if (!/^\d{12},\d{2}$/.test(importo)) return null;
  const c = Number(importo.replace(",", ""));
  return segno === "D" ? -c : c;
}

const IBAN_IT = /\bIT\d{2}[A-Z]\d{10}[0-9A-Z]{12}\b/;

/**
 * Legge il testo di un flusso CBI RH.
 *
 * @returns {{ supporto: object|null, conti: object[], errori: string[] }}
 *   Ogni conto ha IBAN, saldo iniziale e finale e i suoi movimenti; gli
 *   importi sono in centesimi (con segno: negativo = uscita).
 */
export function leggiFlussoCbi(testo) {
  const errori = [];
  const conti = [];
  let supporto = null;
  let corrente = null; // la rendicontazione aperta da un 61
  let ultimo = null; // l'ultimo movimento, a cui si attaccano i 63
  let righeLette = 0;
  let codaVista = false;

  const righe = String(testo ?? "").split(/\r?\n/);
  righe.forEach((grezza, i) => {
    if (grezza.trim() === "") return;
    const n = i + 1;
    // Gli spazi in coda possono perdersi passando da un programma
    // all'altro: si rimettono. Una riga più LUNGA invece non è un CBI.
    if (grezza.length > LUNGHEZZA) {
      errori.push(`Riga ${n}: è lunga ${grezza.length} caratteri, un flusso CBI ne ha ${LUNGHEZZA}.`);
      return;
    }
    const riga = grezza.padEnd(LUNGHEZZA, " ");
    const tipo = campo(riga, 2, 3);
    righeLette++;

    if (codaVista) {
      errori.push(`Riga ${n}: c'è ancora qualcosa dopo la coda del file (EF).`);
      return;
    }

    switch (tipo) {
      case "RH": {
        supporto = {
          abiMittente: campo(riga, 4, 8),
          sia: campo(riga, 9, 13).trim(),
          creatoIl: dataCbi(campo(riga, 14, 19)),
          nome: campo(riga, 20, 39).trim(),
        };
        if (!supporto.nome) errori.push(`Riga ${n}: la testa del file non ha un nome di supporto.`);
        break;
      }
      case "61": {
        if (corrente) errori.push(`Riga ${n}: si apre un conto nuovo prima che il precedente abbia il saldo finale.`);
        const cin = campo(riga, 52, 52);
        const abi = campo(riga, 53, 57);
        const cab = campo(riga, 58, 62);
        const numero = campo(riga, 63, 74);
        const paese = campo(riga, 100, 101);
        const controllo = campo(riga, 102, 103);
        const iban = /^[A-Z]{2}$/.test(paese) && /^\d{2}$/.test(controllo)
          ? `${paese}${controllo}${cin}${abi}${cab}${numero}`
          : null;
        const data = dataCbi(campo(riga, 78, 83));
        const saldo = centesimiCbi(campo(riga, 84, 84), campo(riga, 85, 99));
        if (!data || saldo === null) errori.push(`Riga ${n}: il saldo iniziale non si legge.`);
        corrente = {
          progressivo: campo(riga, 4, 10),
          iban,
          abi,
          cab,
          numero,
          divisa: campo(riga, 75, 77),
          saldoIniziale: { data, centesimi: saldo },
          saldoFinale: null,
          movimenti: [],
        };
        ultimo = null;
        break;
      }
      case "62": {
        if (!corrente) {
          errori.push(`Riga ${n}: un movimento senza il conto a cui appartiene.`);
          break;
        }
        const dataValuta = dataCbi(campo(riga, 14, 19));
        const dataContabile = dataCbi(campo(riga, 20, 25));
        const centesimi = centesimiCbi(campo(riga, 26, 26), campo(riga, 27, 41));
        if (!dataValuta || !dataContabile) errori.push(`Riga ${n}: le date del movimento non si leggono.`);
        if (centesimi === null) errori.push(`Riga ${n}: l'importo del movimento non si legge.`);
        ultimo = {
          progressivo: campo(riga, 11, 13),
          dataValuta,
          dataContabile,
          centesimi,
          causaleAbi: campo(riga, 42, 43).trim(),
          causaleInterna: campo(riga, 44, 45).trim(),
          numeroAssegno: campo(riga, 46, 61).trim() || null,
          riferimentoBanca: campo(riga, 62, 77).trim() || null,
          descrizione: campo(riga, 87, 120).replace(/\s+/g, " ").trim(),
          dettagli: [],
          ibanControparte: null,
        };
        corrente.movimenti.push(ultimo);
        break;
      }
      case "63": {
        if (!ultimo || campo(riga, 11, 13) !== ultimo.progressivo) {
          errori.push(`Riga ${n}: un dettaglio che non appartiene al movimento sopra di lui.`);
          break;
        }
        const testoDettaglio = campo(riga, 14, 120).replace(/\s+/g, " ").trim();
        if (testoDettaglio) ultimo.dettagli.push(testoDettaglio);
        if (!ultimo.ibanControparte) {
          const m = testoDettaglio.match(IBAN_IT);
          if (m) ultimo.ibanControparte = m[0];
        }
        break;
      }
      case "64": {
        if (!corrente) {
          errori.push(`Riga ${n}: un saldo finale senza il conto a cui appartiene.`);
          break;
        }
        const data = dataCbi(campo(riga, 14, 19));
        const contabile = centesimiCbi(campo(riga, 20, 20), campo(riga, 21, 35));
        const disponibile = centesimiCbi(campo(riga, 36, 36), campo(riga, 37, 51));
        if (!data || contabile === null) errori.push(`Riga ${n}: il saldo finale non si legge.`);
        corrente.saldoFinale = { data, centesimi: contabile, disponibile };

        // La prova del nove: quello che c'era + quello che si è mosso.
        const somma = corrente.movimenti.reduce((s, m) => s + (m.centesimi ?? 0), 0);
        if (corrente.saldoIniziale.centesimi !== null && contabile !== null
            && corrente.saldoIniziale.centesimi + somma !== contabile) {
          errori.push(
            `Il conto ${corrente.iban ?? corrente.numero} non quadra: saldo iniziale ${euro(corrente.saldoIniziale.centesimi)}`
            + ` più i movimenti (${euro(somma)}) fa ${euro(corrente.saldoIniziale.centesimi + somma)},`
            + ` ma la banca dichiara ${euro(contabile)}. Il file potrebbe essere incompleto.`,
          );
        }
        conti.push(corrente);
        corrente = null;
        ultimo = null;
        break;
      }
      case "65":
        break;
      case "EF": {
        codaVista = true;
        const dichiarate = Number(campo(riga, 83, 89));
        if (!Number.isInteger(dichiarate) || dichiarate !== righeLette) {
          errori.push(`La coda del file dichiara ${Number.isInteger(dichiarate) ? dichiarate : "?"} righe, ne sono state lette ${righeLette}. Il file potrebbe essere incompleto.`);
        }
        break;
      }
      default:
        errori.push(`Riga ${n}: tipo di riga «${tipo.trim()}» sconosciuto — non sembra un flusso CBI di saldi e movimenti.`);
    }
  });

  if (!supporto) errori.push("Manca la testa del file (RH): non sembra un flusso CBI di saldi e movimenti.");
  if (corrente) errori.push("Un conto è rimasto senza saldo finale: il file è troncato.");
  if (!codaVista) errori.push("Manca la coda del file (EF): il file è troncato.");

  return { supporto, conti, errori };
}

function euro(centesimi) {
  const v = (centesimi / 100).toFixed(2).replace(".", ",");
  return `${v} €`;
}

/**
 * L'impronta di un movimento, per non caricarlo due volte.
 *
 * Il progressivo del 62 ricomincia da 001 in ogni file, quindi da solo
 * non distingue niente. L'impronta mette insieme tutto ciò che la banca
 * scrive del movimento: conto, date, importo, causali, riferimento e
 * descrizione completa. Due movimenti diversi con TUTTI questi campi
 * uguali nello stesso giorno (due commissioni identiche) si distinguono
 * col numero d'ordine dentro il giorno, che chi chiama aggiunge.
 */
export function improntaMovimento(iban, m) {
  return [
    iban ?? "",
    m.dataContabile,
    m.dataValuta,
    m.centesimi,
    m.causaleAbi,
    m.causaleInterna,
    m.riferimentoBanca ?? "",
    m.numeroAssegno ?? "",
    m.descrizione,
    m.dettagli.join(" | "),
  ].join("§");
}

/**
 * I movimenti di un conto nella forma che il database si aspetta
 * (`carica_movimenti_banca`): importi in euro, date ISO, e l'impronta
 * resa unica dentro il file.
 *
 * ⚠️ Due movimenti con TUTTI i campi uguali (due commissioni identiche lo
 * stesso giorno) sono due fatti, non un doppione: il secondo prende «#2»
 * in coda all'impronta. Il numero d'ordine segue l'ordine del file, che
 * è lo stesso in ogni estratto che contiene quei due movimenti — quindi
 * ricaricando un estratto che si sovrappone non entrano due volte.
 */
export function movimentiDaCaricare(conto) {
  const visti = new Map();
  return conto.movimenti.map((m) => {
    const base = improntaMovimento(conto.iban, m);
    const n = (visti.get(base) ?? 0) + 1;
    visti.set(base, n);
    return {
      impronta: n === 1 ? base : `${base}#${n}`,
      data_contabile: m.dataContabile,
      data_valuta: m.dataValuta,
      importo: m.centesimi / 100,
      causale_abi: m.causaleAbi ?? null,
      causale_interna: m.causaleInterna ?? null,
      riferimento_banca: m.riferimentoBanca ?? null,
      numero_assegno: m.numeroAssegno ?? null,
      descrizione: m.descrizione,
      dettagli: m.dettagli.length ? m.dettagli.join("\n") : null,
      iban_controparte: m.ibanControparte ?? null,
    };
  });
}
