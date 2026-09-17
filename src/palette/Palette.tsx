import { catalog } from "../domain/catalog";
import type { DeviceModel } from "../domain/equipment";
import "./Palette.css";

// Mime type custom pour identifier nos données de drag-and-drop
// (évite de collisionner avec d'autres usages du dataTransfer).
export const DEVICE_MODEL_MIME_TYPE = "application/x-fiche-halles-device";

const categoryLabels: Record<DeviceModel["category"], string> = {
  console: "Consoles",
  converter: "Boîtiers / convertisseurs",
  speaker: "Enceintes",
  amplifier: "Amplificateurs",
  switch: "Switches",
  rf: "Récepteurs / Émetteurs HF",
};

function handleDragStart(event: React.DragEvent, model: DeviceModel) {
  event.dataTransfer.setData(DEVICE_MODEL_MIME_TYPE, model.id);
  event.dataTransfer.effectAllowed = "move";
}

export function Palette() {
  const categories = Array.from(new Set(catalog.map((model) => model.category)));

  return (
    <aside className="palette">
      {categories.map((category) => (
        <div key={category} className="palette-category">
          <h3>{categoryLabels[category]}</h3>
          {catalog
            .filter((model) => model.category === category)
            .map((model) => (
              <div
                key={model.id}
                className="palette-item"
                draggable
                onDragStart={(event) => handleDragStart(event, model)}
              >
                {model.name}
              </div>
            ))}
        </div>
      ))}
    </aside>
  );
}
