import { useEffect, useRef, useState } from "react";
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
import { avisoDeTarefa, avisosDeMencao, enviarAvisos } from "../lib/notificar.ts";
import { CampoTexto } from "./CampoTexto.tsx";
import { useEquipe } from "./Equipe.tsx";

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

export function DivulgacaoEvento({ evento, usuario, onFechar, onMudou }: Props) {
  const [d, setD] = useState<Divulgacao | null>(null);
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  // Todo mundo programa posts e vídeos; só a Gestão vê e lança o valor do impulsionamento.
  const gestao = ehGestao(usuario);
  const equipe = useEquipe();
  const salvoRef = useRef<Divulgacao | null>(null);

  useEffect(() => {
    banco
      .divulgacao(evento.id)
      .then((x) => {
        salvoRef.current = x;
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
      const salvo = await banco.salvarDivulgacao({ ...d, impulso_valor: gestao ? lerReais(valor) : undefined });
      const antes = salvoRef.current;
      salvoRef.current = salvo;
      setD(salvo);
      setAviso("Divulgação salva.");
      onMudou(salvo);
      const postAntes = new Map(antes?.postagens.map((p) => [p.id, p]));
      const videoAntes = new Map(antes?.videos.map((v) => [v.id, v]));
      await enviarAvisos([
        ...avisosDeMencao(
          [
            { onde: "Legenda", antes: antes?.legenda, depois: salvo.legenda },
            { onde: "Público do impulsionamento", antes: antes?.impulso_publico, depois: salvo.impulso_publico },
            ...salvo.postagens.map((p) => ({ onde: `Post ${p.rede} · ${p.formato}`, antes: postAntes.get(p.id)?.texto, depois: p.texto })),
            ...salvo.videos.flatMap((v) => [
              { onde: "Vídeo", antes: videoAntes.get(v.id)?.titulo, depois: v.titulo },
              { onde: `Roteiro${v.titulo ? ` (${v.titulo})` : ""}`, antes: videoAntes.get(v.id)?.roteiro, depois: v.roteiro },
            ]),
          ],
          equipe,
          usuario,
          evento,
          "divulgacao",
        ),
        ...salvo.postagens.flatMap((p) =>
          avisoDeTarefa(p.responsavel_id, postAntes.get(p.id)?.responsavel_id, usuario, evento, "divulgacao", `Postar ${p.rede} · ${p.formato}`, p.data),
        ),
        ...salvo.videos.flatMap((v) =>
          avisoDeTarefa(v.responsavel_id, videoAntes.get(v.id)?.responsavel_id, usuario, evento, "divulgacao", `Vídeo${v.titulo ? `: ${v.titulo}` : ""}`, v.prazo),
        ),
      ]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  /** Volta um post para "a postar" (ou vídeo para "a produzir") marcado sem querer. Grava na hora. */
  async function desfazer(lista: ListaFeita, id: string) {
    if (!d) return;
    if (lista === "postagens") mudarPostagem(id, { feito: false });
    else mudarVideo(id, { feito: false });
    setErro("");
    try {
      const novo = await banco.marcarFeito(evento.id, lista, id, false);
      salvoRef.current = novo;
      setAviso("Desfeito.");
      onMudou(novo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível desfazer.");
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
          <CampoTexto id="div-legenda" rows={5} value={d.legenda ?? ""} onChange={(v) => set("legenda", v)} placeholder="Texto que vai na legenda do Instagram, TikTok…" />
          {d.legenda && <button type="button" onClick={copiarLegenda}>Copiar legenda</button>}
        </section>

        <section className="bloco">
          <h4>Link de venda ou lista</h4>
          <input id="div-link" value={d.link_venda ?? ""} onChange={(e) => set("link_venda", e.target.value)} placeholder="https://…" />
        </section>

        <section className="bloco">
          <h4>Quando postar {d.postagens.length > 0 && <span className="contagem">{feitas}/{d.postagens.length} postadas</span>}</h4>
          {d.postagens.length === 0 && <small>Nenhuma postagem planejada.</small>}
          <ul className="itens">
            {d.postagens.map((p) => (
              <li key={p.id} className={`postagem ${p.feito ? "feito" : ""}`}>
                <div className="item-topo">
                  {/* Marca-se "postado" no calendário do Marketing e nas Pendências; aqui dá para desfazer. */}
                  <span className={`selo-feito ${p.feito ? "sim" : ""}`}>
                    {p.feito ? "Postado" : "A postar"}
                    {p.feito && <button type="button" className="link" onClick={() => desfazer("postagens", p.id)}>desfazer</button>}
                  </span>
                  <button type="button" className="link" onClick={() => set("postagens", d.postagens.filter((x) => x.id !== p.id))}>remover</button>
                </div>
                <div className="postagem-campos">
                  <input type="date" aria-label="Data" value={p.data ?? ""} onChange={(e) => mudarPostagem(p.id, { data: e.target.value || undefined })} />
                  <select aria-label="Rede" value={p.rede} onChange={(e) => mudarPostagem(p.id, { rede: e.target.value })}>
                    {REDES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                  <select aria-label="Formato" value={p.formato} onChange={(e) => mudarPostagem(p.id, { formato: e.target.value })}>
                    {FORMATOS.map((f) => <option key={f}>{f}</option>)}
                  </select>
                  <select aria-label="Quem posta" value={p.responsavel_id ?? ""} onChange={(e) => mudarPostagem(p.id, { responsavel_id: e.target.value || undefined })}>
                    <option value="">Quem posta?</option>
                    {equipe.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                  </select>
                </div>
                <CampoTexto
                  linha
                  ariaLabel="O que vai ser postado"
                  value={p.texto ?? ""}
                  onChange={(t) => mudarPostagem(p.id, { texto: t })}
                  placeholder="O que vai ser postado? Use @ para chamar alguém"
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="link"
            onClick={() => set("postagens", [...d.postagens, { id: novoIdItem(), rede: "Instagram", formato: "Feed", responsavel_id: gestao ? undefined : usuario.id, feito: false }])}
          >
            + Postagem
          </button>
        </section>

        <section className="bloco">
          <h4>Impulsionamento</h4>
          <label className="check">
            <input id="div-impulsionar" type="checkbox" checked={d.impulsionar} onChange={(e) => set("impulsionar", e.target.checked)} />
            <span>Vai ter impulsionamento</span>
          </label>
          {d.impulsionar && (
            <div className="campos">
              <label>
                Início
                <input type="date" value={d.impulso_inicio ?? ""} onChange={(e) => set("impulso_inicio", e.target.value || undefined)} />
              </label>
              <label>
                Fim
                <input type="date" value={d.impulso_fim ?? ""} onChange={(e) => set("impulso_fim", e.target.value || undefined)} />
              </label>
              <label className="inteiro">
                Público
                <CampoTexto
                  linha
                  value={d.impulso_publico ?? ""}
                  onChange={(v) => set("impulso_publico", v)}
                  placeholder="Ex.: 18 a 26 anos, Blumenau e região, interesse em funk"
                />
              </label>
              {gestao && (
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
                  <span className={`selo-feito ${v.feito ? "sim" : ""}`}>
                    {v.feito ? "Pronto" : "A produzir"}
                    {v.feito && <button type="button" className="link" onClick={() => desfazer("videos", v.id)}>desfazer</button>}
                  </span>
                  <button type="button" className="link" onClick={() => set("videos", d.videos.filter((x) => x.id !== v.id))}>remover</button>
                </div>
                <div className="campos">
                    <label className="inteiro">
                      O quê
                      <CampoTexto linha value={v.titulo} onChange={(t) => mudarVideo(v.id, { titulo: t })} placeholder="Ex.: teaser de anúncio, reels do line-up, aftermovie" />
                    </label>
                    <label>
                      Quem produz
                      <select value={v.responsavel_id ?? ""} onChange={(e) => mudarVideo(v.id, { responsavel_id: e.target.value || undefined })}>
                        <option value="">{v.responsavel ? `${v.responsavel} (escrito antes)` : "—"}</option>
                        {equipe.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                      </select>
                    </label>
                    <label>
                      Prazo
                      <input type="date" value={v.prazo ?? ""} onChange={(e) => mudarVideo(v.id, { prazo: e.target.value || undefined })} />
                    </label>
                    <label className="inteiro">
                      Roteiro
                      <CampoTexto rows={4} value={v.roteiro ?? ""} onChange={(t) => mudarVideo(v.id, { roteiro: t })} placeholder="Cenas, falas, músicas, takes que precisam… Use @ para chamar alguém." />
                    </label>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="link" onClick={() => set("videos", [...d.videos, { id: novoIdItem(), titulo: "", feito: false }])}>
            + Vídeo
          </button>
        </section>

        {erro && <p className="erro">{erro}</p>}
        {aviso && !erro && <p className="ok">{aviso}</p>}

        <div className="modal-rodape">
          <span className="espaco" />
          <button type="button" onClick={onFechar}>Fechar</button>
          <button type="button" className="primario" disabled={salvando} onClick={salvar}>
            {salvando ? "Salvando…" : "Salvar divulgação"}
          </button>
        </div>
      </div>
    </div>
  );
}
