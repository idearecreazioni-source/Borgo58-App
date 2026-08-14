const PATHS = {
  book: "M4 5.5C4 4.67 4.67 4 5.5 4H19v15H5.5A1.5 1.5 0 0 0 4 20.5v-15ZM4 20.5C4 19.67 4.67 19 5.5 19H19 M8 8h7 M8 11.5h7",
  receipt: "M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V3Z M9 8h6 M9 12h6 M9 16h4",
  box: "M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z M3 8.5v7L12 20l9-4.5v-7 M12 13v7",
  cash: "M3 7h18v10H3V7Z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z M6 7v10 M18 7v10",
  calendar: "M4 5h16v15H4V5Z M4 9.5h16 M8 3v4 M16 3v4 M8 13h2 M12 13h2 M16 13h2 M8 17h2",
  leaf: "M19 5C10 5 5 10 5 17c0 1 0 2 .5 2.5C6 20 7 20 8 20c7 0 12-5 12-14 0-.5 0-1-.3-1Z M8 20c1-4 4-8 10-13",
  percent: "M6 6h.01 M18 18h.01 M6 18 18 6 M6 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM18 20.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M16.2 16.2 21 21",
  share: "M18 5.5a2.5 2.5 0 1 0-2.4-3.2M18 21.5a2.5 2.5 0 1 0 2.4-3.2M6 15a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM8.3 13.3l7.4-4.1M8.3 12.7l7.4 4.1",
  printer: "M6 9V4h12v5 M4 9h16v7H4V9Z M6 16v4h12v-4 M8 12h.01",
  chat: "M4 5h16v11H8l-4 4V5Z M8 9.5h8 M8 12.5h5",
  chart: "M4 20V4 M4 20h16 M8 16v-5 M12.5 16V8 M17 16v-3",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5.2l3.2 2",
};

export default function Icon({ name, className = "w-5 h-5" }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
