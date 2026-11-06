import type { DeviceCategory, Discipline } from "../domain/equipment";

// Catégories prévues d'avance pour chaque discipline, dans leur ordre
// d'affichage. Elles apparaissent dans la palette (et dans le menu du
// formulaire de création) même quand aucun appareil ne les utilise encore
// — sinon un onglet vide n'offrirait aucune catégorie où ranger un
// nouvel appareil. Les catégories des appareils existants (catalogue
// intégré ou créées depuis le formulaire) s'ajoutent à la suite.
export const disciplineCategories: Record<Discipline, DeviceCategory[]> = {
  son: [],
  video: ["video-source", "video-converter", "video-controller", "projector"],
  lumiere: [],
  reseau: [],
};

// Juste des intitulés plus lisibles pour les catégories connues — une
// catégorie créée depuis le formulaire n'y figure jamais, son propre texte
// (tel que tapé) sert alors directement de libellé.
const categoryLabels: Record<string, string> = {
  source: "Sources",
  console: "Consoles",
  converter: "Boîtiers / convertisseurs",
  speaker: "Enceintes",
  amplifier: "Amplificateurs",
  switch: "Switches",
  rf: "Récepteurs / Émetteurs HF",
  "video-source": "Sources",
  "video-converter": "Convertisseurs",
  "video-controller": "Contrôleurs",
  projector: "Projecteurs",
};

export function categoryLabel(category: string): string {
  return categoryLabels[category] ?? category;
}
