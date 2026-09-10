// =====================================================================
// GLI IMPEGNI FINTI DELLA PROVA VISIVA
// =====================================================================
// La prova visiva monta la VERA schermata dell'Agenda in un browser vero;
// finte sono soltanto le letture. Nessuna di queste funzioni parla col
// database: la prova guarda la forma della scheda, non i dati.
//
// ⚠️ LE RIGHE SONO SCELTE PER METTERE IN DIFFICOLTÀ L'ALLINEAMENTO, non
//    per sembrare vere: un titolo lungo che va a capo, uno stellato che sta
//    nella sezione in testa, uno senza scadenza. Un titolo corto su una riga
//    sola lascerebbe passare anche un allineamento storto.
// ⚠️ E DUE SONO QUI PER NON FARSI VEDERE: uno nato dalla posta e uno
//    riservato. Dal collaudo dell'11/09 né la provenienza né «Riservato»
//    stanno nell'elenco, e la prova diventa rossa se ricompaiono.

const oggi = new Date();
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fra = (giorni) => iso(new Date(oggi.getTime() + giorni * 86400000));

const riga = (id, extra) => ({
  id,
  title: `Impegno ${id}`,
  description: null,
  due_date: fra(2),
  due_time: null,
  category: "altro",
  origine_modulo: null,
  preferito: false,
  ricorrenza_ogni: null,
  ricorrenza_unita: null,
  status: "da_fare",
  visibile_staff: true,
  corsia: "questa_settimana",
  giorni_in_lista: 3,
  giorni_alla_scadenza: 2,
  ...extra,
});

const RIGHE = [
  riga("a", {
    title: "Portare i corrispettivi di luglio al commercialista e farsi firmare la ricevuta",
    due_date: fra(1),
    giorni_alla_scadenza: 1,
  }),
  riga("b", { title: "Rinnovo firma digitale", origine_modulo: "posta", due_date: fra(3), giorni_alla_scadenza: 3 }),
  riga("c", { title: "Chiamare il tecnico della cella", visibile_staff: false }),
  riga("d", { title: "Sanificare la cappa", preferito: true, corsia: "questa_settimana" }),
  // Stellato e senza data: finisce in «Per me conta» accanto a uno datato, e
  // lì deve dire «quando capita» come gli altri dicono la data.
  riga("f", {
    title: "Prenotare la revisione dell'abbattitore",
    preferito: true,
    due_date: null,
    corsia: "quando_capita",
    giorni_alla_scadenza: null,
    giorni_in_lista: 5,
  }),
  riga("e", {
    title: "Ritirare le analisi dell'acqua",
    due_date: null,
    corsia: "quando_capita",
    giorni_alla_scadenza: null,
    giorni_in_lista: 40,
  }),
];

// Quante schede la prova deve trovare disegnate: se ne mancasse una, la
// misura delle altre non direbbe niente di lei.
export const QUANTE_SCHEDE = RIGHE.length;

// La scheda di UN impegno, per la prova della scheda (`TaskForm`): giorno,
// ora e promemoria compilati, così tutte e quattro le caselle di data e ora
// hanno qualcosa dentro — una casella vuota è più stretta di una piena.
// Si ripete (così la riga «ogni [n] [unità]» c'è da misurare, con l'unità
// più lunga) ed è nato dalla posta (così la provenienza c'è da cercare).
export const getTask = async (id) => ({
  ...riga(id, {
    title: "Rinnovare la polizza della cella frigorifera prima della scadenza",
    description: "",
    due_date: fra(5),
    due_time: "18:30:00",
    ricorrenza_ogni: 6,
    ricorrenza_unita: "settimane",
    origine_modulo: "posta",
  }),
  priority: "media",
  remind_at: new Date(oggi.getTime() + 4 * 86400000).toISOString(),
  reminder_sent_at: null,
});
export const createTask = async () => ({ id: "nuovo" });
export const updateTask = async () => ({});
export const deleteTask = async () => null;

export const agendaCorsie = async () => RIGHE;
export const agendaFatti = async () => [];
export const listTasksForMonth = async () => [];
export const completaTask = async () => null;
export const riapriTask = async () => ({});
export const spostaTask = async () => null;
export const stellaTask = async () => null;
