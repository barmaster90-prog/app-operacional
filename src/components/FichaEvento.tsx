import { useEffect, useState } from "react";
import { banco, type Usuario } from "../lib/banco.ts";
import { casa, type Evento } from "../lib/tipos.ts";
import { dataPorExtenso } from "../lib/datas.ts";
import type { DataEspecial } from "../lib/feriados.ts";
import { MaterialEvento } from "./MaterialEvento.tsx";
import { DivulgacaoEvento } from "./DivulgacaoEvento.tsx";
import { ConversaEvento } from "./ConversaEvento.tsx";
import type { Destino } from "../lib/avisos.ts";
import { resumoDivulgacao } from "../lib/divulgacao.ts";

interface Props {
  evento: Evento;
  usuario: Usuario;
  datasExtras: DataEspecial[];
  onFechar(): void;
  onMudou(): void;
  /** Abre direto uma parte do evento (vindo de um aviso ou do painel). */
  abrir?: Destino;
}

/** Ficha só de leitura, para quem não edita eventos (Produção). Não mostra valores. */
export function FichaEvento({ evento, usuario, datasExtras, onFechar, onMudou, abrir }: Props) {
  const [abrirMaterial, setAbrirMaterial] = useState(abrir === "material");
  const [abrirDivulgacao, setAbrirDivulgacao] = useState(abrir === "divulgacao");
  const [abrirConversa, setAbrirConversa] = useState(abrir === "conversa");
  const [mensagens, setMensagens] = useState<number | null>(null);
  const [resumo, setResumo] = useState("");
  const [emProducao, setEmProducao] = useState(Boolean(evento.em_producao));
  useEffect(() => {
    if (!evento.id) return;
    banco.divulgacao(evento.id).then((d) => setResumo(resumoDivulgacao(d))).catch(() => setResumo(""));
    banco.comentarios(evento.id).then((c) => setMensagens(c.length)).catch(() => setMensagens(null));
  }, [evento.id]);
  const casas = evento.casas.map((c) => casa(c).nome).join(" + ");

  return (
    <div className="fundo-modal" onClick={onFechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-topo">
          <h3>{evento.nome}</h3>
          <button type="button" className="link" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>

        <dl className="ficha">
          <dt>Data</dt><dd>{dataPorExtenso(evento.data)}</dd>
          {evento.horario && (<><dt>Abertura</dt><dd>{evento.horario}</dd></>)}
          <dt>Casa</dt><dd>{casas}{evento.local ? ` · ${evento.local}` : ""}</dd>
          <dt>Status</dt><dd><span className={`status s-${evento.status.toLowerCase()}`}>{evento.status}</span></dd>
          {evento.tipo && (<><dt>Tipo</dt><dd>{evento.tipo}</dd></>)}
          <dt>Atrações</dt><dd>{evento.atracoes.length ? evento.atracoes.map((a) => a.nome).join(", ") : "—"}</dd>
          {evento.entrada && (<><dt>Entrada</dt><dd>{evento.entrada}</dd></>)}
          {evento.promocao && (<><dt>Promoção</dt><dd>{evento.promocao}</dd></>)}
        </dl>

        <div className="secoes">
          <button type="button" className="secao" onClick={() => setAbrirMaterial(true)}>
            <span className={`sinal ${emProducao ? "sim" : "nao"}`} aria-hidden="true" />
            <strong>Material</strong>
            <small>{emProducao ? "Arte em produção" : "Arte em aberto"}</small>
          </button>
          <button type="button" className="secao" onClick={() => setAbrirDivulgacao(true)}>
            <strong>Divulgação</strong>
            <small>{resumo || "Abrir"}</small>
          </button>
          <button type="button" className="secao" onClick={() => setAbrirConversa(true)}>
            <strong>Conversa</strong>
            <small>{mensagens ? `${mensagens} mensage${mensagens > 1 ? "ns" : "m"}` : "Escrever, chamar com @"}</small>
          </button>
        </div>

        <div className="modal-rodape">
          <span className="espaco" />
          <button type="button" onClick={onFechar}>Fechar</button>
        </div>
      </div>
      {abrirConversa && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConversaEvento evento={evento} usuario={usuario} onFechar={() => setAbrirConversa(false)} onMudou={setMensagens} />
        </div>
      )}
      {abrirDivulgacao && (
        <div onClick={(e) => e.stopPropagation()}>
          <DivulgacaoEvento
            evento={evento}
            usuario={usuario}
            onFechar={() => setAbrirDivulgacao(false)}
            onMudou={(d) => setResumo(resumoDivulgacao(d))}
          />
        </div>
      )}
      {abrirMaterial && (
        <div onClick={(e) => e.stopPropagation()}>
          <MaterialEvento
            evento={evento}
            usuario={usuario}
            datasExtras={datasExtras}
            onFechar={() => setAbrirMaterial(false)}
            onMudou={(m) => {
              setEmProducao(m.em_producao);
              onMudou();
            }}
          />
        </div>
      )}
    </div>
  );
}
