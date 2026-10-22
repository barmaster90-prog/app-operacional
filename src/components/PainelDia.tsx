import { useState, type FormEvent } from "react";
import { banco } from "../lib/banco.ts";
import { casa, type Evento } from "../lib/tipos.ts";
import { dataPorExtenso, type DataISO } from "../lib/datas.ts";
import type { DataEspecial, TipoData } from "../lib/feriados.ts";

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
  onFechar(): void;
  onNovo(): void;
  onEditar(e: Evento): void;
  onDatasMudaram(): void;
}

export function PainelDia({ data, eventos, especiais, onFechar, onNovo, onEditar, onDatasMudaram }: Props) {
  const [novaData, setNovaData] = useState<{ nome: string; tipo: TipoData } | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);

  async function salvarData(ev: FormEvent) {
    ev.preventDefault();
    if (!novaData?.nome.trim()) return;
    await banco.salvarDataEspecial({ data, nome: novaData.nome.trim(), tipo: novaData.tipo });
    setNovaData(null);
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
              <small>{NOME_TIPO[d.tipo]}</small>
              {d.editavel && <button className="link" onClick={() => apagarData(d)}>{apagando === d.id ? "confirmar" : "apagar"}</button>}
            </li>
          ))}
        </ul>
      )}

      <button className="primario largo" onClick={onNovo}>+ Adicionar evento</button>

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

      {novaData ? (
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
          <div className="botoes">
            <button type="button" onClick={() => setNovaData(null)}>Cancelar</button>
            <button className="primario">Salvar data</button>
          </div>
        </form>
      ) : (
        <button className="link marcar" onClick={() => setNovaData({ nome: "", tipo: "local" })}>
          + Marcar feriado, data comercial ou evento na cidade
        </button>
      )}
    </aside>
  );
}
