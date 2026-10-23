import { somarDias, type DataISO } from "./datas.ts";
import { materialVazio, normalizarMaterial, situacaoArte, type Material, type SituacaoArte } from "./material.ts";
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
  criado_por?: string;
  /** Quem criou: pode apagar o pedido, além da Gestão. */
  criado_por_id?: string;
  criado_em?: string;
}

export const PECAS = ["Feed", "Story", "Reels / Animado", "Carrossel", "Impresso", "Cardápio", "Banner"];

export type SituacaoPedido = SituacaoArte;
export const situacaoPedido = situacaoArte;

export function pedidoVazio(campos: Partial<Pedido> = {}): Pedido {
  const { evento_id: _id, ...m } = materialVazio("");
  return { ...m, id: "", titulo: "", casas: [], pecas: [], ...campos };
}

export function normalizarPedido(bruto: Record<string, unknown>): Pedido {
  const { evento_id: _id, ...m } = normalizarMaterial({ ...bruto, evento_id: "" });
  const p = m as unknown as Pedido;
  if (!Array.isArray(p.casas)) p.casas = [];
  if (!Array.isArray(p.pecas)) p.pecas = [];
  // "entregue" era marcado pelo marketing; virou "finalizado", marcado pela agência (23/10/2026).
  const antigo = p as Pedido & { entregue?: boolean };
  p.finalizado = Boolean(p.finalizado || antigo.entregue);
  delete antigo.entregue;
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
