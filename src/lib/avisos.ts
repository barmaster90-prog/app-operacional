import type { DataISO } from "./datas.ts";

export type TipoAviso = "mencao" | "tarefa" | "cobranca" | "producao";
/** Qual parte do evento o aviso abre. */
export type Destino = "evento" | "material" | "divulgacao" | "conversa" | "pedido";

export interface Aviso {
  id: string;
  para_id: string;
  de_nome?: string;
  tipo: TipoAviso;
  titulo: string;
  texto?: string;
  evento_id?: string;
  evento_data?: DataISO;
  /** Quando o aviso é de um pedido de arte (sem evento). */
  pedido_id?: string;
  abrir?: Destino;
  criado_em: string;
  lido: boolean;
}

export type AvisoNovo = Omit<Aviso, "id" | "criado_em" | "lido">;

export interface Comentario {
  id: string;
  evento_id: string;
  autor_id: string;
  autor_nome: string;
  texto: string;
  criado_em: string;
}

/** Corta um texto longo para caber no aviso. */
export function trecho(texto: string, max = 120): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo;
}
