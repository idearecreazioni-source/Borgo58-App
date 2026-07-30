export default function Logo({ size = "md" }) {
  const dims = {
    sm: { box: "w-9 h-9", text: "text-sm", title: "text-base" },
    md: { box: "w-12 h-12", text: "text-base", title: "text-xl" },
    lg: { box: "w-16 h-16", text: "text-xl", title: "text-3xl" },
  }[size];

  return (
    <div className="flex items-center gap-3">
      <div
        className={`${dims.box} shrink-0 rounded-full bg-b58-terracotta text-b58-parchment flex items-center justify-center font-display font-semibold ${dims.text} tracking-tight ring-1 ring-b58-terracotta-dark/30`}
      >
        B58
      </div>
      <div className="leading-tight">
        <div className={`font-display ${dims.title} text-b58-charcoal`}>Borgo 58</div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-b58-charcoal-soft">
          Osteria Contemporanea
        </div>
      </div>
    </div>
  );
}
