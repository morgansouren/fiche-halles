import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { catalog as builtinCatalog } from "./catalog";
import type { DeviceModel } from "./equipment";
import { loadCustomDevices, saveCustomDevices } from "./customDevices";

// Catalogue effectif = catalogue intégré (catalog.ts, un fichier source
// que l'utilisateur édite lui-même à la main) + appareils créés depuis
// l'interface (voir palette/CreateDeviceForm.tsx), persistés dans le
// navigateur. Un contexte plutôt qu'un import direct de `catalog` dans
// Palette.tsx/FlowCanvas.tsx : les deux doivent voir les mêmes appareils
// personnalisés, y compris juste après leur création (pas de rechargement
// de page).
interface CatalogContextValue {
  catalog: DeviceModel[];
  // Seuls les appareils dont l'id figure ici sont modifiables/supprimables
  // depuis la palette (voir Palette.tsx) — jamais le catalogue intégré,
  // qui reste un fichier source à éditer à la main.
  customDeviceIds: Set<string>;
  addCustomDevice: (model: DeviceModel) => void;
  updateCustomDevice: (id: string, model: DeviceModel) => void;
  deleteCustomDevice: (id: string) => void;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [customDevices, setCustomDevices] = useState<DeviceModel[]>(() => loadCustomDevices());

  const addCustomDevice = (model: DeviceModel) => {
    setCustomDevices((current) => {
      const next = [...current, model];
      saveCustomDevices(next);
      return next;
    });
  };

  const updateCustomDevice = (id: string, model: DeviceModel) => {
    setCustomDevices((current) => {
      const next = current.map((existing) => (existing.id === id ? model : existing));
      saveCustomDevices(next);
      return next;
    });
  };

  const deleteCustomDevice = (id: string) => {
    setCustomDevices((current) => {
      const next = current.filter((existing) => existing.id !== id);
      saveCustomDevices(next);
      return next;
    });
  };

  const catalog = useMemo(() => [...builtinCatalog, ...customDevices], [customDevices]);
  const customDeviceIds = useMemo(() => new Set(customDevices.map((model) => model.id)), [customDevices]);

  return (
    <CatalogContext.Provider value={{ catalog, customDeviceIds, addCustomDevice, updateCustomDevice, deleteCustomDevice }}>
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog(): CatalogContextValue {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("useCatalog() doit être appelé sous <CatalogProvider>");
  return context;
}
