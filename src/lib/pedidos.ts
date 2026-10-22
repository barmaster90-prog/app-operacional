import { somarDias, type DataISO } from "./datas.ts";
import { materialVazio, normalizarMaterial, type Material } from "./material.ts";
import type { CasaId } from "./tipos.ts";
import type { DataEspecial } from "./feriados.ts";

/**
 * Pedido de arte que não é de um evento: data comemorativa, cardápio, vagas, aviso de horário.
 * Usa o mesmo briefing do Material: `responsavel_id` é quem faz e `prazo` é até quando entregar.
 */
export interface Pedido extends Omit<Material, "evento_id"> {
  id: string;
  titulo: string;
  /** Vazio = todas as casas. */
  casas: CasaId[];
  pecas: string[];
  /** Quando a arte vai ser usada (aparece no calendário nesse dia). */
  uso?: DataISO;
  entregue: boolean;
  criado_por?: string;
  criado_em?: string;
}

export const PECAS = ["Feed", "Story", "Reels / Animado", "Carrossel", "Impresso", "Cardápio", "Banner"];

export type SituacaoPedido = "aberto" | "producao" | "entregue";

export const situacaoPedido = (p: Pick<Pedido, "entregue" | "em_producao">): SituacaoPedido =>
  p.entregue ? "entregue" : p.em_producao ? "producao" : "aberto";

export function pedidoVazio(campos: Partial<Pedido> = {}): Pedido {
  const { evento_id: _id, ...m } = materialVazio("");
  return { ...m, id: "", titulo: "", casas: [], pecas: [], entregue: false, ...campos };
}

export function normalizarPedido(bruto: Record<string, unknown>): Pedido {
  const { evento_id: _id, ...m } = normalizarMaterial({ ...bruto, evento_id: "" });
  const p = m as unknown as Pedido;
  if (!Array.isArray(p.casas)) p.casas = [];
  if (!Array.isArray(p.pecas)) p.pecas = [];
  p.entregue = Boolean(p.entregue);
  p.em_producao = Boolean(p.em_producao);
  return p;
}

/** O pedido visto como Material (para reaproveitar a tela do briefing). */
export const materialDoPedido = (p: Pedido): Material => ({ ...p, evento_id: p.id });

/** Data comercial que pede arte e ainda não tem pedido, dentro da janela de aviso. */
export interface Lembrete {
  data: DataEspecial;
  faltam: number;
}

export function lembretesDeArte(datas: DataEspecial[], pedidos: Pedido[], hoje: DataISO): Lembrete[] {
  const lista: Lembrete[] = [];
  for (const d of datas) {
    if (!d.precisa_arte || d.data < hoje) continue;
    const antes = d.avisar_dias ?? 21;
    if (somarDias(d.data, -antes) > hoje) continue;
    if (pedidos.some((p) => p.uso === d.data)) continue;
    lista.push({ data: d, faltam: diasEntre(hoje, d.data) });
  }
  return lista.sort((a, b) => a.data.data.localeCompare(b.data.data));
}

function diasEntre(de: DataISO, ate: DataISO): number {
  const [a, b] = [de, ate].map((x) => Date.UTC(+x.slice(0, 4), +x.slice(5, 7) - 1, +x.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}
