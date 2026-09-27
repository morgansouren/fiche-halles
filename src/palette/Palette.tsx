import { useState } from "react";
import { useCatalog } from "../domain/CatalogContext";
import type { DeviceModel, Discipline } from "../domain/equipment";
import { CreateDeviceForm } from "./CreateDeviceForm";
import "./Palette.css";

// Mime type custom pour identifier nos données de drag-and-drop
// (évite de collisionner avec d'autres usages du dataTransfer).
export const DEVICE_MODEL_MIME_TYPE = "application/x-fiche-halles-device";

// Un onglet par discipline technique, dans cet ordre d'affichage. Filtre
// d'abord la palette par discipline ; les catégories (Consoles, Switches...)
// s'affichent ensuite à l'intérieur de l'onglet actif, inchangées.
const DISCIPLINES: { id: Discipline; label: string }[] = [
  { id: "son", label: "Son" },
  { id: "video", label: "Vidéo" },
  { id: "lumiere", label: "Lumière" },
  { id: "reseau", label: "Réseau" },
];

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
  const { catalog, customDeviceIds, addCustomDevice, updateCustomDevice, deleteCustomDevice } = useCatalog();
  const [activeDiscipline, setActiveDiscipline] = useState<Discipline>("son");
  const [isCreating, setIsCreating] = useState(false);
  const [editingModel, setEditingModel] = useState<DeviceModel | null>(null);
  const disciplineDevices = catalog.filter((model) => model.discipline === activeDiscipline);
  const categories = Array.from(new Set(disciplineDevices.map((model) => model.category)));

  return (
    <aside className="palette">
      <div className="palette-tabs">
        {DISCIPLINES.map((discipline) => (
          <button
            key={discipline.id}
            type="button"
            className={`palette-tab${activeDiscipline === discipline.id ? " palette-tab-active" : ""}`}
            onClick={() => setActiveDiscipline(discipline.id)}
          >
            {discipline.label}
          </button>
        ))}
      </div>

      {categories.map((category) => (
        <div key={category} className="palette-category">
          <h3>{categoryLabel(category)}</h3>
          {disciplineDevices
            .filter((model) => model.category === category)
            .map((model) => {
              const isCustom = customDeviceIds.has(model.id);
              return (
                <div
                  key={model.id}
                  className="palette-item"
                  draggable
                  onDragStart={(event) => handleDragStart(event, model)}
                >
                  <span className="palette-item-label">{model.name}</span>
                  {/* Seuls les appareils créés depuis l'interface sont
                      modifiables/supprimables ici — jamais le catalogue
                      intégré, qui reste un fichier source (catalog.ts). */}
                  {isCustom && (
                    <span className="palette-item-actions">
                      <button
                        type="button"
                        className="palette-item-action"
                        title="Modifier cet appareil"
                        draggable={false}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingModel(model);
                        }}
                      >
                        E
                      </button>
                      <button
                        type="button"
                        className="palette-item-action palette-item-action-delete"
                        title="Supprimer cet appareil"
                        draggable={false}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteCustomDevice(model.id);
                        }}
                      >
                        ×
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
        </div>
      ))}

      <button type="button" className="palette-create-button" onClick={() => setIsCreating(true)}>
        + Nouvel appareil
      </button>

      {isCreating && (
        <CreateDeviceForm
          existingCategories={categories}
          discipline={activeDiscipline}
          onCancel={() => setIsCreating(false)}
          onSave={(model) => {
            addCustomDevice(model);
            setIsCreating(false);
          }}
        />
      )}

      {editingModel && (
        <CreateDeviceForm
          existingCategories={categories}
          discipline={editingModel.discipline}
          initialModel={editingModel}
          onCancel={() => setEditingModel(null)}
          onSave={(model) => {
            updateCustomDevice(editingModel.id, model);
            setEditingModel(null);
          }}
        />
      )}
    </aside>
  );
}
