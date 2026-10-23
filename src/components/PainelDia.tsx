import { useState, type FormEvent } from "react";
import { banco } from "../lib/banco.ts";
import { casa, type Evento } from "../lib/tipos.ts";
import { dataPorExtenso, type DataISO } from "../lib/datas.ts";
import type { DataEspecial, TipoData } from "../lib/feriados.ts";
import type { Pedido } from "../lib/pedidos.ts";

const NOME_TIPO: Record<TipoData, string> = {
  feriado: "Feriado",
  ponto_facultativo: "Ponto facultativo",
  comercial: "Data comercial",
  local: "Evento na cidade",
};

interface Props {
  data: DataISO;
  eventos: Evento[];
  especiais: DataEspecial[];
  pedidos: Pedido[];
  podeEditar: boolean;
  onAbrirPedido(p: Pedido): void;
  onFechar(): void;
  onNovo(): void;
  onEditar(e: Evento): void;
  onDatasMudaram(): void;
}

export function PainelDia({ data, eventos, especiais, pedidos, podeEditar, onAbrirPedido, onFechar, onNovo, onEditar, onDatasMudaram }: Props) {
  const [novaData, setNovaData] = useState<{ nome: string; tipo: TipoData; precisa_arte: boolean; avisar_dias: number } | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);

  async function salvarData(ev: FormEvent) {
    ev.preventDefault();
    if (!novaData?.nome.trim()) return;
    await banco.salvarDataEspecial({
      data,
      nome: novaData.nome.trim(),
      tipo: novaData.tipo,
      precisa_arte: novaData.precisa_arte,
      avisar_dias: novaData.precisa_arte ? novaData.avisar_dias : undefined,
    });
    setNovaData(null);
    onDatasMudaram();
  }

  async function alternarLembrete(d: DataEspecial) {
    await banco.salvarDataEspecial({ ...d, precisa_arte: !d.precisa_arte, avisar_dias: d.avisar_dias ?? 21 });
    onDatasMudaram();
  }

  async function apagarData(d: DataEspecial) {
    if (!d.id) return;
    if (apagando !== d.id) return setApagando(d.id);
    await banco.apagarDataEspecial(d.id);
    onDatasMudaram();
  }

  return (
    <aside className="painel">
      <div className="painel-topo">
        <h3>{dataPorExtenso(data)}</h3>
        <button className="link" onClick={onFechar} aria-label="Fechar">✕</button>
      </div>

      {especiais.length > 0 && (
        <ul className="especiais">
          {especiais.map((d) => (
            <li key={`${d.nome}-${d.id ?? ""}`} className={d.tipo}>
              <span>{d.nome}</span>
              <small>
                {NOME_TIPO[d.tipo]}
                {d.precisa_arte && ` · lembrar da arte ${d.avisar_dias ?? 21} dias antes`}
              </small>
              {d.editavel && podeEditar && (
                <span className="acoes-data">
                  <button className="link" onClick={() => alternarLembrete(d)}>{d.precisa_arte ? "tirar lembrete" : "lembrar de pedir arte"}</button>
                  <button className="link" onClick={() => apagarData(d)}>{apagando === d.id ? "confirmar" : "apagar"}</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {pedidos.length > 0 && (
        <ul className="lista-eventos">
          {pedidos.map((p) => (
            <li key={p.id}>
              <button className="cartao cartao-pedido" onClick={() => onAbrirPedido(p)}>
                <span className="casas">Pedido de arte · {p.casas.length ? p.casas.map((c) => casa(c).nome).join(" + ") : "Todas as casas"}</span>
                <strong>{p.titulo}</strong>
                <span className="linha">
                  {p.pecas.length > 0 && <span>{p.pecas.join(" + ")}</span>}
                  <span className="arte">
                    <span className={`sinal ${p.em_producao || p.entregue ? "sim" : "nao"}`} aria-hidden="true" />
                    {p.entregue ? "Entregue" : p.em_producao ? "Em produção" : "Em aberto"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {podeEditar && <button className="primario largo" onClick={onNovo}>+ Adicionar evento</button>}

      {eventos.length === 0 ? (
        <p className="vazio">Nenhum evento nesta data.</p>
      ) : (
        <ul className="lista-eventos">
          {eventos.map((e) => (
            <li key={e.id}>
              <button className="cartao" onClick={() => onEditar(e)} style={{ borderLeftColor: casa(e.casas[0]).cor }}>
                <span className="casas">
                  {e.casas.map((c) => casa(c).nome).join(" + ")}
                  {e.local ? ` · ${e.local}` : ""}
                </span>
                <strong>{e.nome}</strong>
                <span className="linha">
                  {e.horario && <span>{e.horario}</span>}
                  <span className={`status s-${e.status.toLowerCase()}`}>{e.status}</span>
                  <span className="arte">
                    <span className={`sinal ${e.em_producao ? "sim" : "nao"}`} aria-hidden="true" />
                    {e.em_producao ? "Arte em produção" : "Arte em aberto"}
                  </span>
                </span>
                {e.atracoes.length > 0 && <span className="atracoes">{e.atracoes.map((a) => a.nome).join(", ")}</span>}
                {e.entrada && <span className="detalhe">Entrada: {e.entrada}</span>}
                {e.promocao && <span className="detalhe">Promo: {e.promocao}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!podeEditar ? null : novaData ? (
        <form className="nova-data" onSubmit={salvarData}>
          <input
            autoFocus
            placeholder="Ex.: Oktoberfest, show na Vila Germânica"
            value={novaData.nome}
            onChange={(e) => setNovaData({ ...novaData, nome: e.target.value })}
          />
          <select value={novaData.tipo} onChange={(e) => setNovaData({ ...novaData, tipo: e.target.value as TipoData })}>
            <option value="local">Evento na cidade</option>
            <option value="comercial">Data comercial</option>
            <option value="feriado">Feriado</option>
            <option value="ponto_facultativo">Ponto facultativo</option>
          </select>
          {novaData.tipo === "comercial" && (
            <div className="lembrete-arte">
              <label className="check">
                <input type="checkbox" checked={novaData.precisa_arte} onChange={(e) => setNovaData({ ...novaData, precisa_arte: e.target.checked })} />
                <span>Lembrar de pedir arte</span>
              </label>
              {novaData.precisa_arte && (
                <label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    inputMode="numeric"
                    aria-label="Dias antes"
                    value={novaData.avisar_dias}
                    onChange={(e) => setNovaData({ ...novaData, avisar_dias: Math.max(1, Number(e.target.value) || 21) })}
                  />
                  dias antes
                </label>
              )}
            </div>
          )}
          <div className="botoes">
            <button type="button" onClick={() => setNovaData(null)}>Cancelar</button>
            <button className="primario">Salvar data</button>
          </div>
        </form>
      ) : (
        <button className="link marcar" onClick={() => setNovaData({ nome: "", tipo: "local", precisa_arte: false, avisar_dias: 21 })}>
          + Marcar feriado, data comercial ou evento na cidade
        </button>
      )}
    </aside>
  );
}
