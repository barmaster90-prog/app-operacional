import { useMemo, useState } from "react";
import { ehGestao, type DadosPainel, type Usuario } from "../lib/banco.ts";
import { casa } from "../lib/tipos.ts";
import { diaDaSemana, hojeISO, partes, somarDias, type DataISO } from "../lib/datas.ts";
import { montarTarefas, situacao } from "../lib/tarefas.ts";
import type { Destino } from "../lib/avisos.ts";
import { nomeDe, useEquipe } from "./Equipe.tsx";

interface Props {
  usuario: Usuario;
  dados: DadosPainel | null;
  onAbrir(eventoId: string, data: string, destino: Destino): void;
}

const NOMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const dataCurta = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

/** Segunda-feira da semana da data. */
function segunda(d: DataISO): DataISO {
  return somarDias(d, -((diaDaSemana(d) + 6) % 7));
}

/** Posts e vídeos de cada dia da semana, com os eventos da noite. */
export function SemanaMarketing({ usuario, dados, onAbrir }: Props) {
  const equipe = useEquipe();
  const hoje = hojeISO();
  const [inicio, setInicio] = useState(() => segunda(hoje));
  const [soMeu, setSoMeu] = useState(!ehGestao(usuario));
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  const fim = dias[6];

  const tarefas = useMemo(() => {
    if (!dados) return [];
    return montarTarefas(dados.eventos, dados.materiais, dados.divulgacoes).filter(
      (t) => (t.tipo === "post" || t.tipo === "video") && t.prazo && t.prazo >= inicio && t.prazo <= fim && (!soMeu || t.responsavel_id === usuario.id),
    );
  }, [dados, inicio, fim, soMeu, usuario.id]);

  const [, mi, di] = partes(inicio);
  const [, mf, df] = partes(fim);

  return (
    <section className="semana">
      <div className="titulo-visao">
        <div className="nav-semana">
          <button type="button" aria-label="Semana anterior" onClick={() => setInicio(somarDias(inicio, -7))}>‹</button>
          <h2>Semana de {String(di).padStart(2, "0")}/{String(mi).padStart(2, "0")} a {String(df).padStart(2, "0")}/{String(mf).padStart(2, "0")}</h2>
          <button type="button" aria-label="Próxima semana" onClick={() => setInicio(somarDias(inicio, 7))}>›</button>
          {inicio !== segunda(hoje) && <button type="button" className="link" onClick={() => setInicio(segunda(hoje))}>Esta semana</button>}
        </div>
        <label className="check">
          <input type="checkbox" checked={soMeu} onChange={(e) => setSoMeu(e.target.checked)} />
          <span>Só o que é meu</span>
        </label>
      </div>
      <div className="legenda-semana">
        <span><i className="sinal-tarefa feito" />postado / pronto</span>
        <span><i className="sinal-tarefa semana" />a fazer</span>
        <span><i className="sinal-tarefa atrasada" />atrasado</span>
        <span><i className="tracejado" />evento da noite</span>
        <span><i className="tracejado roxo" />arte para usar no dia</span>
      </div>

      {!dados ? (
        <p className="vazio">Carregando…</p>
      ) : (
        <div className="dias-semana">
          {dias.map((d) => {
            const eventos = dados.eventos.filter((e) => e.data === d);
            const doDia = tarefas.filter((t) => t.prazo === d);
            const artes = dados.pedidos.filter((p) => p.uso === d && !p.entregue);
            return (
              <div key={d} className={`dia-semana ${d === hoje ? "hoje" : ""}`}>
                <div className="cab-dia">
                  <strong>{NOMES[diaDaSemana(d)]}</strong> <span>{dataCurta(d)}</span>
                </div>
                {eventos.map((e) => (
                  <button
                    type="button"
                    key={e.id}
                    className="evento-noite"
                    style={{ borderColor: casa(e.casas[0]).cor }}
                    onClick={() => onAbrir(e.id, e.data, "divulgacao")}
                  >
                    {casa(e.casas[0]).curto} · {e.nome}
                  </button>
                ))}
                {artes.map((p) => (
                  <button type="button" key={p.id} className="evento-noite pedido-dia" onClick={() => onAbrir(p.id, "", "pedido")}>
                    Arte · {p.titulo}
                  </button>
                ))}
                {doDia.map((t) => {
                  const s = situacao(t, hoje);
                  const resp = nomeDe(equipe, t.responsavel_id);
                  return (
                    <button
                      type="button"
                      key={t.chave}
                      className="card-tarefa"
                      style={{ borderLeftColor: casa(t.evento.casas[0]).cor }}
                      onClick={() => onAbrir(t.evento.id, t.evento.data, "divulgacao")}
                    >
                      <span className="linha-card">
                        <i className={`sinal-tarefa ${s === "feito" ? "feito" : s === "atrasada" ? "atrasada" : "semana"}`} aria-hidden="true" />
                        <strong>{t.titulo}</strong>
                      </span>
                      {t.detalhe && <span className="detalhe-card">{t.detalhe}</span>}
                      <span>{t.evento.nome}</span>
                      <span className={resp ? "mencao" : "sem-resp"}>{resp ? `@${resp}` : "sem responsável"}</span>
                    </button>
                  );
                })}
                {eventos.length === 0 && artes.length === 0 && doDia.length === 0 && <span className="nada">—</span>}
              </div>
            );
          })}
        </div>
      )}
      <p className="dica">Clique num card para abrir a Divulgação do evento: legenda, roteiro e o "postado".</p>
    </section>
  );
}
