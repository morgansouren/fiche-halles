import type { DeviceModel } from "./equipment";

// Catalogue d'exemple : de quoi tester le filtrage par protocole
// (une console avec un port Dante et un port AES50, un boîtier
// compatible avec chacun de ces deux protocoles, et une enceinte).
export const catalog: DeviceModel[] = [
  {
    id: "console-standard",
    name: "Console numérique",
    category: "console",
    ports: [
      { id: "dante-out", label: "Dante Out", protocol: "Dante", direction: "out" },
      { id: "dante-in", label: "Dante In", protocol: "Dante", direction: "in" },
      { id: "aes50-a", label: "AES50 A", protocol: "AES50", direction: "inout" },
      { id: "analog-out-1", label: "Analog Out 1", protocol: "Analog", direction: "out" },
    ],
  },
  {
    id: "stagebox-dante",
    name: "Boîtier de scène Dante",
    category: "converter",
    ports: [
      { id: "dante-in", label: "Dante In", protocol: "Dante", direction: "in" },
      { id: "dante-out", label: "Dante Out", protocol: "Dante", direction: "out" },
      { id: "analog-in-1", label: "Analog In 1", protocol: "Analog", direction: "in" },
      { id: "analog-in-2", label: "Analog In 2", protocol: "Analog", direction: "in" },
    ],
  },
  {
    id: "stagebox-aes50",
    name: "Boîtier AES50",
    category: "converter",
    ports: [
      { id: "aes50-a", label: "AES50 A", protocol: "AES50", direction: "inout" },
      { id: "analog-out-1", label: "Analog Out 1", protocol: "Analog", direction: "out" },
      { id: "analog-out-2", label: "Analog Out 2", protocol: "Analog", direction: "out" },
    ],
  },
  {
    id: "speaker-active",
    name: "Enceinte active",
    category: "speaker",
    ports: [{ id: "analog-in", label: "Analog In", protocol: "Analog", direction: "in" }],
  },
];
