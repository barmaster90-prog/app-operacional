import { useState, type FormEvent } from "react";
import { banco, type Usuario } from "../lib/banco.ts";
import { CASAS, STATUS, TIPOS_EVENTO, casa, type Atracao, type CasaId, type Evento, type Status } from "../lib/tipos.ts";
import { dataPorExtenso } from "../lib/datas.ts";

interface Props {
  inicial: Partial<Evento>;
  usuario: Usuario;
  onFechar(): void;
  onSalvo(): void;
}

function lerReais(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(limpo);
  return limpo && Number.isFinite(n) ? n : null;
}

export function FormEvento({ inicial, usuario, onFechar, onSalvo }: Props) {
  const [ev, setEv] = useState<Partial<Evento>>({ atracoes: [], casas: ["downtown"], status: "Ideia", ...inicial });
  const [atracoes, setAtracoes] = useState<{ nome: string; cache: string; obs: string }[]>(
    (inicial.atracoes ?? []).map((a) => ({ nome: a.nome, cache: a.cache != null ? String(a.cache) : "", obs: a.obs ?? "" })),
  );
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const editando = Boolean(ev.id);

  const set = <K extends keyof Evento>(k: K, v: Evento[K]) => setEv((x) => ({ ...x, [k]: v }));
  const casasSel = ev.casas ?? [];
  const locais = [...new Set(casasSel.flatMap((c) => casa(c).locais))];
  const totalCache = atracoes.reduce((s, a) => s + (lerReais(a.cache) ?? 0), 0);

  function alternarCasa(id: CasaId) {
    const nova = casasSel.includes(id) ? casasSel.filter((c) => c !== id) : [...casasSel, id];
    set("casas", nova);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!ev.nome?.trim()) return setErro("Dê um nome ao evento.");
    if (casasSel.length === 0) return setErro("Escolha pelo menos uma casa.");
    setSalvando(true);
    setErro("");
    const lista: Atracao[] = atracoes
      .filter((a) => a.nome.trim())
      .map((a) => ({ nome: a.nome.trim(), cache: lerReais(a.cache), obs: a.obs.trim() || undefined }));
    try {
      await banco.salvarEvento({
        id: ev.id,
        data: ev.data!,
        casas: casasSel,
        local: locais.includes(ev.local ?? "") ? ev.local : undefined,
        nome: ev.nome.trim(),
        tipo: ev.tipo || undefined,
        status: (ev.status ?? "Ideia") as Status,
        horario: ev.horario || undefined,
        atracoes: lista,
        entrada: ev.entrada || undefined,
        promocao: ev.promocao || undefined,
        briefing: ev.briefing || undefined,
        obs: ev.obs || undefined,
        criado_por: ev.criado_por ?? usuario.nome,
      });
      onSalvo();
    } catch (er) {
      setErro(er instanceof Error ? er.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  }

  async function apagar() {
    if (!ev.id) return;
    if (!confirmarApagar) return setConfirmarApagar(true);
    await banco.apagarEvento(ev.id);
    onSalvo();
  }

  function duplicar() {
    const { id: _id, ...resto } = ev;
    setEv({ ...resto, nome: `${ev.nome} (cópia)`, status: "Ideia" });
  }

  return (
    <div className="fundo-modal" onClick={onFechar}>
      <form className="modal" onSubmit={salvar} onClick={(e) => e.stopPropagation()}>
        <div className="modal-topo">
          <h3>{ev.id ? "Editar evento" : "Novo evento"}</h3>
          <button type="button" className="link" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>

        <div className="campos">
          <label className="inteiro">
            Nome do evento *
            <input value={ev.nome ?? ""} onChange={(e) => set("nome", e.target.value)} autoFocus placeholder="Ex.: Hallowtown" />
          </label>

          <label>
            Data *
            <input type="date" value={ev.data ?? ""} onChange={(e) => set("data", e.target.value)} required />
            {ev.data && <small>{dataPorExtenso(ev.data)}</small>}
          </label>

          <label>
            Abertura
            <input type="time" value={ev.horario ?? ""} onChange={(e) => set("horario", e.target.value)} />
          </label>

          <fieldset className="inteiro">
            <legend>Casa(s) *</legend>
            <div className="opcoes-casa">
              {CASAS.map((c) => (
                <label key={c.id} className={`opcao ${casasSel.includes(c.id) ? "marcada" : ""}`} style={{ borderColor: c.cor }}>
                  <input type="checkbox" checked={casasSel.includes(c.id)} onChange={() => alternarCasa(c.id)} />
                  <i style={{ background: c.cor }} />
                  {c.nome}
                </label>
              ))}
            </div>
          </fieldset>

          {locais.length > 0 && (
            <label>
              Local
              <select value={ev.local ?? ""} onChange={(e) => set("local", e.target.value)}>
                <option value="">—</option>
                {locais.map((l) => <option key={l}>{l}</option>)}
              </select>
            </label>
          )}

          <label>
            Status
            <select value={ev.status} onChange={(e) => set("status", e.target.value as Status)}>
              {STATUS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>

          <label>
            Tipo
            <select value={ev.tipo ?? ""} onChange={(e) => set("tipo", e.target.value)}>
              <option value="">—</option>
              {TIPOS_EVENTO.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>

          <fieldset className="inteiro">
            <legend>Atrações (DJs, bandas)</legend>
            {atracoes.map((a, i) => (
              <div key={i} className="linha-atracao">
                <input placeholder="Nome" value={a.nome} onChange={(e) => setAtracoes(atracoes.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
                <input placeholder="Cachê R$" inputMode="decimal" value={a.cache} onChange={(e) => setAtracoes(atracoes.map((x, j) => (j === i ? { ...x, cache: e.target.value } : x)))} />
                <input placeholder="Obs. (aéreo, hotel, porta…)" value={a.obs} onChange={(e) => setAtracoes(atracoes.map((x, j) => (j === i ? { ...x, obs: e.target.value } : x)))} />
                <button type="button" className="link" onClick={() => setAtracoes(atracoes.filter((_, j) => j !== i))} aria-label="Remover">✕</button>
              </div>
            ))}
            <div className="linha-acoes">
              <button type="button" onClick={() => setAtracoes([...atracoes, { nome: "", cache: "", obs: "" }])}>+ Atração</button>
              {totalCache > 0 && <span>Total de cachês: {totalCache.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>}
            </div>
          </fieldset>

          <label>
            Entrada
            <input value={ev.entrada ?? ""} onChange={(e) => set("entrada", e.target.value)} placeholder="Ex.: Free com lista até 00h" />
          </label>

          <label>
            Promoção de bebidas
            <input value={ev.promocao ?? ""} onChange={(e) => set("promocao", e.target.value)} placeholder="Ex.: Cuba libre R$ 10 até 00h" />
          </label>

          <label className="inteiro">
            Informações para arte e vídeo
            <textarea value={ev.briefing ?? ""} onChange={(e) => set("briefing", e.target.value)} rows={3} />
          </label>

          <label className="inteiro">
            Observações
            <textarea value={ev.obs ?? ""} onChange={(e) => set("obs", e.target.value)} rows={2} />
          </label>
        </div>

        {erro && <p className="erro">{erro}</p>}

        <div className="modal-rodape">
          {editando && (
            <>
              <button type="button" className="perigo" onClick={apagar}>{confirmarApagar ? "Confirmar exclusão" : "Apagar"}</button>
              <button type="button" onClick={duplicar}>Duplicar</button>
            </>
          )}
          <span className="espaco" />
          <button type="button" onClick={onFechar}>Cancelar</button>
          <button className="primario" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    </div>
  );
}
