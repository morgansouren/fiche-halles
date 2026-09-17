import { Palette } from "./palette/Palette";
import { FlowCanvas } from "./canvas/FlowCanvas";
import { CatalogProvider } from "./domain/CatalogContext";

function App() {
  return (
    <CatalogProvider>
      <div style={{ display: "flex", height: "100vh" }}>
        <Palette />
        <main style={{ flex: 1 }}>
          <FlowCanvas />
        </main>
      </div>
    </CatalogProvider>
  );
}

export default App;
