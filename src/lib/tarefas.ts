import { somarDias, type DataISO } from "./datas.ts";
import { casa, type Evento } from "./tipos.ts";
import type { Destino } from "./avisos.ts";
import type { Material } from "./material.ts";
import type { Divulgacao } from "./divulgacao.ts";
import type { Pedido } from "./pedidos.ts";

export type TipoTarefa = "arte" | "post" | "video" | "pedido";

/** Uma coisa a fazer para um evento, montada a partir do Material e da Divulgação. */
export interface Tarefa {
  chave: string;
  tipo: TipoTarefa;
  titulo: string;
  /** Para um pedido de arte, um "evento" de mentira: nome = o pedido, data = quando vai ser usada, casas vazias = todas. */
  evento: Evento;
  pedido?: Pedido;
  prazo?: DataISO;
  responsavel_id?: string;
  /** O que vai ser postado, quando foi escrito. */
  detalhe?: string;
  feito: boolean;
}

export type Situacao = "feito" | "atrasada" | "semana" | "sem_prazo" | "depois";

export function montarTarefas(
  eventos: Evento[],
  materiais: Record<string, Material | undefined>,
  divulgacoes: Record<string, Divulgacao | undefined>,
  pedidos: Pedido[] = [],
): Tarefa[] {
  const lista: Tarefa[] = [];
  for (const p of pedidos) {
    if (p.entregue) continue;
    lista.push({
      chave: `pedido:${p.id}`,
      tipo: "pedido",
      titulo: "Pedido de arte",
      evento: { id: p.id, nome: p.titulo, data: p.uso ?? "", casas: p.casas, status: "Confirmado", atracoes: [] },
      pedido: p,
      prazo: p.prazo,
      responsavel_id: p.responsavel_id,
      feito: p.em_producao,
    });
  }
  for (const e of eventos) {
    const m = materiais[e.id];
    lista.push({
      chave: `${e.id}:arte`,
      tipo: "arte",
      titulo: "Arte para produção",
      evento: e,
      prazo: m?.prazo,
      responsavel_id: m?.responsavel_id,
      feito: Boolean(m?.em_producao ?? e.em_producao),
    });
    const d = divulgacoes[e.id];
    for (const p of d?.postagens ?? []) {
      lista.push({
        chave: `${e.id}:post:${p.id}`,
        tipo: "post",
        titulo: `${p.rede} · ${p.formato}`,
        evento: e,
        prazo: p.data,
        responsavel_id: p.responsavel_id,
        detalhe: p.texto?.trim() || undefined,
        feito: p.feito,
      });
    }
    for (const v of d?.videos ?? []) {
      lista.push({
        chave: `${e.id}:video:${v.id}`,
        tipo: "video",
        titulo: v.titulo ? `Vídeo: ${v.titulo}` : "Vídeo",
        evento: e,
        prazo: v.prazo,
        responsavel_id: v.responsavel_id,
        feito: v.feito,
      });
    }
  }
  return lista;
}

/**
 * Atrasada: o prazo já passou. Semana: vence nos próximos 7 dias.
 * Sem prazo: arte em aberto de evento que acontece nas próximas 2 semanas.
 */
export function situacao(t: Tarefa, hoje: DataISO): Situacao {
  if (t.feito) return "feito";
  if (t.prazo) {
    if (t.prazo < hoje) return "atrasada";
    if (t.prazo <= somarDias(hoje, 7)) return "semana";
    return "depois";
  }
  if ((t.tipo === "arte" || t.tipo === "pedido") && t.evento.data && t.evento.data >= hoje && t.evento.data <= somarDias(hoje, 14)) return "sem_prazo";
  return "depois";
}

/** Para ordenar: o que vence antes primeiro; sem prazo, pela data do evento. */
export const dataDaTarefa = (t: Tarefa) => t.prazo ?? (t.evento.data || "9999");

/** Cor e sigla da casa da tarefa. Pedido para todas as casas usa o roxo do app. */
export function casaDaTarefa(t: Tarefa): { cor: string; curto: string } {
  const id = t.evento.casas[0];
  return id ? casa(id) : { cor: "#8b7cf6", curto: "Todas" };
}

/** O que abrir ao clicar numa tarefa. */
export const destinoDaTarefa = (t: Tarefa): Destino => (t.tipo === "pedido" ? "pedido" : t.tipo === "arte" ? "material" : "divulgacao");
