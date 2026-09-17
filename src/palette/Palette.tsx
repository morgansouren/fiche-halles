import { useState } from "react";
import { useCatalog } from "../domain/CatalogContext";
import type { DeviceModel } from "../domain/equipment";
import { CreateDeviceForm } from "./CreateDeviceForm";
import "./Palette.css";

// Mime type custom pour identifier nos données de drag-and-drop
// (évite de collisionner avec d'autres usages du dataTransfer).
export const DEVICE_MODEL_MIME_TYPE = "application/x-fiche-halles-device";

// Juste des intitulés plus lisibles pour les catégories du catalogue
// intégré (catalog.ts) — une catégorie créée depuis le formulaire n'y
// figure jamais, son propre texte (tel que tapé) sert alors directement
// de libellé d'en-tête.
const categoryLabels: Record<string, string> = {
  console: "Consoles",
  converter: "Boîtiers / convertisseurs",
  speaker: "Enceintes",
  amplifier: "Amplificateurs",
  switch: "Switches",
  rf: "Récepteurs / Émetteurs HF",
};

function categoryLabel(category: string): string {
  return categoryLabels[category] ?? category;
}

function handleDragStart(event: React.DragEvent, model: DeviceModel) {
  event.dataTransfer.setData(DEVICE_MODEL_MIME_TYPE, model.id);
  event.dataTransfer.effectAllowed = "move";
}

export function Palette() {
  const { catalog, addCustomDevice } = useCatalog();
  const [isCreating, setIsCreating] = useState(false);
  const categories = Array.from(new Set(catalog.map((model) => model.category)));

  return (
    <aside className="palette">
      {categories.map((category) => (
        <div key={category} className="palette-category">
          <h3>{categoryLabel(category)}</h3>
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

      <button type="button" className="palette-create-button" onClick={() => setIsCreating(true)}>
        + Nouvel appareil
      </button>

      {isCreating && (
        <CreateDeviceForm
          existingCategories={categories}
          onCancel={() => setIsCreating(false)}
          onSave={(model) => {
            addCustomDevice(model);
            setIsCreating(false);
          }}
        />
      )}
    </aside>
  );
}
