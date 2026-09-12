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
  {
    id: "midas-hd96",
    name: "Midas HD96",
    category: "console",
    ports: [
      // Inout
      { id: "snake-1", label: "Snake 1", protocol: "Snake", direction: "inout", media: "optique ou cuivre" },
      { id: "snake-2", label: "Snake 2", protocol: "Snake", direction: "inout", media: "optique ou cuivre" },
      { id: "ethernet", label: "Ethernet", protocol: "Ethernet", direction: "inout" },
      { id: "dante-primary", label: "Dante Primary", protocol: "Dante", direction: "inout" },
      { id: "dante-secondary", label: "Dante Secondary", protocol: "Dante", direction: "inout" },
      { id: "aes50-a", label: "AES50 A", protocol: "AES50", direction: "inout" },
      { id: "aes50-b", label: "AES50 B", protocol: "AES50", direction: "inout" },
      { id: "aes50-c", label: "AES50 C", protocol: "AES50", direction: "inout" },
      { id: "aes50-d", label: "AES50 D", protocol: "AES50", direction: "inout" },
      { id: "ultranet", label: "Ultranet", protocol: "Ultranet", direction: "inout" },
      { id: "midi-thru", label: "MIDI Thru", protocol: "MIDI", direction: "inout" },
      // In
      { id: "analog-in-1", label: "Analog In 1", protocol: "Analog", direction: "in" },
      { id: "analog-in-2", label: "Analog In 2", protocol: "Analog", direction: "in" },
      { id: "analog-in-3", label: "Analog In 3", protocol: "Analog", direction: "in" },
      { id: "analog-in-4", label: "Analog In 4", protocol: "Analog", direction: "in" },
      { id: "analog-in-5", label: "Analog In 5", protocol: "Analog", direction: "in" },
      { id: "analog-in-6", label: "Analog In 6", protocol: "Analog", direction: "in" },
      { id: "analog-in-7", label: "Analog In 7", protocol: "Analog", direction: "in" },
      { id: "analog-in-8", label: "Analog In 8", protocol: "Analog", direction: "in" },
      { id: "aes3-in-1-2", label: "AES3 In 1&2", protocol: "AES3", direction: "in" },
      { id: "aes3-in-3-4", label: "AES3 In 3&4", protocol: "AES3", direction: "in" },
      { id: "aes3-in-sync", label: "AES3 In Sync", protocol: "AES3", direction: "in" },
      { id: "midi-in", label: "MIDI In", protocol: "MIDI", direction: "in" },
      { id: "wordclock-in", label: "Word Clock In", protocol: "WordClock", direction: "in" },
      // Out
      { id: "analog-out-1", label: "Analog Out 1", protocol: "Analog", direction: "out" },
      { id: "analog-out-2", label: "Analog Out 2", protocol: "Analog", direction: "out" },
      { id: "analog-out-3", label: "Analog Out 3", protocol: "Analog", direction: "out" },
      { id: "analog-out-4", label: "Analog Out 4", protocol: "Analog", direction: "out" },
      { id: "analog-out-5", label: "Analog Out 5", protocol: "Analog", direction: "out" },
      { id: "analog-out-6", label: "Analog Out 6", protocol: "Analog", direction: "out" },
      { id: "analog-out-7", label: "Analog Out 7", protocol: "Analog", direction: "out" },
      { id: "analog-out-8", label: "Analog Out 8", protocol: "Analog", direction: "out" },
      { id: "aes3-out-1-2", label: "AES3 Out 1&2", protocol: "AES3", direction: "out" },
      { id: "aes3-out-3-4", label: "AES3 Out 3&4", protocol: "AES3", direction: "out" },
      { id: "aes3-out-sync", label: "AES3 Out Sync", protocol: "AES3", direction: "out" },
      { id: "midi-out", label: "MIDI Out", protocol: "MIDI", direction: "out" },
      { id: "wordclock-out", label: "Word Clock Out", protocol: "WordClock", direction: "out" },
    ],
  },
];
