import { diaDaSemana, partes, somarDias, type DataISO } from "./datas.ts";
import { datasFixasDoAno, type DataEspecial } from "./feriados.ts";

export interface Anexo {
  nome: string;
  url: string;
  /** Caminho no armazenamento do Supabase (vazio no modo demonstração). */
  caminho?: string;
}

/** O que a agência precisa para construir a arte, além do que já está na ficha do evento. */
export interface Material {
  evento_id: string;
  descricao?: string;
  ideia?: string;
  marca_dagua: boolean;
  link_fotos?: string;
  logotipo?: string;
  referencia?: string;
  importante?: string;
  anexos: Anexo[];
  em_producao: boolean;
  em_producao_por?: string;
  em_producao_em?: string;
}

export function materialVazio(eventoId: string): Material {
  return { evento_id: eventoId, marca_dagua: false, anexos: [], em_producao: false };
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
