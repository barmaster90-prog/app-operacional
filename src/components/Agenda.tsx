import { useCallback, useEffect, useMemo, useState } from "react";
import { banco, type Usuario } from "../lib/banco.ts";
import { ABAS, CASAS, casa, eventoDaAba, type AbaId, type Evento } from "../lib/tipos.ts";
import { DIAS_SEMANA_CURTO, MESES, gradeDoMes, hojeISO, partes, type DataISO } from "../lib/datas.ts";
import { datasFixasDoAno, type DataEspecial } from "../lib/feriados.ts";
import { PainelDia } from "./PainelDia.tsx";
import { FormEvento } from "./FormEvento.tsx";

const CHAVE_ABA = "app-operacional-aba";

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
  }, [de, ate]);

  useEffect(() => {
    carregar();
  }, [carregar]);

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
    <div className="agenda">
      <header className="topo">
        <div className="marca">
          <strong>Agenda das casas</strong>
          {banco.demo && <span className="selo">demonstração</span>}
        </div>
        <div className="usuario">
          <span>{usuario.nome}</span>
          <button className="link" onClick={() => banco.sair()}>Sair</button>
        </div>
      </header>

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
                        className={`chip ${e.status === "Cancelado" ? "cancelado" : ""}`}
                        style={{ background: casa(e.casas[0]).cor, borderRight: e.casas[1] ? `6px solid ${casa(e.casas[1]).cor}` : undefined }}
                        title={`${rotuloCasas(e)}: ${e.nome}`}
                      >
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
            onFechar={() => setDiaAberto(null)}
            onNovo={() => novoEvento(diaAberto)}
            onEditar={(e) => setEditando(e)}
            onDatasMudaram={carregar}
          />
        )}
      </div>

      {editando && (
        <FormEvento
          inicial={editando}
          usuario={usuario}
          onFechar={() => setEditando(null)}
          onSalvo={async () => {
            setEditando(null);
            await carregar();
          }}
        />
      )}
    </div>
  );
}
