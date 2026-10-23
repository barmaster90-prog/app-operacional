import { useCallback, useEffect, useMemo, useState } from "react";
import { banco, ehAgencia, ehGestao, NOME_PAPEL, type DadosPainel, type Usuario } from "../lib/banco.ts";
import { ABAS, CASAS, casa, eventoDaAba, type AbaId, type Evento } from "../lib/tipos.ts";
import { DIAS_SEMANA_CURTO, MESES, gradeDoMes, hojeISO, partes, somarDias, type DataISO } from "../lib/datas.ts";
import { datasFixasDoAno, type DataEspecial } from "../lib/feriados.ts";
import { PainelDia } from "./PainelDia.tsx";
import { FormEvento } from "./FormEvento.tsx";
import { FichaEvento } from "./FichaEvento.tsx";
import { EquipeContexto, GerenciarEquipe } from "./Equipe.tsx";
import { Avisos } from "./Avisos.tsx";
import { Pendencias } from "./Pendencias.tsx";
import { SemanaMarketing } from "./SemanaMarketing.tsx";
import { PedidosArte } from "./PedidosArte.tsx";
import { MaterialEvento } from "./MaterialEvento.tsx";
import { lembretesDeArte, pedidoVazio, type Pedido } from "../lib/pedidos.ts";
import type { Membro } from "../lib/equipe.ts";
import type { Aviso, Destino } from "../lib/avisos.ts";
import { situacaoArte } from "../lib/material.ts";
import { destinoDaTarefa, montarTarefas, situacao, type Tarefa } from "../lib/tarefas.ts";

const CHAVE_ABA = "app-operacional-aba";
const CHAVE_VISAO = "app-operacional-visao";

type Visao = "agenda" | "pendencias" | "marketing" | "pedidos";
const VISOES: { id: Visao; nome: string }[] = [
  { id: "agenda", nome: "Agenda" },
  { id: "pendencias", nome: "Pendências" },
  { id: "marketing", nome: "Marketing" },
  { id: "pedidos", nome: "Pedidos" },
];

function lerVisao(): Visao {
  try {
    const v = localStorage.getItem(CHAVE_VISAO) as Visao | null;
    if (v && VISOES.some((x) => x.id === v)) return v;
  } catch {
    /* sem armazenamento */
  }
  return "agenda";
}

function lerAba(): AbaId {
  try {
    const a = localStorage.getItem(CHAVE_ABA) as AbaId | null;
    if (a && ABAS.some((x) => x.id === a)) return a;
  } catch {
    /* sem armazenamento */
  }
  return "geral";
}

export function rotuloCasas(e: Evento): string {
  return e.casas.map((c) => casa(c).curto).join(" + ");
}

export function Agenda({ usuario }: { usuario: Usuario }) {
  const hoje = hojeISO();
  const [[ano, mes], setMes] = useState<[number, number]>(() => {
    const [a, m] = partes(hoje);
    return [a, m];
  });
  const [aba, setAba] = useState<AbaId>(lerAba);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [datasCadastradas, setDatasCadastradas] = useState<DataEspecial[]>([]);
  const [diaAberto, setDiaAberto] = useState<DataISO | null>(null);
  const [editando, setEditando] = useState<Partial<Evento> | null>(null);
  const [erro, setErro] = useState("");
  const [visao, setVisao] = useState<Visao>(lerVisao);
  const [equipe, setEquipe] = useState<Membro[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [dados, setDados] = useState<DadosPainel | null>(null);
  const [verAvisos, setVerAvisos] = useState(false);
  const [verEquipe, setVerEquipe] = useState(false);
  const [destino, setDestino] = useState<Destino | undefined>();
  const [recado, setRecado] = useState("");
  const [pedidoAberto, setPedidoAberto] = useState<Pedido | null>(null);
  const [datasProximas, setDatasProximas] = useState<DataEspecial[]>([]);

  const grade = useMemo(() => gradeDoMes(ano, mes), [ano, mes]);
  const de = grade[0];
  const ate = grade[grade.length - 1];

  const carregar = useCallback(async () => {
    try {
      const [ev, ds] = await Promise.all([banco.eventos(de, ate), banco.datasEspeciais(de, ate)]);
      setEventos(ev);
      setDatasCadastradas(ds);
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar a agenda.");
    }
    // Recarrega ao trocar de perfil: o que cada um pode ver muda.
  }, [de, ate, usuario.papel]);

  // Equipe, avisos e o que os painéis precisam (30 dias para trás, 90 para frente).
  const carregarExtras = useCallback(async () => {
    const [eq, av, dp, ds] = await Promise.allSettled([
      banco.equipe(),
      banco.avisos(),
      banco.painel(somarDias(hoje, -30), somarDias(hoje, 90)),
      // Datas comerciais dos próximos meses, para lembrar de pedir arte.
      banco.datasEspeciais(hoje, somarDias(hoje, 180)),
    ]);
    if (eq.status === "fulfilled") setEquipe(eq.value);
    if (av.status === "fulfilled") setAvisos(av.value);
    if (dp.status === "fulfilled") setDados(dp.value);
    if (ds.status === "fulfilled") setDatasProximas(ds.value);
  }, [hoje, usuario.id]);

  const recarregarTudo = useCallback(async () => {
    await Promise.all([carregar(), carregarExtras()]);
  }, [carregar, carregarExtras]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    carregarExtras();
    const t = setInterval(() => banco.avisos().then(setAvisos).catch(() => {}), 60_000);
    return () => clearInterval(t);
  }, [carregarExtras]);

  // A Agência não tem a tela de Marketing.
  useEffect(() => {
    if (visao === "marketing" && ehAgencia(usuario)) setVisao("agenda");
  }, [visao, usuario]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_VISAO, visao);
    } catch {
      /* sem armazenamento */
    }
  }, [visao]);

  useEffect(() => {
    if (!recado) return;
    const t = setTimeout(() => setRecado(""), 4000);
    return () => clearTimeout(t);
  }, [recado]);

  const minhas = useMemo(() => {
    if (!dados) return [];
    return montarTarefas(dados.eventos, dados.materiais, dados.divulgacoes, dados.pedidos).filter(
      (t) => t.responsavel_id === usuario.id && ["atrasada", "semana"].includes(situacao(t, hoje)),
    );
  }, [dados, usuario.id, hoje]);
  const naoLidos = avisos.filter((a) => !a.lido).length;
  const lembretes = useMemo(() => (dados ? lembretesDeArte(datasProximas, dados.pedidos, hoje) : []), [datasProximas, dados, hoje]);

  function novoPedido(campos: Partial<Pedido> = {}) {
    setVerAvisos(false);
    setPedidoAberto(pedidoVazio(campos));
  }

  /** Atualiza o pedido na lista sem recarregar tudo. */
  function pedidoMudou(p: Pedido) {
    setDados((d) => (d ? { ...d, pedidos: [p, ...d.pedidos.filter((x) => x.id !== p.id)] } : d));
  }
  const atrasadasMinhas = minhas.filter((t) => situacao(t, hoje) === "atrasada").length;

  async function abrirEvento(eventoId: string, data: string | undefined, onde: Destino) {
    setVerAvisos(false);
    if (onde === "pedido") {
      const p = (dados?.pedidos ?? []).find((x) => x.id === eventoId) ?? (await banco.pedidos()).find((x) => x.id === eventoId);
      if (!p) return setRecado("Esse pedido não existe mais.");
      return setPedidoAberto(p);
    }
    const lista = data ? await banco.eventos(data, data) : (dados?.eventos ?? []);
    const e = lista.find((x) => x.id === eventoId);
    if (!e) return setRecado("Esse evento não existe mais.");
    setDestino(onde === "evento" ? undefined : onde);
    setEditando(e);
  }

  async function marcarLidos(ids: string[]) {
    setAvisos((lista) => lista.map((a) => (ids.includes(a.id) ? { ...a, lido: true } : a)));
    await banco.marcarLidos(ids).catch(() => {});
  }

  async function cobrar(t: Tarefa) {
    if (!t.responsavel_id) return;
    const prazo = t.prazo ? ` Prazo: ${t.prazo.split("-").reverse().slice(0, 2).join("/")}.` : "";
    await banco.avisar([
      {
        para_id: t.responsavel_id,
        de_nome: usuario.nome,
        tipo: "cobranca",
        titulo: `${usuario.nome} cobrou: ${t.titulo}`,
        texto: `${t.evento.nome}.${prazo}`,
        ...(t.pedido ? { pedido_id: t.pedido.id } : { evento_id: t.evento.id, evento_data: t.evento.data }),
        abrir: destinoDaTarefa(t),
      },
    ]);
    setRecado(`Cobrança enviada para @${equipe.find((m) => m.id === t.responsavel_id)?.nome ?? "responsável"}.`);
  }

  function fecharEvento() {
    setEditando(null);
    setDestino(undefined);
  }

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_ABA, aba);
    } catch {
      /* sem armazenamento */
    }
  }, [aba]);

  const datasPorDia = useMemo(() => {
    const anos = new Set(grade.map((d) => partes(d)[0]));
    const todas = [...[...anos].flatMap(datasFixasDoAno), ...datasCadastradas];
    const mapa = new Map<DataISO, DataEspecial[]>();
    for (const d of todas) mapa.set(d.data, [...(mapa.get(d.data) ?? []), d]);
    return mapa;
  }, [grade, datasCadastradas]);

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<DataISO, Evento[]>();
    const ordem = (e: Evento) => CASAS.findIndex((c) => c.id === e.casas[0]);
    for (const e of eventos.filter((x) => eventoDaAba(x, aba))) mapa.set(e.data, [...(mapa.get(e.data) ?? []), e]);
    for (const lista of mapa.values()) lista.sort((a, b) => ordem(a) - ordem(b) || (a.horario ?? "").localeCompare(b.horario ?? ""));
    return mapa;
  }, [eventos, aba]);

  function mudarMes(delta: number) {
    const total = ano * 12 + (mes - 1) + delta;
    setMes([Math.floor(total / 12), (total % 12) + 1]);
    setDiaAberto(null);
  }

  function irParaHoje() {
    const [a, m] = partes(hoje);
    setMes([a, m]);
    setDiaAberto(hoje);
  }

  function novoEvento(data: DataISO) {
    const casaPadrao = CASAS.find((c) => c.aba === aba)?.id ?? "downtown";
    setEditando({ data, casas: [casaPadrao], status: "Ideia", atracoes: [] });
  }

  return (
    <EquipeContexto.Provider value={equipe}>
    <div className="agenda">
      <header className="topo">
        <div className="marca">
          <strong>Agenda das casas</strong>
          {banco.demo && <span className="selo">demonstração</span>}
        </div>
        <div className="usuario">
          <button
            type="button"
            className="sino"
            aria-label={`Avisos: ${naoLidos} novos, ${atrasadasMinhas} tarefas atrasadas`}
            onClick={() => setVerAvisos(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {naoLidos + atrasadasMinhas > 0 && <span className="contador">{naoLidos + atrasadasMinhas}</span>}
          </button>
          {banco.demo ? (
            <select aria-label="Entrar como" className="trocar" value={usuario.id} onChange={(e) => banco.entrar("", "", e.target.value)}>
              {equipe.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          ) : (
            <span>{usuario.nome}</span>
          )}
          <span className={`selo papel-${usuario.papel}`}>{NOME_PAPEL[usuario.papel]}</span>
          {ehGestao(usuario) && <button className="link" onClick={() => setVerEquipe(true)}>Equipe</button>}
          <button className="link" onClick={() => banco.sair()}>Sair</button>
        </div>
      </header>

      <nav className="visoes" aria-label="Telas">
        {VISOES.filter((v) => !(v.id === "marketing" && ehAgencia(usuario))).map((v) => (
          <button key={v.id} type="button" className={v.id === visao ? "ativa" : ""} aria-current={v.id === visao ? "page" : undefined} onClick={() => setVisao(v.id)}>
            {v.nome}
            {v.id === "pendencias" && atrasadasMinhas > 0 && <span className="contador">{atrasadasMinhas}</span>}
            {v.id === "pedidos" && !ehAgencia(usuario) && lembretes.length > 0 && <span className="contador">{lembretes.length}</span>}
          </button>
        ))}
      </nav>

      {recado && <p className="recado" role="status">{recado}</p>}

      {visao === "pendencias" && <Pendencias usuario={usuario} dados={dados} onAbrir={abrirEvento} onCobrar={cobrar} />}
      {visao === "marketing" && !ehAgencia(usuario) && <SemanaMarketing usuario={usuario} dados={dados} onAbrir={abrirEvento} onVerPendencias={() => setVisao("pendencias")} />}
      {visao === "pedidos" && (
        <PedidosArte usuario={usuario} pedidos={dados?.pedidos ?? null} lembretes={lembretes} onAbrir={setPedidoAberto} onNovo={novoPedido} />
      )}

      {visao === "agenda" && (<>
      <nav className="abas" aria-label="Casas">
        {ABAS.map((a) => (
          <button key={a.id} className={a.id === aba ? "ativa" : ""} onClick={() => setAba(a.id)}>
            {a.nome}
          </button>
        ))}
      </nav>

      <div className="barra-mes">
        <button onClick={() => mudarMes(-1)} aria-label="Mês anterior">‹</button>
        <h2>{MESES[mes - 1]} {ano}</h2>
        <button onClick={() => mudarMes(1)} aria-label="Próximo mês">›</button>
        <button className="link hoje" onClick={irParaHoje}>Hoje</button>
      </div>

      {erro && <p className="erro">{erro}</p>}

      <div className={`corpo ${diaAberto ? "com-painel" : ""}`}>
        <section className="calendario">
          <div className="cab-semana">
            {DIAS_SEMANA_CURTO.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grade">
            {grade.map((d) => {
              const [, m, dia] = partes(d);
              const evs = eventosPorDia.get(d) ?? [];
              const especiais = datasPorDia.get(d) ?? [];
              const feriado = especiais.some((x) => x.tipo === "feriado");
              const classes = [
                "dia",
                m !== mes && "fora",
                d === hoje && "hoje",
                d === diaAberto && "aberto",
                feriado && "feriado",
              ].filter(Boolean).join(" ");
              return (
                <button key={d} className={classes} onClick={() => setDiaAberto(d)}>
                  <span className="num">{dia}</span>
                  {especiais.slice(0, 1).map((x) => (
                    <span key={x.nome} className={`especial ${x.tipo}`} title={x.nome}>{x.nome}</span>
                  ))}
                  <span className="chips">
                    {evs.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className="chip"
                        style={{ background: casa(e.casas[0]).cor, borderRight: e.casas[1] ? `6px solid ${casa(e.casas[1]).cor}` : undefined }}
                        title={`${rotuloCasas(e)}: ${e.nome}`}
                      >
                        {e.data >= hoje && <span className={`sinal arte-${situacaoArte({ em_producao: e.em_producao, finalizado: e.arte_finalizada })}`} aria-hidden="true" />}
                        {(aba === "geral" || casa(e.casas[0]).aba !== aba) && <b>{rotuloCasas(e)}</b>} {e.nome}
                      </span>
                    ))}
                    {evs.length > 3 && <span className="mais">+{evs.length - 3}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="legenda">
            {CASAS.map((c) => (
              <span key={c.id}><i style={{ background: c.cor }} />{c.nome}</span>
            ))}
          </div>
        </section>

        {diaAberto && (
          <PainelDia
            data={diaAberto}
            eventos={eventosPorDia.get(diaAberto) ?? []}
            especiais={datasPorDia.get(diaAberto) ?? []}
            podeEditar={ehGestao(usuario)}
            onFechar={() => setDiaAberto(null)}
            onNovo={() => novoEvento(diaAberto)}
            onEditar={(e) => setEditando(e)}
            onDatasMudaram={recarregarTudo}
          />
        )}
      </div>
      </>)}

      {editando && !ehGestao(usuario) && editando.id && (
        <FichaEvento
          evento={editando as Evento}
          usuario={usuario}
          datasExtras={datasCadastradas}
          abrir={destino}
          onMudou={recarregarTudo}
          onFechar={fecharEvento}
        />
      )}

      {editando && ehGestao(usuario) && (
        <FormEvento
          inicial={editando}
          usuario={usuario}
          datasExtras={datasCadastradas}
          abrir={destino}
          onMudou={recarregarTudo}
          onFechar={fecharEvento}
          onSalvo={async () => {
            fecharEvento();
            await recarregarTudo();
          }}
        />
      )}

      {pedidoAberto && (
        <MaterialEvento
          key={pedidoAberto.id || "novo"}
          pedido={pedidoAberto}
          usuario={usuario}
          datasExtras={datasCadastradas}
          onFechar={() => setPedidoAberto(null)}
          onPedido={pedidoMudou}
          onPedidoApagado={(id) => setDados((d) => (d ? { ...d, pedidos: d.pedidos.filter((x) => x.id !== id) } : d))}
        />
      )}

      {verAvisos && (
        <Avisos avisos={avisos} minhas={minhas} onAbrir={abrirEvento} onLidos={marcarLidos} onFechar={() => setVerAvisos(false)} />
      )}
      {verEquipe && <GerenciarEquipe onFechar={() => setVerEquipe(false)} onMudou={carregarExtras} />}
    </div>
    </EquipeContexto.Provider>
  );
}
