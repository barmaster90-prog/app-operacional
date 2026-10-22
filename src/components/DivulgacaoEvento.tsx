import { useEffect, useState } from "react";
import { banco, ehGestao, type Usuario } from "../lib/banco.ts";
import { casa, type Evento } from "../lib/tipos.ts";
import { dataPorExtenso } from "../lib/datas.ts";
import {
  FORMATOS,
  REDES,
  novoIdItem,
  type Divulgacao,
  type ListaFeita,
  type Postagem,
  type Video,
} from "../lib/divulgacao.ts";

interface Props {
  evento: Evento;
  usuario: Usuario;
  onFechar(): void;
  onMudou(d: Divulgacao): void;
}

function lerReais(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(limpo);
  return limpo && Number.isFinite(n) ? n : null;
}

const dataCurta = (d?: string) => (d ? d.split("-").reverse().slice(0, 2).join("/") : "sem data");

export function DivulgacaoEvento({ evento, usuario, onFechar, onMudou }: Props) {
  const [d, setD] = useState<Divulgacao | null>(null);
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  // Produção vê tudo (menos o valor) e marca o que já foi postado ou gravado.
  const leitura = !ehGestao(usuario);

  useEffect(() => {
    banco
      .divulgacao(evento.id)
      .then((x) => {
        setD(x);
        setValor(x.impulso_valor != null ? String(x.impulso_valor) : "");
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao abrir a divulgação."));
  }, [evento.id]);

  if (!d) {
    return (
      <div className="fundo-modal" onClick={onFechar}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>{erro || "Carregando…"}</div>
      </div>
    );
  }

  const set = <K extends keyof Divulgacao>(k: K, v: Divulgacao[K]) => setD((x) => (x ? { ...x, [k]: v } : x));
  const mudarPostagem = (id: string, mudanca: Partial<Postagem>) =>
    set("postagens", d.postagens.map((p) => (p.id === id ? { ...p, ...mudanca } : p)));
  const mudarVideo = (id: string, mudanca: Partial<Video>) =>
    set("videos", d.videos.map((v) => (v.id === id ? { ...v, ...mudanca } : v)));

  async function salvar() {
    if (!d) return;
    setSalvando(true);
    setErro("");
    try {
      const salvo = await banco.salvarDivulgacao({ ...d, impulso_valor: lerReais(valor) });
      setD(salvo);
      setAviso("Divulgação salva.");
      onMudou(salvo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function marcar(lista: ListaFeita, id: string, feito: boolean) {
    if (!d) return;
    if (!leitura) {
      // A Gestão marca junto com o resto e salva no botão.
      if (lista === "postagens") mudarPostagem(id, { feito });
      else mudarVideo(id, { feito });
      return;
    }
    setErro("");
    try {
      const novo = await banco.marcarFeito(evento.id, lista, id, feito);
      setD(novo);
      setAviso(feito ? "Marcado como feito." : "Desmarcado.");
      onMudou(novo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível marcar.");
    }
  }

  async function copiarLegenda() {
    try {
      await navigator.clipboard.writeText(d?.legenda ?? "");
      setAviso("Legenda copiada.");
    } catch {
      setAviso("Não deu para copiar sozinho: selecione o texto e use Ctrl+C.");
    }
  }

  const feitas = d.postagens.filter((p) => p.feito).length;
  const prontos = d.videos.filter((v) => v.feito).length;

  return (
    <div className="fundo-modal" onClick={onFechar}>
      <div className="modal material divulgacao" onClick={(e) => e.stopPropagation()}>
        <div className="modal-topo">
          <h3>Divulgação · {evento.nome}</h3>
          <button type="button" className="link" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>
        <p className="sub-evento">
          {dataPorExtenso(evento.data)} · {evento.casas.map((c) => casa(c).nome).join(" + ")}
        </p>

        <section className="bloco">
          <h4>Legenda do post</h4>
          <textarea
            id="div-legenda"
            rows={5}
            readOnly={leitura}
            value={d.legenda ?? ""}
            onChange={(e) => set("legenda", e.target.value)}
            placeholder={leitura ? "" : "Texto que vai na legenda do Instagram, TikTok…"}
          />
          {d.legenda && <button type="button" onClick={copiarLegenda}>Copiar legenda</button>}
        </section>

        <section className="bloco">
          <h4>Link de venda ou lista</h4>
          {leitura ? (
            d.link_venda ? <a className="link-externo" href={d.link_venda} target="_blank" rel="noreferrer">{d.link_venda}</a> : <small>Nenhum link.</small>
          ) : (
            <input id="div-link" value={d.link_venda ?? ""} onChange={(e) => set("link_venda", e.target.value)} placeholder="https://…" />
          )}
        </section>

        <section className="bloco">
          <h4>Quando postar {d.postagens.length > 0 && <span className="contagem">{feitas}/{d.postagens.length} postadas</span>}</h4>
          {d.postagens.length === 0 && <small>Nenhuma postagem planejada.</small>}
          <ul className="itens">
            {d.postagens.map((p) => (
              <li key={p.id} className={`postagem ${p.feito ? "feito" : ""}`}>
                <label className="check">
                  <input type="checkbox" checked={p.feito} onChange={(e) => marcar("postagens", p.id, e.target.checked)} />
                  <span>{p.feito ? "Postado" : "A postar"}</span>
                </label>
                {leitura ? (
                  <span className="resumo-item">{dataCurta(p.data)} · {p.rede} · {p.formato}</span>
                ) : (
                  <>
                    <input type="date" aria-label="Data" value={p.data ?? ""} onChange={(e) => mudarPostagem(p.id, { data: e.target.value || undefined })} />
                    <select aria-label="Rede" value={p.rede} onChange={(e) => mudarPostagem(p.id, { rede: e.target.value })}>
                      {REDES.map((r) => <option key={r}>{r}</option>)}
                    </select>
                    <select aria-label="Formato" value={p.formato} onChange={(e) => mudarPostagem(p.id, { formato: e.target.value })}>
                      {FORMATOS.map((f) => <option key={f}>{f}</option>)}
                    </select>
                    <button type="button" className="link" onClick={() => set("postagens", d.postagens.filter((x) => x.id !== p.id))}>remover</button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {!leitura && (
            <button
              type="button"
              className="link"
              onClick={() => set("postagens", [...d.postagens, { id: novoIdItem(), rede: "Instagram", formato: "Feed", feito: false }])}
            >
              + Postagem
            </button>
          )}
        </section>

        <section className="bloco">
          <h4>Impulsionamento</h4>
          <label className="check">
            <input id="div-impulsionar" type="checkbox" disabled={leitura} checked={d.impulsionar} onChange={(e) => set("impulsionar", e.target.checked)} />
            <span>Vai ter impulsionamento</span>
          </label>
          {d.impulsionar && (
            <div className="campos">
              <label>
                Início
                <input type="date" readOnly={leitura} value={d.impulso_inicio ?? ""} onChange={(e) => set("impulso_inicio", e.target.value || undefined)} />
              </label>
              <label>
                Fim
                <input type="date" readOnly={leitura} value={d.impulso_fim ?? ""} onChange={(e) => set("impulso_fim", e.target.value || undefined)} />
              </label>
              <label className="inteiro">
                Público
                <input
                  readOnly={leitura}
                  value={d.impulso_publico ?? ""}
                  onChange={(e) => set("impulso_publico", e.target.value)}
                  placeholder={leitura ? "" : "Ex.: 18 a 26 anos, Blumenau e região, interesse em funk"}
                />
              </label>
              {!leitura && (
                <label>
                  Valor investido (só a Gestão vê)
                  <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="R$" />
                </label>
              )}
            </div>
          )}
        </section>

        <section className="bloco">
          <h4>Audiovisual {d.videos.length > 0 && <span className="contagem">{prontos}/{d.videos.length} vídeos prontos</span>}</h4>
          {d.videos.length === 0 && <small>Nenhum vídeo planejado.</small>}
          <ul className="itens">
            {d.videos.map((v, i) => (
              <li key={v.id} className={`video ${v.feito ? "feito" : ""}`}>
                <div className="video-topo">
                  <strong>Vídeo {i + 1}</strong>
                  <label className="check">
                    <input type="checkbox" checked={v.feito} onChange={(e) => marcar("videos", v.id, e.target.checked)} />
                    <span>{v.feito ? "Pronto" : "A produzir"}</span>
                  </label>
                  {!leitura && (
                    <button type="button" className="link" onClick={() => set("videos", d.videos.filter((x) => x.id !== v.id))}>remover</button>
                  )}
                </div>
                {leitura ? (
                  <dl className="ficha">
                    <dt>O quê</dt><dd>{v.titulo || "—"}</dd>
                    <dt>Quem produz</dt><dd>{v.responsavel || "—"}</dd>
                    <dt>Prazo</dt><dd>{v.prazo ? dataPorExtenso(v.prazo) : "—"}</dd>
                    <dt>Roteiro</dt><dd className="roteiro">{v.roteiro || "—"}</dd>
                  </dl>
                ) : (
                  <div className="campos">
                    <label className="inteiro">
                      O quê
                      <input value={v.titulo} onChange={(e) => mudarVideo(v.id, { titulo: e.target.value })} placeholder="Ex.: teaser de anúncio, reels do line-up, aftermovie" />
                    </label>
                    <label>
                      Quem produz
                      <input value={v.responsavel ?? ""} onChange={(e) => mudarVideo(v.id, { responsavel: e.target.value })} />
                    </label>
                    <label>
                      Prazo
                      <input type="date" value={v.prazo ?? ""} onChange={(e) => mudarVideo(v.id, { prazo: e.target.value || undefined })} />
                    </label>
                    <label className="inteiro">
                      Roteiro
                      <textarea rows={4} value={v.roteiro ?? ""} onChange={(e) => mudarVideo(v.id, { roteiro: e.target.value })} placeholder="Cenas, falas, músicas, takes que precisam…" />
                    </label>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!leitura && (
            <button type="button" className="link" onClick={() => set("videos", [...d.videos, { id: novoIdItem(), titulo: "", feito: false }])}>
              + Vídeo
            </button>
          )}
        </section>

        {erro && <p className="erro">{erro}</p>}
        {aviso && !erro && <p className="ok">{aviso}</p>}

        <div className="modal-rodape">
          <span className="espaco" />
          <button type="button" onClick={onFechar}>Fechar</button>
          {!leitura && (
            <button type="button" className="primario" disabled={salvando} onClick={salvar}>
              {salvando ? "Salvando…" : "Salvar divulgação"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
