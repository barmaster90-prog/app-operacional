import type { DataISO } from "./datas.ts";

export const REDES = ["Instagram", "TikTok", "WhatsApp", "Facebook", "Outro"] as const;
export const FORMATOS = ["Feed", "Story", "Reels", "Carrossel", "Status", "Outro"] as const;

export interface Postagem {
  id: string;
  data?: DataISO;
  rede: string;
  formato: string;
  responsavel_id?: string;
  feito: boolean;
}

/** Um vídeo a produzir para o evento. */
export interface Video {
  id: string;
  titulo: string;
  responsavel_id?: string;
  /** Texto livre de antes da equipe existir; vale quando não há responsavel_id. */
  responsavel?: string;
  prazo?: DataISO;
  roteiro?: string;
  feito: boolean;
}

export interface Divulgacao {
  evento_id: string;
  legenda?: string;
  link_venda?: string;
  postagens: Postagem[];
  impulsionar: boolean;
  impulso_inicio?: DataISO;
  impulso_fim?: DataISO;
  impulso_publico?: string;
  /** Valor investido no impulsionamento. Só a Gestão vê. */
  impulso_valor?: number | null;
  videos: Video[];
}

export type ListaFeita = "postagens" | "videos";

export function divulgacaoVazia(eventoId: string): Divulgacao {
  return { evento_id: eventoId, postagens: [], impulsionar: false, videos: [] };
}

export function normalizarDivulgacao(bruto: Record<string, unknown>): Divulgacao {
  const d = { ...bruto } as unknown as Divulgacao;
  if (!Array.isArray(d.postagens)) d.postagens = [];
  if (!Array.isArray(d.videos)) d.videos = [];
  d.impulsionar = Boolean(d.impulsionar);
  return d;
}

export const novoIdItem = () => Math.random().toString(36).slice(2, 10);

/** Resumo para o botão da ficha. Ex.: "2/5 postagens · 1/2 vídeos" */
export function resumoDivulgacao(d: Pick<Divulgacao, "postagens" | "videos">): string {
  const partes: string[] = [];
  if (d.postagens.length) partes.push(`${d.postagens.filter((p) => p.feito).length}/${d.postagens.length} postagens`);
  if (d.videos.length) partes.push(`${d.videos.filter((v) => v.feito).length}/${d.videos.length} vídeos`);
  return partes.join(" · ") || "Nada planejado ainda";
}
