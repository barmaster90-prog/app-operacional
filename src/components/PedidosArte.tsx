import { useState } from "react";
import type { Usuario } from "../lib/banco.ts";
import { casa } from "../lib/tipos.ts";
import { dataPorExtenso, hojeISO } from "../lib/datas.ts";
import { situacaoPedido, type Lembrete, type Pedido, type SituacaoPedido } from "../lib/pedidos.ts";
import { nomeDe, useEquipe } from "./Equipe.tsx";

interface Props {
  usuario: Usuario;
  pedidos: Pedido[] | null;
  lembretes: Lembrete[];
  onAbrir(p: Pedido): void;
  /** Novo pedido, opcionalmente já com nome e data (vindo de uma data comercial). */
  onNovo(campos?: Partial<Pedido>): void;
}

const FILTROS: { id: SituacaoPedido; nome: string }[] = [
  { id: "aberto", nome: "Em aberto" },
  { id: "producao", nome: "Em produção" },
  { id: "entregue", nome: "Entregues" },
];

const dataCurta = (d?: string) => (d ? d.split("-").reverse().slice(0, 2).join("/") : "");
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaCurto = (d: string) => `${DIAS[new Date(`${d}T12:00:00`).getDay()]}, ${dataCurta(d)}`;

/** Artes que não são de um evento: datas comemorativas, cardápio, vagas, avisos. */
export function PedidosArte({ usuario, pedidos, lembretes, onAbrir, onNovo }: Props) {
  const equipe = useEquipe();
  const hoje = hojeISO();
  const [filtro, setFiltro] = useState<SituacaoPedido>("aberto");
  const conta = (s: SituacaoPedido) => (pedidos ?? []).filter((p) => situacaoPedido(p) === s).length;
  const lista = (pedidos ?? [])
    .filter((p) => situacaoPedido(p) === filtro)
    .sort((a, b) => (a.prazo ?? a.uso ?? "9999").localeCompare(b.prazo ?? b.uso ?? "9999"));

  return (
    <section className="pedidos">
      <div className="titulo-visao">
        <div>
          <h2>Pedidos de arte</h2>
          <p>Artes que não são de um evento: datas comemorativas, cardápio, vagas, avisos.</p>
        </div>
        <button type="button" className="primario" onClick={() => onNovo()}>+ Novo pedido</button>
      </div>

      {lembretes.length > 0 && (
        <section className="bloco-pendencias lembretes">
          <h3>Datas chegando sem arte pedida · {lembretes.length}</h3>
          <ul>
            {lembretes.map((l) => (
              <li key={`${l.data.data}-${l.data.nome}`} className="tarefa">
                <span className="sinal-tarefa lembrete" aria-hidden="true" />
                <div className="oque">
                  <strong>{l.data.nome}</strong>
                  <span>{dataPorExtenso(l.data.data)} · {l.faltam === 0 ? "é hoje" : l.faltam === 1 ? "falta 1 dia" : `faltam ${l.faltam} dias`}</span>
                </div>
                <span className="acoes">
                  <button type="button" onClick={() => onNovo({ titulo: l.data.nome, uso: l.data.data })}>Pedir arte</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="filtros" aria-label="Situação">
        {FILTROS.map((f) => (
          <button key={f.id} type="button" className={f.id === filtro ? "ativo" : ""} onClick={() => setFiltro(f.id)}>
            {f.nome} · {conta(f.id)}
          </button>
        ))}
      </nav>

      {pedidos === null ? (
        <p className="vazio">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="vazio">
          {filtro === "aberto" ? "Nenhum pedido em aberto. Use + Novo pedido." : "Nada aqui."}
        </p>
      ) : (
        <ul className="lista-pedidos">
          {lista.map((p) => {
            const s = situacaoPedido(p);
            const atrasado = s === "aberto" && p.prazo && p.prazo < hoje;
            const resp = nomeDe(equipe, p.responsavel_id);
            return (
              <li key={p.id}>
                <button type="button" className="pedido" onClick={() => onAbrir(p)}>
                  <span className={`sinal-tarefa ${s === "aberto" ? "atrasada" : "feito"}`} aria-hidden="true" />
                  <span className="pedido-nome">
                    <strong>{p.titulo}</strong>
                    {p.descricao && <small>{p.descricao}</small>}
                  </span>
                  <span className="pedido-casa">
                    {p.casas.length === 0 ? (
                      <i className="etiqueta" style={{ background: "#8b7cf6" }}>Todas</i>
                    ) : (
                      p.casas.map((c) => <i key={c} className="etiqueta" style={{ background: casa(c).cor }}>{casa(c).curto}</i>)
                    )}
                    <span>{p.pecas.join(" + ")}</span>
                  </span>
                  <span className="pedido-data uso"><small>Postar</small>{p.uso ? diaCurto(p.uso) : "sem data"}</span>
                  <span className={`pedido-data prazo-pedido ${atrasado ? "atrasado" : ""}`}>
                    <small>Entregar</small>
                    {p.prazo ? (atrasado ? `venceu ${dataCurta(p.prazo)}` : dataCurta(p.prazo)) : "sem prazo"}
                  </span>
                  <span className={`pedido-resp ${resp ? "mencao" : "sem-resp"}`}>{resp ? `@${resp}` : "sem responsável"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
