import { useMemo, useState } from "react";
import { ehGestao, type DadosPainel, type Usuario } from "../lib/banco.ts";
import { ABAS, casa, eventoDaAba, type AbaId } from "../lib/tipos.ts";
import { hojeISO, somarDias } from "../lib/datas.ts";
import { dataDaTarefa, montarTarefas, situacao, type Situacao, type Tarefa } from "../lib/tarefas.ts";
import type { Destino } from "../lib/avisos.ts";
import { nomeDe, useEquipe } from "./Equipe.tsx";

interface Props {
  usuario: Usuario;
  dados: DadosPainel | null;
  onAbrir(eventoId: string, data: string, destino: Destino): void;
  onCobrar(t: Tarefa): Promise<void>;
}

const dataCurta = (d?: string) => (d ? d.split("-").reverse().slice(0, 2).join("/") : "—");
export const destinoDa = (t: Tarefa): Destino => (t.tipo === "arte" ? "material" : "divulgacao");

const SECOES: { id: Situacao; titulo: string; vazio: string }[] = [
  { id: "atrasada", titulo: "Atrasadas", vazio: "Nada atrasado." },
  { id: "semana", titulo: "Vencem nos próximos 7 dias", vazio: "Nada vencendo esta semana." },
  { id: "sem_prazo", titulo: "Artes em aberto sem prazo (eventos das próximas 2 semanas)", vazio: "Toda arte das próximas 2 semanas tem prazo ou já foi para produção." },
];

export function Pendencias({ usuario, dados, onAbrir, onCobrar }: Props) {
  const equipe = useEquipe();
  const hoje = hojeISO();
  const [aba, setAba] = useState<AbaId>("geral");
  const [soMinhas, setSoMinhas] = useState(!ehGestao(usuario));
  const [cobradas, setCobradas] = useState<Set<string>>(new Set());

  const tarefas = useMemo(() => {
    if (!dados) return [];
    return montarTarefas(dados.eventos, dados.materiais, dados.divulgacoes)
      .filter((t) => eventoDaAba(t.evento, aba))
      .filter((t) => !soMinhas || t.responsavel_id === usuario.id)
      .sort((a, b) => dataDaTarefa(a).localeCompare(dataDaTarefa(b)));
  }, [dados, aba, soMinhas, usuario.id]);

  const por = (s: Situacao) => tarefas.filter((t) => situacao(t, hoje) === s);
  const postsSemana = tarefas.filter((t) => t.tipo === "post" && !t.feito && t.prazo && t.prazo >= hoje && t.prazo <= somarDias(hoje, 7)).length;
  const artesAbertas = tarefas.filter((t) => t.tipo === "arte" && !t.feito && t.evento.data >= hoje && t.evento.data <= somarDias(hoje, 14)).length;

  async function cobrar(t: Tarefa) {
    await onCobrar(t);
    setCobradas(new Set([...cobradas, t.chave]));
  }

  return (
    <section className="pendencias">
      <div className="titulo-visao">
        <div>
          <h2>Pendências</h2>
          <p>O que está atrasado ou vence nos próximos dias.</p>
        </div>
        <label className="check">
          <input type="checkbox" checked={soMinhas} onChange={(e) => setSoMinhas(e.target.checked)} />
          <span>Só as minhas</span>
        </label>
      </div>
      <nav className="filtros" aria-label="Casa">
        {ABAS.map((a) => (
          <button type="button" key={a.id} className={a.id === aba ? "ativo" : ""} onClick={() => setAba(a.id)}>{a.nome}</button>
        ))}
      </nav>

      {!dados ? (
        <p className="vazio">Carregando…</p>
      ) : (
        <>
          <div className="numeros">
            <div className="numero atrasada"><strong>{por("atrasada").length}</strong><span>atrasadas</span></div>
            <div className="numero semana"><strong>{por("semana").length}</strong><span>vencem em 7 dias</span></div>
            <div className="numero"><strong>{artesAbertas}</strong><span>artes em aberto (2 semanas)</span></div>
            <div className="numero"><strong>{postsSemana}</strong><span>posts a fazer em 7 dias</span></div>
          </div>

          {SECOES.map((sec) => {
            const lista = por(sec.id);
            return (
              <section key={sec.id} className={`bloco-pendencias ${sec.id}`}>
                <h3>{sec.titulo}{lista.length > 0 && <span> · {lista.length}</span>}</h3>
                {lista.length === 0 ? (
                  <p className="vazio">{sec.vazio}</p>
                ) : (
                  <ul>
                    {lista.map((t) => {
                      const resp = nomeDe(equipe, t.responsavel_id);
                      const c = casa(t.evento.casas[0]);
                      return (
                        <li key={t.chave} className="tarefa">
                          <span className={`sinal-tarefa ${sec.id}`} aria-hidden="true" />
                          <div className="oque">
                            <strong>{t.titulo}{t.detalhe && <small> · {t.detalhe}</small>}</strong>
                            <span>
                              <i className="etiqueta" style={{ background: c.cor }}>{c.curto}</i> {t.evento.nome} · {dataCurta(t.evento.data)}
                            </span>
                          </div>
                          <span className="prazo">{t.prazo ? (sec.id === "atrasada" ? `venceu ${dataCurta(t.prazo)}` : dataCurta(t.prazo)) : "sem prazo"}</span>
                          <span className={resp ? "mencao" : "sem-resp"}>{resp ? `@${resp}` : "sem responsável"}</span>
                          <span className="acoes">
                            <button type="button" onClick={() => onAbrir(t.evento.id, t.evento.data, destinoDa(t))}>Abrir</button>
                            {ehGestao(usuario) && t.responsavel_id && t.responsavel_id !== usuario.id && (
                              <button type="button" disabled={cobradas.has(t.chave)} onClick={() => cobrar(t)}>
                                {cobradas.has(t.chave) ? "Cobrado" : "Cobrar"}
                              </button>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </>
      )}
    </section>
  );
}
