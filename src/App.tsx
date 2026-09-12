import { Palette } from "./palette/Palette";
import { FlowCanvas } from "./canvas/FlowCanvas";

function App() {
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Palette />
      <main style={{ flex: 1 }}>
        <FlowCanvas />
      </main>
    </div>
  );
}

export default App;
