import { somarDias, type DataISO } from "./datas.ts";
import type { Evento } from "./tipos.ts";
import type { Material } from "./material.ts";
import type { Divulgacao } from "./divulgacao.ts";

export type TipoTarefa = "arte" | "post" | "video";

/** Uma coisa a fazer para um evento, montada a partir do Material e da Divulgação. */
export interface Tarefa {
  chave: string;
  tipo: TipoTarefa;
  titulo: string;
  evento: Evento;
  prazo?: DataISO;
  responsavel_id?: string;
  feito: boolean;
}

export type Situacao = "feito" | "atrasada" | "semana" | "sem_prazo" | "depois";

export function montarTarefas(
  eventos: Evento[],
  materiais: Record<string, Material | undefined>,
  divulgacoes: Record<string, Divulgacao | undefined>,
): Tarefa[] {
  const lista: Tarefa[] = [];
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
  if (t.tipo === "arte" && t.evento.data >= hoje && t.evento.data <= somarDias(hoje, 14)) return "sem_prazo";
  return "depois";
}

/** Para ordenar: o que vence antes primeiro; sem prazo, pela data do evento. */
export const dataDaTarefa = (t: Tarefa) => t.prazo ?? t.evento.data;
