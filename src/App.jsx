import { Clock } from "./components/Clock";
import ZenhydratationApp from "./ZenhydratationApp.jsx";
export default function App() {
  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header stable (pas de state global qui change toutes les secondes) */}
      <header style={{ padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <strong>Zen &amp; Hydrate</strong>
        <div style={{ marginLeft: "auto", opacity: 0.8 }}>
          <Clock />
        </div>
      </header>

      {/* Contenu app */}
      <main style={{ padding: 12 }}>
        {/* Remets ici tes routes / composants existants */}
        {/* Exemple:
            <RouterProvider router={router} />
        */}
      </main>
    </div>
  );
}
