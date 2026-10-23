import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Evento, EventoNovo } from "./tipos.ts";
import type { DataEspecial } from "./feriados.ts";
import type { DataISO } from "./datas.ts";
import { materialVazio, normalizarMaterial, type Anexo, type Material } from "./material.ts";
import { divulgacaoVazia, normalizarDivulgacao, type Divulgacao, type ListaFeita } from "./divulgacao.ts";
import { EQUIPE_EXEMPLO, type Membro } from "./equipe.ts";
import type { Aviso, AvisoNovo, Comentario } from "./avisos.ts";
import { normalizarPedido, type Pedido } from "./pedidos.ts";

/** Gestão vê e edita tudo. Produção vê a agenda e o Material e marca "em produção", sem ver valores. */
export type Papel = "gestao" | "producao" | "agencia";

export const NOME_PAPEL: Record<Papel, string> = { gestao: "Gestão", producao: "Produção", agencia: "Agência" };

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  papel: Papel;
}

export const ehGestao = (u: Usuario) => u.papel === "gestao";
/** Agência só lê os briefings, copia, baixa e marca "em produção". */
export const ehAgencia = (u: Pick<Usuario, "papel">) => u.papel === "agencia";

/** Tira cachês e observações das atrações (o que a Produção não pode ver). */
export function semValores(e: Evento): Evento {
  return { ...e, atracoes: e.atracoes.map((a) => ({ nome: a.nome })) };
}

/** Tudo que o app precisa guardar. Duas implementações: Supabase (real) e demonstração (navegador). */
export interface Banco {
  demo: boolean;
  usuarioAtual(): Promise<Usuario | null>;
  /** No modo demonstração, `membroId` escolhe quem da equipe está entrando. */
  entrar(email: string, senha: string, membroId?: string): Promise<Usuario>;
  sair(): Promise<void>;
  aoMudarLogin(cb: (u: Usuario | null) => void): () => void;
  eventos(de: DataISO, ate: DataISO): Promise<Evento[]>;
  salvarEvento(e: EventoNovo & { id?: string }): Promise<Evento>;
  apagarEvento(id: string): Promise<void>;
  datasEspeciais(de: DataISO, ate: DataISO): Promise<DataEspecial[]>;
  salvarDataEspecial(d: DataEspecial): Promise<DataEspecial>;
  apagarDataEspecial(id: string): Promise<void>;
  material(eventoId: string): Promise<Material>;
  salvarMaterial(m: Material): Promise<Material>;
  /** Única escrita liberada para a Produção. */
  marcarProducao(eventoId: string, emProducao: boolean): Promise<Material>;
  divulgacao(eventoId: string): Promise<Divulgacao>;
  salvarDivulgacao(d: Divulgacao): Promise<Divulgacao>;
  /** Marca uma postagem ou um vídeo como feito. Liberado também para a Produção. */
  marcarFeito(eventoId: string, lista: ListaFeita, itemId: string, feito: boolean): Promise<Divulgacao>;
  enviarAnexo(eventoId: string, arquivo: File): Promise<Anexo>;
  removerAnexo(anexo: Anexo): Promise<void>;
  /** Todo mundo que pode ser mencionado ou ser responsável. */
  equipe(): Promise<Membro[]>;
  /** Só a Gestão. No app real, a pessoa precisa ter login criado antes. */
  salvarMembro(m: Membro): Promise<Membro>;
  comentarios(eventoId: string): Promise<Comentario[]>;
  comentar(eventoId: string, texto: string): Promise<Comentario>;
  /** Avisos para quem está logado, do mais novo para o mais antigo. */
  avisos(): Promise<Aviso[]>;
  avisar(lista: AvisoNovo[]): Promise<void>;
  marcarLidos(ids: string[]): Promise<void>;
  /** Eventos com Material e Divulgação, para os painéis. */
  painel(de: DataISO, ate: DataISO): Promise<DadosPainel>;
  /** Pedidos de arte sem evento (todos; são poucos). */
  pedidos(): Promise<Pedido[]>;
  /** Gestão cria e edita. Devolve o pedido com o id gravado. */
  salvarPedido(p: Pedido): Promise<Pedido>;
  apagarPedido(id: string): Promise<void>;
  /** Liberado também para a Produção, como no Material. */
  marcarProducaoPedido(id: string, emProducao: boolean): Promise<Pedido>;
}

export interface DadosPainel {
  eventos: Evento[];
  materiais: Record<string, Material>;
  divulgacoes: Record<string, Divulgacao>;
  pedidos: Pedido[];
}

/** Limite por imagem no modo demonstração, que guarda tudo no navegador. */
const LIMITE_ANEXO_DEMO = 1_500_000;

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const banco: Banco = url && chave ? bancoSupabase(createClient(url, chave)) : bancoDemo();

type ContaSupabase = { id: string; email?: string };

function bancoSupabase(sb: SupabaseClient): Banco {
  // O perfil vem da tabela `perfis`; quem não tem linha lá entra como Produção (o menor acesso).
  async function paraUsuario(u: ContaSupabase): Promise<Usuario> {
    const email = u.email ?? "";
    const { data } = await sb.from("perfis").select("nome, papel").eq("id", u.id).maybeSingle();
    return { id: u.id, email, nome: data?.nome || email.split("@")[0], papel: data?.papel === "gestao" || data?.papel === "agencia" ? data.papel : "producao" };
  }

  // O armazenamento é privado: gera links temporários para mostrar as imagens.
  const assinar = (anexos: Anexo[]) =>
    Promise.all(
      anexos.map(async (a) => {
        if (!a.caminho) return a;
        const { data: u } = await sb.storage.from("materiais").createSignedUrl(a.caminho, 60 * 60);
        return { ...a, url: u?.signedUrl ?? "" };
      }),
    );

  return {
    demo: false,
    async usuarioAtual() {
      const { data } = await sb.auth.getUser();
      return data.user ? paraUsuario(data.user) : null;
    },
    async entrar(email, senha) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) throw new Error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
      return paraUsuario(data.user);
    },
    async sair() {
      await sb.auth.signOut();
    },
    aoMudarLogin(cb) {
      const { data } = sb.auth.onAuthStateChange((_ev, s) => {
        // Fora do callback: o Supabase não deixa consultar o banco dentro dele.
        setTimeout(async () => cb(s?.user ? await paraUsuario(s.user) : null), 0);
      });
      return () => data.subscription.unsubscribe();
    },
    async eventos(de, ate) {
      const { data, error } = await sb
        .from("eventos")
        .select("*, materiais(em_producao), financeiro(atracoes)")
        .gte("data", de)
        .lte("data", ate)
        .order("horario");
      if (error) throw error;
      type Um<T> = T | T[] | null;
      const primeiro = <T,>(x: Um<T>) => (Array.isArray(x) ? x[0] : x) ?? undefined;
      type Linha = Evento & { materiais: Um<{ em_producao: boolean }>; financeiro: Um<{ atracoes: Evento["atracoes"] }> };
      // `financeiro` só volta para a Gestão (regra no banco); para a Produção vem vazio.
      return (data as Linha[]).map(({ materiais, financeiro, ...e }) => ({
        ...e,
        atracoes: primeiro(financeiro)?.atracoes ?? e.atracoes,
        em_producao: Boolean(primeiro(materiais)?.em_producao),
      }));
    },
    async salvarEvento(e) {
      const { id, em_producao: _p, ...resto } = e as Evento;
      // Os nomes das atrações ficam no evento; cachês e observações vão para a tabela `financeiro`.
      const publico = semValores(resto as Evento);
      const linha = { ...resto, atracoes: publico.atracoes };
      const q = id ? sb.from("eventos").update(linha).eq("id", id) : sb.from("eventos").insert(linha);
      const { data, error } = await q.select().single();
      if (error) throw error;
      const salvo = data as Evento;
      const fin = await sb.from("financeiro").upsert({ evento_id: salvo.id, atracoes: e.atracoes });
      if (fin.error) throw fin.error;
      return { ...salvo, atracoes: e.atracoes };
    },
    async apagarEvento(id) {
      const { error } = await sb.from("eventos").delete().eq("id", id);
      if (error) throw error;
    },
    async datasEspeciais(de, ate) {
      const { data, error } = await sb.from("datas_especiais").select("*").gte("data", de).lte("data", ate);
      if (error) throw error;
      return (data as DataEspecial[]).map((d) => ({ ...d, editavel: true }));
    },
    async salvarDataEspecial(d) {
      const { id, editavel: _e, ...resto } = d;
      const q = id ? sb.from("datas_especiais").update(resto).eq("id", id) : sb.from("datas_especiais").insert(resto);
      const { data, error } = await q.select().single();
      if (error) throw error;
      return { ...(data as DataEspecial), editavel: true };
    },
    async apagarDataEspecial(id) {
      const { error } = await sb.from("datas_especiais").delete().eq("id", id);
      if (error) throw error;
    },
    async material(eventoId) {
      const { data, error } = await sb.from("materiais").select("*").eq("evento_id", eventoId).maybeSingle();
      if (error) throw error;
      const m = data ? normalizarMaterial(data) : materialVazio(eventoId);
      return { ...m, anexos: await assinar(m.anexos) };
    },
    async salvarMaterial(m) {
      const paraGravar = { ...m, anexos: m.anexos.map(({ nome, caminho, url }) => ({ nome, caminho, url: caminho ? "" : url })) };
      const { data, error } = await sb.from("materiais").upsert(paraGravar).select().single();
      if (error) throw error;
      return { ...normalizarMaterial(data), anexos: m.anexos };
    },
    async marcarProducao(eventoId, emProducao) {
      const { error } = await sb.rpc("marcar_producao", { p_evento: eventoId, p_valor: emProducao });
      if (error) throw error;
      return this.material(eventoId);
    },
    async divulgacao(eventoId) {
      const [{ data, error }, fin] = await Promise.all([
        sb.from("divulgacoes").select("*").eq("evento_id", eventoId).maybeSingle(),
        // Para a Produção a regra do banco devolve vazio.
        sb.from("financeiro").select("impulso_valor").eq("evento_id", eventoId).maybeSingle(),
      ]);
      if (error) throw error;
      const d = data ? normalizarDivulgacao(data) : divulgacaoVazia(eventoId);
      return { ...d, impulso_valor: fin.data?.impulso_valor ?? null };
    },
    async salvarDivulgacao(d) {
      const { impulso_valor, ...publico } = d;
      const { data, error } = await sb.from("divulgacoes").upsert(publico).select().single();
      if (error) throw error;
      // undefined = quem salvou não é da Gestão; o valor fica como estava.
      if (impulso_valor !== undefined) {
        const fin = await sb.from("financeiro").upsert({ evento_id: d.evento_id, impulso_valor: impulso_valor ?? null });
        if (fin.error) throw fin.error;
      }
      return { ...normalizarDivulgacao(data), impulso_valor };
    },
    async marcarFeito(eventoId, lista, itemId, feito) {
      const { error } = await sb.rpc("marcar_feito", { p_evento: eventoId, p_lista: lista, p_item: itemId, p_valor: feito });
      if (error) throw error;
      return this.divulgacao(eventoId);
    },
    async enviarAnexo(eventoId, arquivo) {
      const caminho = `${eventoId}/${Date.now()}-${arquivo.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await sb.storage.from("materiais").upload(caminho, arquivo);
      if (error) throw error;
      const { data } = await sb.storage.from("materiais").createSignedUrl(caminho, 60 * 60);
      return { nome: arquivo.name, caminho, url: data?.signedUrl ?? "" };
    },
    async removerAnexo(anexo) {
      if (!anexo.caminho) return;
      const { error } = await sb.storage.from("materiais").remove([anexo.caminho]);
      if (error) throw error;
    },
    async equipe() {
      const { data, error } = await sb.from("perfis").select("id, nome, funcao, papel").order("nome");
      if (error) throw error;
      return (data as Membro[]).map((m) => ({ ...m, nome: m.nome || "sem nome" }));
    },
    async salvarMembro(m) {
      const { data, error } = await sb.from("perfis").update({ nome: m.nome, funcao: m.funcao ?? null, papel: m.papel }).eq("id", m.id).select().single();
      if (error) throw error;
      return data as Membro;
    },
    async comentarios(eventoId) {
      const { data, error } = await sb.from("comentarios").select("*").eq("evento_id", eventoId).order("criado_em");
      if (error) throw error;
      return data as Comentario[];
    },
    async comentar(eventoId, texto) {
      const eu = await this.usuarioAtual();
      if (!eu) throw new Error("Faça login.");
      const { data, error } = await sb.from("comentarios").insert({ evento_id: eventoId, autor_id: eu.id, autor_nome: eu.nome, texto }).select().single();
      if (error) throw error;
      return data as Comentario;
    },
    async avisos() {
      const { data, error } = await sb.from("avisos").select("*").order("criado_em", { ascending: false }).limit(100);
      if (error) throw error;
      return data as Aviso[];
    },
    async avisar(lista) {
      if (lista.length === 0) return;
      const { data } = await sb.auth.getUser();
      const { error } = await sb.from("avisos").insert(lista.map((a) => ({ ...a, de_id: data.user?.id })));
      if (error) throw error;
    },
    async marcarLidos(ids) {
      if (ids.length === 0) return;
      const { error } = await sb.from("avisos").update({ lido: true }).in("id", ids);
      if (error) throw error;
    },
    async pedidos() {
      const { data, error } = await sb.from("pedidos_arte").select("*").order("criado_em", { ascending: false });
      if (error) throw error;
      return Promise.all((data as Record<string, unknown>[]).map(async (x) => {
        const p = normalizarPedido(x);
        return { ...p, anexos: await assinar(p.anexos) };
      }));
    },
    async salvarPedido(p) {
      const { id, ...resto } = p;
      const linha = { ...resto, anexos: p.anexos.map(({ nome, caminho, url }) => ({ nome, caminho, url: caminho ? "" : url })) };
      const q = id ? sb.from("pedidos_arte").update(linha).eq("id", id) : sb.from("pedidos_arte").insert(linha);
      const { data, error } = await q.select().single();
      if (error) throw error;
      return { ...normalizarPedido(data), anexos: p.anexos };
    },
    async apagarPedido(id) {
      const { error } = await sb.from("pedidos_arte").delete().eq("id", id);
      if (error) throw error;
    },
    async marcarProducaoPedido(id, emProducao) {
      const { error } = await sb.rpc("marcar_producao_pedido", { p_pedido: id, p_valor: emProducao });
      if (error) throw error;
      const { data, error: e2 } = await sb.from("pedidos_arte").select("*").eq("id", id).single();
      if (e2) throw e2;
      const p = normalizarPedido(data);
      return { ...p, anexos: await assinar(p.anexos) };
    },
    async painel(de, ate) {
      const { data, error } = await sb.from("eventos").select("*, materiais(*), divulgacoes(*)").gte("data", de).lte("data", ate);
      if (error) throw error;
      const primeiro = <T,>(x: T | T[] | null) => (Array.isArray(x) ? x[0] : x) ?? undefined;
      type Linha = Evento & { materiais: Record<string, unknown> | null; divulgacoes: Record<string, unknown> | null };
      const res: DadosPainel = { eventos: [], materiais: {}, divulgacoes: {}, pedidos: await this.pedidos() };
      for (const { materiais, divulgacoes, ...e } of data as Linha[]) {
        const m = primeiro(materiais);
        const d = primeiro(divulgacoes);
        if (m) res.materiais[e.id] = normalizarMaterial(m);
        if (d) res.divulgacoes[e.id] = normalizarDivulgacao(d);
        res.eventos.push({ ...e, em_producao: Boolean((m as { em_producao?: boolean } | undefined)?.em_producao) });
      }
      return res;
    },
  };
}

/** Modo demonstração: guarda só neste navegador. Serve para ver o app antes de criar o Supabase. */
function bancoDemo(): Banco {
  // v3: começa vazio, sem os eventos importados da planilha (a pedido do usuário, 23/10/2026).
  const CHAVE = "app-operacional-demo-v3";
  try {
    localStorage.removeItem("app-operacional-demo-v2");
  } catch {
    /* sem armazenamento */
  }
  type Estado = {
    usuario: Usuario | null;
    eventos: Evento[];
    datas: DataEspecial[];
    materiais?: Record<string, Material>;
    divulgacoes?: Record<string, Divulgacao>;
    equipe?: Membro[];
    comentarios?: Comentario[];
    avisos?: Aviso[];
    pedidos?: Pedido[];
  };
  const ler = (): Estado => {
    try {
      const s = localStorage.getItem(CHAVE);
      if (s) return JSON.parse(s);
    } catch {
      /* navegador sem armazenamento: segue com o exemplo */
    }
    return { usuario: null, eventos: [], datas: [] };
  };
  let estado = ler();
  if (!estado.equipe?.length) estado.equipe = EQUIPE_EXEMPLO;
  // Quem entrou antes da equipe existir vira o membro equivalente ao perfil que tinha.
  if (estado.usuario && !estado.equipe.some((m) => m.id === estado.usuario!.id)) {
    const m = estado.equipe.find((x) => x.papel === (estado.usuario!.papel ?? "gestao")) ?? estado.equipe[0];
    estado.usuario = { ...estado.usuario, id: m.id, nome: m.nome, papel: m.papel };
  }
  const ouvintes = new Set<(u: Usuario | null) => void>();
  const gravar = () => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch {
      /* ignora */
    }
  };
  const novoId = () => Math.random().toString(36).slice(2, 10);

  return {
    demo: true,
    async usuarioAtual() {
      return estado.usuario;
    },
    async entrar(email, _senha, membroId) {
      const m = estado.equipe!.find((x) => x.id === membroId) ?? estado.equipe![0];
      estado.usuario = { id: m.id, email: email || `${m.id}@demo`, nome: m.nome, papel: m.papel };
      gravar();
      ouvintes.forEach((cb) => cb(estado.usuario));
      return estado.usuario;
    },
    async sair() {
      estado.usuario = null;
      gravar();
      ouvintes.forEach((cb) => cb(null));
    },
    aoMudarLogin(cb) {
      ouvintes.add(cb);
      return () => ouvintes.delete(cb);
    },
    async eventos(de, ate) {
      return estado.eventos
        .filter((e) => e.data >= de && e.data <= ate)
        .map((e) => (estado.usuario?.papel === "gestao" ? e : semValores(e)))
        .map((e) => ({ ...e, em_producao: Boolean(estado.materiais?.[e.id]?.em_producao) }));
    },
    async salvarEvento(e) {
      const { em_producao: _p, ...limpo } = e as Evento;
      const ev: Evento = { ...limpo, id: e.id ?? novoId(), criado_por: e.criado_por ?? estado.usuario?.nome, atualizado_em: new Date().toISOString() };
      estado.eventos = [...estado.eventos.filter((x) => x.id !== ev.id), ev];
      gravar();
      return ev;
    },
    async apagarEvento(id) {
      estado.eventos = estado.eventos.filter((x) => x.id !== id);
      if (estado.materiais) delete estado.materiais[id];
      if (estado.divulgacoes) delete estado.divulgacoes[id];
      gravar();
    },
    async datasEspeciais(de, ate) {
      return estado.datas.filter((d) => d.data >= de && d.data <= ate);
    },
    async salvarDataEspecial(d) {
      const nova = { ...d, id: d.id ?? novoId(), editavel: true };
      estado.datas = [...estado.datas.filter((x) => x.id !== nova.id), nova];
      gravar();
      return nova;
    },
    async apagarDataEspecial(id) {
      estado.datas = estado.datas.filter((x) => x.id !== id);
      gravar();
    },
    async material(eventoId) {
      const m = estado.materiais?.[eventoId];
      return m ? normalizarMaterial(m as unknown as Record<string, unknown>) : materialVazio(eventoId);
    },
    async salvarMaterial(m) {
      estado.materiais = { ...estado.materiais, [m.evento_id]: m };
      gravar();
      return m;
    },
    async marcarProducao(eventoId, emProducao) {
      const atual = await this.material(eventoId);
      const quem = estado.usuario?.nome;
      const m: Material = emProducao
        ? { ...atual, em_producao: true, em_producao_por: quem, em_producao_em: new Date().toISOString() }
        : { ...atual, em_producao: false, em_producao_por: undefined, em_producao_em: undefined };
      return this.salvarMaterial(m);
    },
    async divulgacao(eventoId) {
      const d = estado.divulgacoes?.[eventoId];
      const base = d ? normalizarDivulgacao(d as unknown as Record<string, unknown>) : divulgacaoVazia(eventoId);
      return estado.usuario?.papel === "gestao" ? base : { ...base, impulso_valor: null };
    },
    async salvarDivulgacao(d) {
      if (d.impulso_valor === undefined) d = { ...d, impulso_valor: estado.divulgacoes?.[d.evento_id]?.impulso_valor };
      estado.divulgacoes = { ...estado.divulgacoes, [d.evento_id]: d };
      gravar();
      return d;
    },
    async marcarFeito(eventoId, lista, itemId, feito) {
      const d = estado.divulgacoes?.[eventoId] ?? divulgacaoVazia(eventoId);
      const nova = { ...d, [lista]: (d[lista] as { id: string }[]).map((x) => (x.id === itemId ? { ...x, feito } : x)) };
      await this.salvarDivulgacao(nova);
      return this.divulgacao(eventoId);
    },
    async enviarAnexo(_eventoId, arquivo) {
      if (arquivo.size > LIMITE_ANEXO_DEMO) {
        throw new Error("No modo demonstração cada imagem pode ter até 1,5 MB. Com o Supabase ligado esse limite some.");
      }
      const url = await new Promise<string>((ok, falha) => {
        const leitor = new FileReader();
        leitor.onload = () => ok(String(leitor.result));
        leitor.onerror = () => falha(new Error("Não foi possível ler a imagem."));
        leitor.readAsDataURL(arquivo);
      });
      return { nome: arquivo.name, url };
    },
    async removerAnexo() {
      /* no modo demonstração a imagem some junto com o material */
    },
    async equipe() {
      return estado.equipe!;
    },
    async salvarMembro(m) {
      const novo = { ...m, id: m.id || novoId() };
      estado.equipe = estado.equipe!.some((x) => x.id === novo.id)
        ? estado.equipe!.map((x) => (x.id === novo.id ? novo : x))
        : [...estado.equipe!, novo];
      if (estado.usuario?.id === novo.id) {
        estado.usuario = { ...estado.usuario, nome: novo.nome, papel: novo.papel };
        ouvintes.forEach((cb) => cb(estado.usuario));
      }
      gravar();
      return novo;
    },
    async comentarios(eventoId) {
      return (estado.comentarios ?? []).filter((c) => c.evento_id === eventoId);
    },
    async comentar(eventoId, texto) {
      const eu = estado.usuario!;
      const c: Comentario = { id: novoId(), evento_id: eventoId, autor_id: eu.id, autor_nome: eu.nome, texto, criado_em: new Date().toISOString() };
      estado.comentarios = [...(estado.comentarios ?? []), c];
      gravar();
      return c;
    },
    async avisos() {
      return (estado.avisos ?? []).filter((a) => a.para_id === estado.usuario?.id).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
    },
    async avisar(lista) {
      const agora = new Date().toISOString();
      estado.avisos = [...(estado.avisos ?? []), ...lista.map((a) => ({ ...a, id: novoId(), criado_em: agora, lido: false }))];
      gravar();
    },
    async marcarLidos(ids) {
      estado.avisos = (estado.avisos ?? []).map((a) => (ids.includes(a.id) ? { ...a, lido: true } : a));
      gravar();
    },
    async pedidos() {
      return (estado.pedidos ?? []).map((p) => normalizarPedido(p as unknown as Record<string, unknown>));
    },
    async salvarPedido(p) {
      const novo = { ...p, id: p.id || novoId(), criado_em: p.criado_em ?? new Date().toISOString(), criado_por: p.criado_por ?? estado.usuario?.nome, criado_por_id: p.criado_por_id ?? estado.usuario?.id };
      estado.pedidos = [novo, ...(estado.pedidos ?? []).filter((x) => x.id !== novo.id)];
      gravar();
      return novo;
    },
    async apagarPedido(id) {
      estado.pedidos = (estado.pedidos ?? []).filter((x) => x.id !== id);
      gravar();
    },
    async marcarProducaoPedido(id, emProducao) {
      const p = (estado.pedidos ?? []).find((x) => x.id === id);
      if (!p) throw new Error("Salve o pedido antes de marcar.");
      const novo: Pedido = {
        ...p,
        em_producao: emProducao,
        em_producao_por: emProducao ? estado.usuario?.nome : undefined,
        em_producao_em: emProducao ? new Date().toISOString() : undefined,
      };
      estado.pedidos = (estado.pedidos ?? []).map((x) => (x.id === id ? novo : x));
      gravar();
      return novo;
    },
    async painel(de, ate) {
      const eventos = await this.eventos(de, ate);
      const res: DadosPainel = { eventos, materiais: {}, divulgacoes: {}, pedidos: await this.pedidos() };
      for (const e of eventos) {
        const m = estado.materiais?.[e.id];
        const d = estado.divulgacoes?.[e.id];
        if (m) res.materiais[e.id] = normalizarMaterial(m as unknown as Record<string, unknown>);
        if (d) res.divulgacoes[e.id] = normalizarDivulgacao(d as unknown as Record<string, unknown>);
      }
      return res;
    },
  };
}
