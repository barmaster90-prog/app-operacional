import { useState } from "react";
import type { Aviso, Destino } from "../lib/avisos.ts";
import { situacao, type Tarefa } from "../lib/tarefas.ts";
import { casa } from "../lib/tipos.ts";
import { hojeISO } from "../lib/datas.ts";

interface Props {
  avisos: Aviso[];
  /** Tarefas de quem está logado que estão atrasadas ou vencem na semana. */
  minhas: Tarefa[];
  onAbrir(eventoId: string, data: string | undefined, destino: Destino): void;
  onLidos(ids: string[]): void;
  onFechar(): void;
}

type Aba = "todos" | "atrasos" | "mencoes";

const ICONE: Record<Aviso["tipo"], string> = { mencao: "@", tarefa: "+", cobranca: "!", producao: "✓" };

function quando(iso: string): string {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 24 * 60) return `há ${Math.round(min / 60)} h`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const dataCurta = (d?: string) => (d ? d.split("-").reverse().slice(0, 2).join("/") : "");

export function Avisos({ avisos, minhas, onAbrir, onLidos, onFechar }: Props) {
  const [aba, setAba] = useState<Aba>("todos");
  const hoje = hojeISO();
  const naoLidos = avisos.filter((a) => !a.lido).map((a) => a.id);
  const lista = aba === "mencoes" ? avisos.filter((a) => a.tipo === "mencao") : avisos;

  return (
    <div className="fundo-avisos" onClick={onFechar}>
      <div className="avisos" role="dialog" aria-label="Avisos" onClick={(e) => e.stopPropagation()}>
        <div className="avisos-topo">
          <h3>Avisos</h3>
          {naoLidos.length > 0 && <button type="button" className="link" onClick={() => onLidos(naoLidos)}>Marcar tudo como lido</button>}
          <button type="button" className="link" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>
        <div className="filtros">
          <button type="button" className={aba === "todos" ? "ativo" : ""} onClick={() => setAba("todos")}>Para mim</button>
          <button type="button" className={aba === "atrasos" ? "ativo" : ""} onClick={() => setAba("atrasos")}>
            Minhas tarefas{minhas.length > 0 && ` (${minhas.length})`}
          </button>
          <button type="button" className={aba === "mencoes" ? "ativo" : ""} onClick={() => setAba("mencoes")}>Menções</button>
        </div>

        <div className="avisos-lista">
          {aba === "atrasos" ? (
            minhas.length === 0 ? (
              <p className="vazio">Nada atrasado nem vencendo esta semana.</p>
            ) : (
              minhas.map((t) => {
                const atrasada = situacao(t, hoje) === "atrasada";
                return (
                  <button
                    type="button"
                    key={t.chave}
                    className="aviso"
                    onClick={() => onAbrir(t.evento.id, t.evento.data, t.tipo === "arte" ? "material" : "divulgacao")}
                  >
                    <span className={`icone ${atrasada ? "cobranca" : "tarefa"}`} aria-hidden="true">!</span>
                    <span className="corpo-aviso">
                      <strong>{atrasada ? "Atrasada" : "Vence esta semana"}: {t.titulo}</strong>
                      <span>{casa(t.evento.casas[0]).curto} · {t.evento.nome}</span>
                      <small>{t.prazo ? `prazo ${dataCurta(t.prazo)}` : `evento ${dataCurta(t.evento.data)}`}</small>
                    </span>
                  </button>
                );
              })
            )
          ) : lista.length === 0 ? (
            <p className="vazio">{aba === "mencoes" ? "Ninguém mencionou você ainda." : "Nenhum aviso por enquanto."}</p>
          ) : (
            lista.map((a) => (
              <button
                type="button"
                key={a.id}
                className={`aviso ${a.lido ? "" : "novo"}`}
                onClick={() => {
                  if (!a.lido) onLidos([a.id]);
                  if (a.evento_id) onAbrir(a.evento_id, a.evento_data, a.abrir ?? "evento");
                }}
              >
                <span className={`icone ${a.tipo}`} aria-hidden="true">{ICONE[a.tipo]}</span>
                <span className="corpo-aviso">
                  <strong>{a.titulo}</strong>
                  {a.texto && <span>{a.texto}</span>}
                  <small>{quando(a.criado_em)}</small>
                </span>
              </button>
            ))
          )}
        </div>
        <p className="rodape-avisos">No app instalado, os avisos também vão chegar como notificação no celular (próxima etapa).</p>
      </div>
    </div>
  );
}
