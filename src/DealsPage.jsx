import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, ShoppingBag } from "lucide-react";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

const FALLBACK_DEALS = [
  {
    id: "deal-1",
    title: "Gourde isotherme (500–750ml)",
    category: "Hydratation",
    desc: "Pratique pour atteindre votre objectif quotidien, chaude/froide.",
    badge: "Indispensable",
    url: "https://www.amazon.fr/s?k=gourde+isotherme+inox"
  },
  {
    id: "deal-2",
    title: "Bouteille graduée motivation",
    category: "Hydratation",
    desc: "Repères horaires pour boire régulièrement.",
    badge: "Routine",
    url: "https://www.amazon.fr/s?k=bouteille+gradu%C3%A9e+motivation"
  }
];

const DEFAULT_REMOTE_URL = "https://zenhydratation.vercel.app/zenhydratation-deals.json";

export default function DealsPage({ theme, remoteUrl = DEFAULT_REMOTE_URL }) {
  const [cat, setCat] = useState("Tous");
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState(FALLBACK_DEALS);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErrorMsg("");
      try {
        const res = await fetch(remoteUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        const nextDeals = Array.isArray(json?.deals) ? json.deals : [];
        if (nextDeals.length === 0) throw new Error("JSON vide ou invalide.");

        if (alive) setDeals(nextDeals);
      } catch (e) {
        if (alive) {
          setErrorMsg("Impossible de charger les bons plans en ligne. Mode hors-ligne.");
          setDeals(FALLBACK_DEALS);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [remoteUrl]);

  const categories = useMemo(() => {
    const set = new Set(deals.map((d) => d.category).filter(Boolean));
    return ["Tous", ...Array.from(set)];
  }, [deals]);

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      return cat === "Tous" ? true : d.category === cat;
    });
  }, [deals, cat]);

  // Theme par défaut
  const defaultTheme = {
    id: "default",
    textPrimary: "text-gray-900",
    textSecondary: "text-gray-600",
    textMuted: "text-gray-500",
    card: "bg-white shadow-sm",
    cardSoft: "bg-gray-50",
    surfaceInput: "bg-white border border-gray-200"
  };

  const activeTheme = theme || defaultTheme;

  return (
    <div className="min-h-screen bg-gray-50 px-5 pb-24 pt-6 space-y-6">
      <div className="flex items-end justify-between">
        <div className={cn("text-[28px] font-semibold", activeTheme.textPrimary)}>Bons Plans</div>

        <div className={cn("rounded-2xl px-4 py-2 flex items-center gap-2", activeTheme.cardSoft)}>
          <ShoppingBag className={cn("h-4 w-4", activeTheme.id === "neo" ? "text-white/80" : "text-gray-700")} />
          <span className={cn("text-[13px] font-semibold", activeTheme.textSecondary)}>
            {loading ? "…" : filtered.length}
          </span>
        </div>
      </div>

      {errorMsg ? (
        <div className={cn("rounded-[28px] p-5", activeTheme.card)}>
          <div className={cn("text-[12px]", activeTheme.textMuted)}>{errorMsg}</div>
        </div>
      ) : null}

      <div className={cn("rounded-[28px] p-5", activeTheme.card)}>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className={cn("w-full rounded-2xl px-3 py-3 text-[13px] font-semibold", activeTheme.surfaceInput)}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {filtered.map((d) => (
          <div key={d.id} className={cn("rounded-[28px] p-6", activeTheme.card)}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className={cn("text-[18px] font-semibold", activeTheme.textPrimary)}>{d.title}</div>
                <div className={cn("mt-2 text-[13px] leading-snug", activeTheme.textSecondary)}>{d.desc}</div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {d.category ? (
                    <span
                      className={cn(
                        "px-3 py-1 rounded-full text-[12px] font-semibold",
                        activeTheme.id === "neo"
                          ? "bg-white/10 border border-white/10 text-white/75"
                          : "bg-black/[0.03] border border-black/10 text-gray-700"
                      )}
                    >
                      {d.category}
                    </span>
                  ) : null}

                  {d.badge ? (
                    <span
                      className={cn(
                        "px-3 py-1 rounded-full text-[12px] font-semibold",
                        activeTheme.id === "neo"
                          ? "bg-white/10 border border-white/10 text-white/75"
                          : "bg-black/[0.03] border border-black/10 text-gray-700"
                      )}
                    >
                      {d.badge}
                    </span>
                  ) : null}
                </div>
              </div>

              <a
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "shrink-0 rounded-2xl px-4 py-3 font-semibold text-[13px] transition inline-flex items-center gap-2",
                  activeTheme.cardSoft,
                  activeTheme.id === "neo" ? "hover:bg-white/[0.10]" : "hover:bg-black/[0.03]",
                  activeTheme.textPrimary
                )}
                title="Ouvrir sur Amazon"
              >
                Ouvrir
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 ? (
          <div className={cn("rounded-[28px] p-6", activeTheme.card)}>
            <div className={cn("text-[14px] font-semibold", activeTheme.textSecondary)}>
              Aucun bon plan ne correspond à votre recherche.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
            }
