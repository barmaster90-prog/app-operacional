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
  /** Quem cuida de levar a arte para a produção, e até quando. */
  responsavel_id?: string;
  prazo?: DataISO;
  em_producao: boolean;
  em_producao_por?: string;
  em_producao_em?: string;
  /** A agência terminou a arte. Só a Agência marca. */
  finalizado: boolean;
  finalizado_por?: string;
  finalizado_em?: string;
}

/** Vermelho: em aberto. Amarelo: em produção. Verde: finalizado. */
export type SituacaoArte = "aberto" | "producao" | "finalizado";

export const NOME_SITUACAO_ARTE: Record<SituacaoArte, string> = { aberto: "Em aberto", producao: "Em produção", finalizado: "Finalizado" };

export const situacaoArte = (x: { em_producao?: boolean; finalizado?: boolean }): SituacaoArte =>
  x.finalizado ? "finalizado" : x.em_producao ? "producao" : "aberto";

type ComSituacao = Pick<Material, "em_producao" | "em_producao_por" | "em_producao_em" | "finalizado" | "finalizado_por" | "finalizado_em">;

/** Muda a situação da arte guardando quem marcou e quando (mantém a marca antiga se a etapa já estava feita). */
export function comSituacao<T extends ComSituacao>(x: T, s: SituacaoArte, quem?: string): T {
  const agora = new Date().toISOString();
  const producao = s !== "aberto";
  const final = s === "finalizado";
  return {
    ...x,
    em_producao: producao,
    em_producao_por: producao ? (x.em_producao ? x.em_producao_por : quem) : undefined,
    em_producao_em: producao ? (x.em_producao ? x.em_producao_em : agora) : undefined,
    finalizado: final,
    finalizado_por: final ? (x.finalizado ? x.finalizado_por : quem) : undefined,
    finalizado_em: final ? (x.finalizado ? x.finalizado_em : agora) : undefined,
  };
}

const CAMPOS_SITUACAO = ["em_producao", "em_producao_por", "em_producao_em", "finalizado", "finalizado_por", "finalizado_em"] as const;

/** Tira a situação: ela só muda pelo botão da agência, nunca pelo "Salvar" de quem preenche. */
export function semSituacao<T extends object>(x: T): T {
  const copia = { ...x } as Record<string, unknown>;
  for (const c of CAMPOS_SITUACAO) delete copia[c];
  return copia as T;
}

/** Só a situação de um material ou pedido já gravado. */
export function situacaoGravada(x: Partial<ComSituacao> | undefined): Partial<ComSituacao> {
  const r: Record<string, unknown> = {};
  for (const c of CAMPOS_SITUACAO) if (x?.[c] !== undefined) r[c] = x[c];
  return r as Partial<ComSituacao>;
}

export function materialVazio(eventoId: string): Material {
  return { evento_id: eventoId, links_fotos: [], anexos: [], animado: { links: [] }, em_producao: false, finalizado: false };
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
  m.em_producao = Boolean(m.em_producao);
  m.finalizado = Boolean(m.finalizado);
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
