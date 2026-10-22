import { useState } from "react";
import { useCatalog } from "../domain/CatalogContext";
import type { DeviceModel, Discipline, Port, PortDirection, Protocol } from "../domain/equipment";
import { slugify, uniqueId } from "../domain/customDevices";
import { categoryLabel } from "./categories";
import "./CreateDeviceForm.css";

const PROTOCOLS: Protocol[] = [
  "Analog",
  "Aux",
  "Dante",
  "AES50",
  "AES3",
  "MADI",
  "Snake",
  "Ethernet",
  "MIDI",
  "WordClock",
  "Ultranet",
  "VideoSync",
  "Adat",
  "Speakon",
  "USB",
  "Thunderbolt",
  "HDMI",
  "MiniDisplayPort",
  "SDI",
  "RGB",
  "DVI",
  "Serial",
  "Remote",
];

const NEW_CATEGORY_VALUE = "__new__";

interface DraftPort {
  key: string;
  label: string;
  protocol: Protocol;
  direction: PortDirection;
  group: string;
}

function newDraftPort(): DraftPort {
  return { key: crypto.randomUUID(), label: "", protocol: "Analog", direction: "out", group: "" };
}

export interface CreateDeviceFormProps {
  existingCategories: string[];
  // La discipline (onglet de la palette) n'est jamais un champ du
  // formulaire : elle vient de l'onglet actif au moment de l'ouverture
  // (voir Palette.tsx) et reste fixe pour la durée de l'édition — un
  // appareil ne change pas d'onglet depuis ce formulaire.
  discipline: Discipline;
  // Présent = on édite cet appareil existant (id conservé tel quel, pas
  // régénéré même si le nom change) ; absent = création d'un nouvel
  // appareil (voir Palette.tsx, qui choisit lequel selon le bouton cliqué).
  initialModel?: DeviceModel;
  onCancel: () => void;
  onSave: (model: DeviceModel) => void;
}

function draftPortsFrom(model: DeviceModel | undefined): DraftPort[] {
  if (!model || model.ports.length === 0) return [newDraftPort()];
  return model.ports.map((port) => ({
    key: crypto.randomUUID(),
    label: port.label,
    protocol: port.protocol,
    direction: port.direction,
    group: port.group ?? "",
  }));
}

// Formulaire de création (ou d'édition, si initialModel est fourni) d'un
// appareil personnalisé : nom, catégorie (existante ou nouvelle),
// disposition, et une liste de ports définis un par un. Enregistrer
// construit un DeviceModel classique et le confie à onSave, qui se charge
// de la persistance (voir CatalogContext.tsx).
export function CreateDeviceForm({ existingCategories, discipline, initialModel, onCancel, onSave }: CreateDeviceFormProps) {
  const { catalog } = useCatalog();
  const isEditing = !!initialModel;
  const [name, setName] = useState(initialModel?.name ?? "");
  const [category, setCategory] = useState(initialModel?.category ?? existingCategories[0] ?? NEW_CATEGORY_VALUE);
  const [newCategory, setNewCategory] = useState("");
  const [layoutHorizontal, setLayoutHorizontal] = useState(initialModel?.layout === "horizontal");
  const [ports, setPorts] = useState<DraftPort[]>(() => draftPortsFrom(initialModel));
  const [error, setError] = useState<string | null>(null);

  const isNewCategory = category === NEW_CATEGORY_VALUE;

  function updatePort(key: string, patch: Partial<DraftPort>) {
    setPorts((current) => current.map((port) => (port.key === key ? { ...port, ...patch } : port)));
  }

  function removePort(key: string) {
    setPorts((current) => current.filter((port) => port.key !== key));
  }

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Le nom de l'appareil est requis.");
      return;
    }
    const finalCategory = isNewCategory ? newCategory.trim() : category;
    if (!finalCategory) {
      setError("Choisis une catégorie ou donne un nom à la nouvelle catégorie.");
      return;
    }
    const filledPorts = ports.filter((port) => port.label.trim() !== "");
    if (ports.length > 0 && filledPorts.length !== ports.length) {
      setError("Chaque port ajouté doit avoir un nom (ou être retiré avec ×).");
      return;
    }

    // En édition, l'id reste celui de l'appareil existant même si le nom
    // change — pas de raison de le régénérer pour une simple correction.
    const id = initialModel
      ? initialModel.id
      : uniqueId(slugify(trimmedName), new Set(catalog.map((model) => model.id)));

    const usedPortIds = new Set<string>();
    const finalPorts: Port[] = filledPorts.map((port) => {
      const portId = uniqueId(slugify(port.label), usedPortIds);
      usedPortIds.add(portId);
      return {
        id: portId,
        label: port.label.trim(),
        protocol: port.protocol,
        direction: port.direction,
        ...(port.group.trim() ? { group: port.group.trim() } : {}),
      };
    });

    const model: DeviceModel = {
      id,
      name: trimmedName,
      discipline,
      category: finalCategory,
      ports: finalPorts,
      ...(layoutHorizontal ? { layout: "horizontal" as const } : {}),
    };
    onSave(model);
  }

  return (
    <div className="device-form-overlay" onClick={onCancel}>
      <div className="device-form-panel" onClick={(event) => event.stopPropagation()}>
        <h2>{isEditing ? "Modifier l'appareil" : "Nouvel appareil"}</h2>

        <label className="device-form-field">
          Nom
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="ex. DL999" />
        </label>

        <label className="device-form-field">
          Catégorie
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {existingCategories.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
            <option value={NEW_CATEGORY_VALUE}>+ Nouvelle catégorie…</option>
          </select>
        </label>

        {isNewCategory && (
          <label className="device-form-field">
            Nom de la nouvelle catégorie
            <input
              type="text"
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              placeholder="ex. Éclairage"
            />
          </label>
        )}

        <label className="device-form-checkbox">
          <input
            type="checkbox"
            checked={layoutHorizontal}
            onChange={(event) => setLayoutHorizontal(event.target.checked)}
          />
          Disposition horizontale (une seule rangée, tous les ports visibles — comme un switch)
        </label>

        <h3>Ports</h3>
        {ports.map((port) => (
          <div className="device-form-port-row" key={port.key}>
            <input
              type="text"
              value={port.label}
              onChange={(event) => updatePort(port.key, { label: event.target.value })}
              placeholder="Nom du port"
            />
            <select value={port.protocol} onChange={(event) => updatePort(port.key, { protocol: event.target.value as Protocol })}>
              {PROTOCOLS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select value={port.direction} onChange={(event) => updatePort(port.key, { direction: event.target.value as PortDirection })}>
              <option value="in">In</option>
              <option value="out">Out</option>
              <option value="inout">Inout</option>
            </select>
            <input
              type="text"
              value={port.group}
              onChange={(event) => updatePort(port.key, { group: event.target.value })}
              placeholder="Groupe (optionnel)"
            />
            <button type="button" className="device-form-port-remove" onClick={() => removePort(port.key)} title="Retirer ce port">
              ×
            </button>
          </div>
        ))}
        <button type="button" className="device-form-add-port" onClick={() => setPorts((current) => [...current, newDraftPort()])}>
          + Ajouter un port
        </button>

        {error && <p className="device-form-error">{error}</p>}

        <div className="device-form-actions">
          <button type="button" className="device-form-cancel" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className="device-form-save" onClick={handleSave}>
            {isEditing ? "Enregistrer les modifications" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
