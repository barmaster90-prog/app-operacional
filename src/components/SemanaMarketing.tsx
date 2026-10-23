import { useEffect, useMemo, useState } from "react";
import { banco, ehGestao, type DadosPainel, type Usuario } from "../lib/banco.ts";
import { casa } from "../lib/tipos.ts";
import { DIAS_SEMANA_CURTO, MESES, dataPorExtenso, diaDaSemana, gradeDoMes, hojeISO, partes, somarDias, type DataISO } from "../lib/datas.ts";
import { datasFixasDoAno, type DataEspecial } from "../lib/feriados.ts";
import { casaDaTarefa, destinoDaTarefa, montarTarefas, situacao, type Tarefa } from "../lib/tarefas.ts";
import type { Pedido } from "../lib/pedidos.ts";
import { situacaoArte } from "../lib/material.ts";
import type { Destino } from "../lib/avisos.ts";
import { nomeDe, useEquipe } from "./Equipe.tsx";

interface Props {
  usuario: Usuario;
  /** Muda quando algo é salvo: serve de sinal para recarregar. */
  dados: DadosPainel | null;
  onAbrir(eventoId: string, data: string, destino: Destino): void;
  onVerPendencias(): void;
}

type Modo = "mes" | "semana";
const CHAVE_MODO = "app-operacional-marketing-modo";
const CHAVE_EVENTOS = "app-operacional-marketing-eventos";

const NOMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const dataCurta = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
const ROTULO: Record<Tarefa["tipo"], string> = { post: "Post", video: "Vídeo", arte: "Arte", pedido: "Pedido" };

/** Segunda-feira da semana da data. */
function segunda(d: DataISO): DataISO {
  return somarDias(d, -((diaDaSemana(d) + 6) % 7));
}

function ler<T extends string>(chave: string, valido: T[], padrao: T): T {
  try {
    const v = localStorage.getItem(chave) as T | null;
    if (v && valido.includes(v)) return v;
  } catch {
    /* sem armazenamento */
  }
  return padrao;
}

function guardar(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* sem armazenamento */
  }
}

/**
 * Calendário do marketing, separado da agenda de eventos: posts, vídeos, artes,
 * pedidos e o que está atrasado. Os eventos só aparecem se a pessoa ligar.
 */
export function SemanaMarketing({ usuario, dados, onAbrir, onVerPendencias }: Props) {
  const equipe = useEquipe();
  const hoje = hojeISO();
  const [modo, setModo] = useState<Modo>(() => ler(CHAVE_MODO, ["mes", "semana"], "mes"));
  const [[ano, mes], setMes] = useState<[number, number]>(() => [partes(hoje)[0], partes(hoje)[1]]);
  const [inicio, setInicio] = useState(() => segunda(hoje));
  const [diaAberto, setDiaAberto] = useState<DataISO | null>(null);
  const [soMeu, setSoMeu] = useState(!ehGestao(usuario));
  const [verEventos, setVerEventos] = useState(() => ler(CHAVE_EVENTOS, ["sim", "nao"], "nao") === "sim");
  const [local, setLocal] = useState<DadosPainel | null>(null);
  const [datasCadastradas, setDatasCadastradas] = useState<DataEspecial[]>([]);

  const grade = useMemo(() => gradeDoMes(ano, mes), [ano, mes]);
  const dias = modo === "mes" ? grade : Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  const de = dias[0];
  const ate = dias[dias.length - 1];

  // Busca o período que está na tela. Os posts saem antes do evento, então pega eventos até 60 dias depois.
  useEffect(() => {
    let vivo = true;
    Promise.allSettled([banco.painel(de, somarDias(ate, 60)), banco.datasEspeciais(de, ate)]).then(([p, d]) => {
      if (!vivo) return;
      if (p.status === "fulfilled") setLocal(p.value);
      if (d.status === "fulfilled") setDatasCadastradas(d.value);
    });
    return () => {
      vivo = false;
    };
  }, [de, ate, dados]);

  const fonte = local ?? dados;

  const tarefas = useMemo(() => {
    if (!fonte) return [];
    return montarTarefas(fonte.eventos, fonte.materiais, fonte.divulgacoes, fonte.pedidos).filter(
      (t) => t.prazo && (!soMeu || t.responsavel_id === usuario.id || (t.pedido && t.pedido.criado_por_id === usuario.id)),
    );
  }, [fonte, soMeu, usuario.id]);

  // Tudo o que está atrasado, de qualquer data (não só do período na tela).
  const atrasadas = useMemo(() => {
    if (!dados) return 0;
    return montarTarefas(dados.eventos, dados.materiais, dados.divulgacoes, dados.pedidos).filter(
      (t) => situacao(t, hoje) === "atrasada" && (!soMeu || t.responsavel_id === usuario.id),
    ).length;
  }, [dados, hoje, soMeu, usuario.id]);

  const especiaisPorDia = useMemo(() => {
    const anos = new Set(dias.map((d) => partes(d)[0]));
    const mapa = new Map<DataISO, DataEspecial[]>();
    for (const d of [...[...anos].flatMap(datasFixasDoAno), ...datasCadastradas]) mapa.set(d.data, [...(mapa.get(d.data) ?? []), d]);
    return mapa;
  }, [de, ate, datasCadastradas]);

  function doDia(d: DataISO) {
    return {
      eventos: verEventos ? (fonte?.eventos ?? []).filter((e) => e.data === d) : [],
      // Pedido de arte no dia em que vai ser postado. Postar é com o marketing, não com quem faz a arte,
      // então aparece mesmo com "Só o que é meu" ligado (e continua aparecendo depois de finalizado).
      postar: (fonte?.pedidos ?? []).filter((p) => p.uso === d),
      tarefas: tarefas.filter((t) => t.prazo === d),
      especiais: especiaisPorDia.get(d) ?? [],
    };
  }

  function trocarModo(m: Modo) {
    setModo(m);
    guardar(CHAVE_MODO, m);
    setDiaAberto(null);
    // Mantém o mesmo pedaço do calendário ao trocar.
    if (m === "semana") setInicio(segunda(ano === partes(hoje)[0] && mes === partes(hoje)[1] ? hoje : `${ano}-${String(mes).padStart(2, "0")}-01`));
    else setMes([partes(inicio)[0], partes(inicio)[1]]);
  }

  function andar(delta: number) {
    setDiaAberto(null);
    if (modo === "semana") return setInicio(somarDias(inicio, 7 * delta));
    const total = ano * 12 + (mes - 1) + delta;
    setMes([Math.floor(total / 12), (total % 12) + 1]);
  }

  function irParaHoje() {
    setMes([partes(hoje)[0], partes(hoje)[1]]);
    setInicio(segunda(hoje));
    setDiaAberto(modo === "mes" ? hoje : null);
  }

  const abrirTarefa = (t: Tarefa) => (t.tipo === "pedido" ? onAbrir(t.evento.id, "", "pedido") : onAbrir(t.evento.id, t.evento.data, destinoDaTarefa(t)));
  const abrirPedido = (p: Pedido) => onAbrir(p.id, "", "pedido");

  const [, mi, di] = partes(dias[0]);
  const [, mf, df] = partes(dias[6]);
  const titulo = modo === "mes"
    ? `${MESES[mes - 1]} ${ano}`
    : `Semana de ${String(di).padStart(2, "0")}/${String(mi).padStart(2, "0")} a ${String(df).padStart(2, "0")}/${String(mf).padStart(2, "0")}`;
  const estaNoHoje = modo === "mes" ? ano === partes(hoje)[0] && mes === partes(hoje)[1] : inicio === segunda(hoje);

  /** Os cards de um dia: usados na semana e no painel do dia do mês. */
  function cartoes(d: DataISO) {
    const { eventos, postar, tarefas: ts } = doDia(d);
    return (
      <>
        {eventos.map((e) => (
          <button type="button" key={e.id} className="evento-noite" style={{ borderColor: casa(e.casas[0]).cor }} onClick={() => onAbrir(e.id, e.data, "divulgacao")}>
            Evento · {casa(e.casas[0]).curto} · {e.nome}
          </button>
        ))}
        {postar.map((p) => (
          <button type="button" key={p.id} className="evento-noite pedido-dia" onClick={() => abrirPedido(p)}>
            Postar arte · {p.titulo}{p.finalizado ? " · arte finalizada" : ""}
          </button>
        ))}
        {ts.map((t) => {
          const s = situacao(t, hoje);
          const resp = nomeDe(equipe, t.responsavel_id);
          return (
            <button type="button" key={t.chave} className={`card-tarefa ${s === "atrasada" ? "atrasada" : ""}`} style={{ borderLeftColor: casaDaTarefa(t).cor }} onClick={() => abrirTarefa(t)}>
              <span className="linha-card">
                <i className={`sinal-tarefa ${s === "feito" ? "feito" : s === "atrasada" ? "atrasada" : "semana"}`} aria-hidden="true" />
                <strong>{t.tipo === "pedido" ? "Entregar arte" : t.titulo}</strong>
              </span>
              {t.detalhe && <span className="detalhe-card">{t.detalhe}</span>}
              <span>{t.tipo === "pedido" ? t.evento.nome : `${casaDaTarefa(t).curto} · ${t.evento.nome}`}</span>
              <span className={resp ? "mencao" : "sem-resp"}>{resp ? `@${resp}` : "sem responsável"}</span>
            </button>
          );
        })}
        {eventos.length === 0 && postar.length === 0 && ts.length === 0 && <span className="nada">—</span>}
      </>
    );
  }

  return (
    <section className="semana">
      <div className="titulo-visao">
        <div className="nav-semana">
          <button type="button" aria-label={modo === "mes" ? "Mês anterior" : "Semana anterior"} onClick={() => andar(-1)}>‹</button>
          <h2>{titulo}</h2>
          <button type="button" aria-label={modo === "mes" ? "Próximo mês" : "Próxima semana"} onClick={() => andar(1)}>›</button>
          {!estaNoHoje && <button type="button" className="link" onClick={irParaHoje}>{modo === "mes" ? "Hoje" : "Esta semana"}</button>}
        </div>
        <div className="seletor-modo" role="group" aria-label="Ver por">
          <button type="button" className={modo === "mes" ? "ativa" : ""} aria-pressed={modo === "mes"} onClick={() => trocarModo("mes")}>Mês</button>
          <button type="button" className={modo === "semana" ? "ativa" : ""} aria-pressed={modo === "semana"} onClick={() => trocarModo("semana")}>Semana</button>
        </div>
      </div>

      <div className="filtros-marketing">
        <label className="check">
          <input type="checkbox" checked={soMeu} onChange={(e) => setSoMeu(e.target.checked)} />
          <span>Só o que é meu</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={verEventos}
            onChange={(e) => {
              setVerEventos(e.target.checked);
              guardar(CHAVE_EVENTOS, e.target.checked ? "sim" : "nao");
            }}
          />
          <span>Mostrar eventos</span>
        </label>
        {atrasadas > 0 && (
          <button type="button" className="aviso-atrasadas" onClick={onVerPendencias}>
            <i className="sinal-tarefa atrasada" aria-hidden="true" />
            {atrasadas} {atrasadas === 1 ? "atrasada" : "atrasadas"} · ver pendências
          </button>
        )}
      </div>

      <div className="legenda-semana">
        <span><i className="sinal-tarefa feito" />postado / pronto</span>
        <span><i className="sinal-tarefa semana" />a fazer</span>
        <span><i className="sinal-tarefa atrasada" />atrasado</span>
        <span><i className="tracejado roxo" />arte para postar no dia</span>
        {verEventos && <span><i className="tracejado" />evento</span>}
      </div>

      {!fonte ? (
        <p className="vazio">Carregando…</p>
      ) : modo === "semana" ? (
        <div className="dias-semana">
          {dias.map((d) => (
            <div key={d} className={`dia-semana ${d === hoje ? "hoje" : ""}`}>
              <div className="cab-dia">
                <strong>{NOMES[diaDaSemana(d)]}</strong> <span>{dataCurta(d)}</span>
              </div>
              {(especiaisPorDia.get(d) ?? []).slice(0, 1).map((x) => (
                <span key={x.nome} className={`especial ${x.tipo}`}>{x.nome}</span>
              ))}
              {cartoes(d)}
            </div>
          ))}
        </div>
      ) : (
        <div className={`corpo ${diaAberto ? "com-painel" : ""}`}>
          <section className="calendario calendario-marketing">
            <div className="cab-semana">
              {DIAS_SEMANA_CURTO.map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grade">
              {dias.map((d) => {
                const [, m, dia] = partes(d);
                const { eventos, postar, tarefas: ts, especiais } = doDia(d);
                const itens = [
                  ...ts.map((t) => {
                    const s = situacao(t, hoje);
                    return (
                      <span key={t.chave} className={`chip chip-mkt ${s === "atrasada" ? "atrasada" : ""}`} style={{ borderLeftColor: casaDaTarefa(t).cor }} title={`${ROTULO[t.tipo]}: ${t.evento.nome}`}>
                        <span className={`sinal ${s === "feito" ? "sim" : s === "atrasada" ? "nao" : "a-fazer"}`} aria-hidden="true" />
                        <b>{t.tipo === "pedido" ? "Entregar" : ROTULO[t.tipo]}</b> {t.evento.nome}
                      </span>
                    );
                  }),
                  ...postar.map((p) => (
                    <span key={p.id} className="chip chip-pedido" title={`Postar arte: ${p.titulo}`}>
                      <span className={`sinal arte-${situacaoArte(p)}`} aria-hidden="true" />
                      <b>Postar</b> {p.titulo}
                    </span>
                  )),
                  ...eventos.map((e) => (
                    <span key={e.id} className="chip chip-evento" style={{ borderColor: casa(e.casas[0]).cor }} title={`Evento: ${e.nome}`}>
                      <b>{casa(e.casas[0]).curto}</b> {e.nome}
                    </span>
                  )),
                ];
                const classes = ["dia", m !== mes && "fora", d === hoje && "hoje", d === diaAberto && "aberto", especiais.some((x) => x.tipo === "feriado") && "feriado"]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button key={d} type="button" className={classes} onClick={() => setDiaAberto(d)}>
                    <span className="num">{dia}</span>
                    {especiais.slice(0, 1).map((x) => (
                      <span key={x.nome} className={`especial ${x.tipo}`} title={x.nome}>{x.nome}</span>
                    ))}
                    <span className="chips">
                      {itens.slice(0, 3)}
                      {itens.length > 3 && <span className="mais">+{itens.length - 3}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {diaAberto && (
            <aside className="painel painel-marketing">
              <div className="painel-topo">
                <h3>{dataPorExtenso(diaAberto)}</h3>
                <button type="button" className="link" onClick={() => setDiaAberto(null)} aria-label="Fechar">✕</button>
              </div>
              {(especiaisPorDia.get(diaAberto) ?? []).map((x) => (
                <span key={x.nome} className={`especial ${x.tipo}`}>{x.nome}</span>
              ))}
              <div className="lista-marketing">{cartoes(diaAberto)}</div>
            </aside>
          )}
        </div>
      )}
      <p className="dica">Clique num card para abrir: posts e vídeos abrem a Divulgação do evento, artes abrem o Material e os pedidos abrem o pedido.</p>
    </section>
  );
}
