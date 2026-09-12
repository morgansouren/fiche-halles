import { Palette } from "./palette/Palette";

function App() {
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Palette />
      <main style={{ flex: 1 }} />
    </div>
  );
}

export default App;
