import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, ShoppingBag, Sparkles, TrendingUp, Zap } from "lucide-react";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

// Config visuelle centralisée
const STYLES = {
  borderRadius: {
    card: "rounded-3xl",
    button: "rounded-2xl",
    badge: "rounded-full",
    input: "rounded-2xl"
  },
  fontSize: {
    pageTitle: "text-[32px]",
    cardTitle: "text-[17px]",
    body: "text-[13px]",
    badge: "text-[11px]",
    button: "text-[13px]"
  },
  spacing: {
    page: "px-5 pb-24 pt-8",
    card: "p-7",
    section: "space-y-5"
  }
};

// Fallback local
const FALLBACK_DEALS = [
  {
    id: "deal-1",
    title: "Gourde isotherme (500–750ml)",
    category: "Hydratation",
    desc: "Pratique pour atteindre votre objectif quotidien, chaude/froide.",
    badge: "Indispensable",
    url: "https://www.amazon.fr/s?k=gourde+isotherme+inox",
    trending: true
  },
  {
    id: "deal-2",
    title: "Bouteille graduée motivation",
    category: "Hydratation",
    desc: "Repères horaires pour boire régulièrement.",
    badge: "Routine",
    url: "https://www.amazon.fr/s?k=bouteille+gradu%C3%A9e+motivation",
    new: true
  },
  {
    id: "deal-3",
    title: "Infuseur à thé en inox",
    category: "Bien-être",
    desc: "Pour varier les plaisirs avec des infusions maison.",
    badge: "Bien-être",
    url: "https://www.amazon.fr/s?k=infuseur+th%C3%A9+inox"
  }
];

const DEFAULT_REMOTE_URL = "https://zenhydratation.vercel.app/zenhydratation-deals.json";

// Composant Badge avec icône
function DealBadge({ text, variant = "default", icon: Icon }) {
  const variants = {
    default: "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-200",
    trending: "bg-gradient-to-r from-orange-50 to-red-50 text-orange-700 border-orange-200",
    new: "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border-emerald-200"
  };

  return (
    <span className={cn(
      "px-3 py-1.5",
      STYLES.borderRadius.badge,
      STYLES.fontSize.badge,
      "font-bold inline-flex items-center gap-1.5 border",
      variants[variant]
    )}>
      {Icon && <Icon className="h-3 w-3" />}
      {text}
    </span>
  );
}

// Skeleton de chargement
function DealCardSkeleton() {
  return (
    <div className={cn(STYLES.borderRadius.card, STYLES.spacing.card, "bg-white shadow-sm border border-gray-100 animate-pulse")}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="h-5 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-100 rounded w-full"></div>
          <div className="h-4 bg-gray-100 rounded w-2/3"></div>
          <div className="flex gap-2 mt-4">
            <div className="h-6 bg-gray-200 rounded-full w-20"></div>
            <div className="h-6 bg-gray-200 rounded-full w-24"></div>
          </div>
        </div>
        <div className="h-10 w-24 bg-gray-200 rounded-2xl"></div>
      </div>
    </div>
  );
}

export default function DealsPage({ remoteUrl = DEFAULT_REMOTE_URL }) {

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
          setErrorMsg("");
          setDeals(FALLBACK_DEALS);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, [remoteUrl]);

  const categories = useMemo(() => {
    const set = new Set(deals.map((d) => d.category).filter(Boolean));
    return ["Tous", ...Array.from(set)];
  }, [deals]);

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      const okCat = cat === "Tous" ? true : d.category === cat;
      return okCat;
    });
  }, [deals, cat]);

  return (
    <div className={cn(STYLES.spacing.page, STYLES.spacing.section, "bg-gradient-to-b from-gray-50 to-white min-h-screen")}>
      {/* Header avec gradient */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-blue-500/20">
            <ShoppingBag className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className={cn(STYLES.fontSize.pageTitle, "font-bold text-gray-900")}>
              Bons Plans
            </h1>
            <p className="text-[12px] text-gray-500 font-medium mt-0.5">
              {loading ? "Chargement..." : `${filtered.length} produit${filtered.length > 1 ? 's' : ''} disponible${filtered.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>


      </div>

      {/* Filtres catégories */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              STYLES.borderRadius.badge,
              "px-4 py-2 text-[12px] font-bold whitespace-nowrap transition-all shrink-0",
              cat === c
                ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Liste des deals avec skeleton */}
      <div className={STYLES.spacing.section}>
        {loading ? (
          <>
            <DealCardSkeleton />
            <DealCardSkeleton />
            <DealCardSkeleton />
          </>
        ) : filtered.length === 0 ? (
          <div className={cn(
            STYLES.borderRadius.card,
            "bg-white shadow-sm border border-gray-100 p-12 text-center"
          )}>
            <div className="bg-gray-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-[16px] font-bold text-gray-900 mb-2">Aucun résultat</h3>
            <p className="text-[13px] text-gray-500">
              Aucun produit dans cette catégorie pour le moment.
            </p>
          </div>
        ) : (
          filtered.map((d, idx) => (
            <div
              key={d.id}
              className={cn(
                STYLES.borderRadius.card,
                STYLES.spacing.card,
                "bg-white shadow-sm border border-gray-100 hover:shadow-xl hover:scale-[1.02] hover:border-gray-200 transition-all duration-300",
                "animate-in fade-in slide-in-from-bottom-4"
              )}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0 flex-1">
                  <h3 className={cn(STYLES.fontSize.cardTitle, "font-bold text-gray-900 leading-tight mb-2")}>
                    {d.title}
                  </h3>
                  <p className={cn(STYLES.fontSize.body, "text-gray-600 leading-relaxed mb-4")}>
                    {d.desc}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {d.trending && <DealBadge text="Tendance" variant="trending" icon={TrendingUp} />}
                    {d.new && <DealBadge text="Nouveau" variant="new" icon={Sparkles} />}
                    {d.category && <DealBadge text={d.category} variant="default" />}
                    {d.badge && <DealBadge text={d.badge} variant="default" icon={Zap} />}
                  </div>
                </div>

                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "shrink-0",
                    STYLES.borderRadius.button,
                    "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700",
                    "text-white font-bold",
                    STYLES.fontSize.button,
                    "px-5 py-3 shadow-lg shadow-blue-500/30",
                    "transition-all duration-300",
                    "inline-flex items-center gap-2",
                    "hover:scale-105 active:scale-95"
                  )}
                >
                  Voir
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
