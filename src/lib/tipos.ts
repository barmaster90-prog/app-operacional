import type { DataISO } from "./datas.ts";

export type CasaId = "downtown" | "downtown_2p" | "don" | "calcada_av" | "calcada_ke";
export type AbaId = "geral" | "downtown" | "downtown2p" | "don" | "calcada";

export interface Casa {
  id: CasaId;
  nome: string;
  curto: string;
  aba: Exclude<AbaId, "geral">;
  /** Outras abas onde o evento também aparece (ex.: Downtown 2 pistas ocupa a pista do Don). */
  tambemEm?: Exclude<AbaId, "geral">[];
  cor: string;
  locais: string[];
}

export const CASAS: Casa[] = [
  { id: "downtown", nome: "Downtown", curto: "DT", aba: "downtown", cor: "#2f6fde", locais: [] },
  { id: "downtown_2p", nome: "Downtown 2 pistas", curto: "DT 2P", aba: "downtown2p", tambemEm: ["downtown", "don"], cor: "#2e9e5b", locais: [] },
  { id: "don", nome: "Don Under Pub", curto: "Don", aba: "don", cor: "#d6457a", locais: ["Pista", "Beco", "Praça"] },
  { id: "calcada_av", nome: "Calçada Antônio da Veiga", curto: "Calç. AV", aba: "calcada", cor: "#e08a1e", locais: [] },
  { id: "calcada_ke", nome: "Calçada Kurt Ehring", curto: "Calç. KE", aba: "calcada", cor: "#b8641a", locais: [] },
];

export const ABAS: { id: AbaId; nome: string }[] = [
  { id: "geral", nome: "Visão geral" },
  { id: "downtown", nome: "Downtown" },
  { id: "downtown2p", nome: "Downtown 2 pistas" },
  { id: "don", nome: "Don Under Pub" },
  { id: "calcada", nome: "Calçada" },
];

export function casa(id: CasaId): Casa {
  return CASAS.find((c) => c.id === id)!;
}

export const STATUS = ["Ideia", "Negociando", "Confirmado", "Divulgando", "Realizado", "Cancelado"] as const;
export type Status = (typeof STATUS)[number];

export const TIPOS_EVENTO = ["Interna", "Parceiros", "Universitária", "Temático sazonal", "Música ao vivo", "Outro"];

export interface Atracao {
  nome: string;
  /** Cachê em reais. Vazio quando é acordo de porta ou ainda não definido. */
  cache?: number | null;
  obs?: string;
}

export interface Evento {
  id: string;
  data: DataISO;
  /** Uma ou mais casas, para festas conjuntas. */
  casas: CasaId[];
  local?: string;
  nome: string;
  tipo?: string;
  status: Status;
  horario?: string;
  atracoes: Atracao[];
  entrada?: string;
  promocao?: string;
  briefing?: string;
  obs?: string;
  criado_por?: string;
  atualizado_em?: string;
}

export type EventoNovo = Omit<Evento, "id">;

export function eventoDaAba(e: Evento, aba: AbaId): boolean {
  return aba === "geral" || e.casas.some((c) => casa(c).aba === aba || casa(c).tambemEm?.includes(aba as Exclude<AbaId, "geral">));
}
