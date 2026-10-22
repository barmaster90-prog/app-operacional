import { diaDaSemana, partes, somarDias, type DataISO } from "./datas.ts";
import { datasFixasDoAno, type DataEspecial } from "./feriados.ts";

export interface Anexo {
  nome: string;
  url: string;
  /** Caminho no armazenamento do Supabase (vazio no modo demonstração). */
  caminho?: string;
}

export interface LinkArtista {
  artista?: string;
  url: string;
}

/** Versão animada da arte (vai junto para a agência). */
export interface Animado {
  formato?: string;
  duracao?: string;
  trilha?: string;
  /** Links da trilha, do YouTube, de referência. */
  links: string[];
  obs?: string;
}

export const FORMATOS_ANIMADO = ["Reels / Story (9:16)", "Feed (4:5)", "Quadrado (1:1)", "Horizontal (16:9)"];

/** O que a agência precisa para construir a arte, além do que já está na ficha do evento. */
export interface Material {
  evento_id: string;
  descricao?: string;
  ideia?: string;
  /** Um link por artista (press kit, fotos). */
  links_fotos: LinkArtista[];
  logotipo?: string;
  referencia?: string;
  importante?: string;
  anexos: Anexo[];
  animado: Animado;
  em_producao: boolean;
  em_producao_por?: string;
  em_producao_em?: string;
}

export function materialVazio(eventoId: string): Material {
  return { evento_id: eventoId, links_fotos: [], anexos: [], animado: { links: [] }, em_producao: false };
}

/** Aceita materiais gravados antes da lista de links (campo único link_fotos). */
export function normalizarMaterial(bruto: Record<string, unknown>): Material {
  const { link_fotos, marca_dagua: _marca, ...resto } = bruto as Record<string, unknown> & { link_fotos?: unknown; marca_dagua?: unknown };
  const m = { ...resto } as unknown as Material;
  if (!Array.isArray(m.links_fotos)) m.links_fotos = [];
  if (typeof link_fotos === "string" && link_fotos.trim() && m.links_fotos.length === 0) m.links_fotos = [{ url: link_fotos.trim() }];
  if (!Array.isArray(m.anexos)) m.anexos = [];
  if (!m.animado || typeof m.animado !== "object") m.animado = { links: [] };
  if (!Array.isArray(m.animado.links)) m.animado = { ...m.animado, links: [] };
  return m;
}

const DIAS_SEMANA_LONGO = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function eFeriado(data: DataISO, extras: DataEspecial[]): boolean {
  const ano = partes(data)[0];
  return [...datasFixasDoAno(ano), ...extras].some((d) => d.data === data && d.tipo === "feriado");
}

/**
 * Linha do "Topo" da arte, montada a partir do evento.
 * Ex.: "01/11 - Domingo - 22h - véspera de feriado"
 */
export function topoDaArte(data: DataISO, horario?: string, extras: DataEspecial[] = []): string {
  const [, m, d] = partes(data);
  const pedacos = [`${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`, DIAS_SEMANA_LONGO[diaDaSemana(data)]];
  if (horario) {
    const [h, min] = horario.split(":");
    pedacos.push(min && min !== "00" ? `${Number(h)}h${min}` : `${Number(h)}h`);
  }
  if (eFeriado(data, extras)) pedacos.push("feriado");
  else if (eFeriado(somarDias(data, 1), extras)) pedacos.push("véspera de feriado");
  return pedacos.join(" - ");
}
