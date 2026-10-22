import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Evento, EventoNovo } from "./tipos.ts";
import type { DataEspecial } from "./feriados.ts";
import type { DataISO } from "./datas.ts";
import { EVENTOS_EXEMPLO } from "./exemplo.ts";

export interface Usuario {
  id: string;
  email: string;
  nome: string;
}

/** Tudo que o app precisa guardar. Duas implementações: Supabase (real) e demonstração (navegador). */
export interface Banco {
  demo: boolean;
  usuarioAtual(): Promise<Usuario | null>;
  entrar(email: string, senha: string): Promise<Usuario>;
  sair(): Promise<void>;
  aoMudarLogin(cb: (u: Usuario | null) => void): () => void;
  eventos(de: DataISO, ate: DataISO): Promise<Evento[]>;
  salvarEvento(e: EventoNovo & { id?: string }): Promise<Evento>;
  apagarEvento(id: string): Promise<void>;
  datasEspeciais(de: DataISO, ate: DataISO): Promise<DataEspecial[]>;
  salvarDataEspecial(d: DataEspecial): Promise<DataEspecial>;
  apagarDataEspecial(id: string): Promise<void>;
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const banco: Banco = url && chave ? bancoSupabase(createClient(url, chave)) : bancoDemo();

function paraUsuario(u: { id: string; email?: string; user_metadata?: Record<string, unknown> }): Usuario {
  const email = u.email ?? "";
  return { id: u.id, email, nome: (u.user_metadata?.nome as string) || email.split("@")[0] };
}

function bancoSupabase(sb: SupabaseClient): Banco {
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
      const { data } = sb.auth.onAuthStateChange((_ev, s) => cb(s?.user ? paraUsuario(s.user) : null));
      return () => data.subscription.unsubscribe();
    },
    async eventos(de, ate) {
      const { data, error } = await sb.from("eventos").select("*").gte("data", de).lte("data", ate).order("horario");
      if (error) throw error;
      return data as Evento[];
    },
    async salvarEvento(e) {
      const { id, ...resto } = e;
      const q = id ? sb.from("eventos").update(resto).eq("id", id) : sb.from("eventos").insert(resto);
      const { data, error } = await q.select().single();
      if (error) throw error;
      return data as Evento;
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
  };
}

/** Modo demonstração: guarda só neste navegador. Serve para ver o app antes de criar o Supabase. */
function bancoDemo(): Banco {
  const CHAVE = "app-operacional-demo-v1";
  type Estado = { usuario: Usuario | null; eventos: Evento[]; datas: DataEspecial[] };
  const ler = (): Estado => {
    try {
      const s = localStorage.getItem(CHAVE);
      if (s) return JSON.parse(s);
    } catch {
      /* navegador sem armazenamento: segue com o exemplo */
    }
    return { usuario: null, eventos: EVENTOS_EXEMPLO, datas: [] };
  };
  let estado = ler();
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
    async entrar(email) {
      if (!email.includes("@")) throw new Error("Digite um e-mail válido.");
      estado.usuario = { id: "demo", email, nome: email.split("@")[0] };
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
      return estado.eventos.filter((e) => e.data >= de && e.data <= ate);
    },
    async salvarEvento(e) {
      const ev: Evento = { ...e, id: e.id ?? novoId(), criado_por: e.criado_por ?? estado.usuario?.nome, atualizado_em: new Date().toISOString() };
      estado.eventos = [...estado.eventos.filter((x) => x.id !== ev.id), ev];
      gravar();
      return ev;
    },
    async apagarEvento(id) {
      estado.eventos = estado.eventos.filter((x) => x.id !== id);
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
  };
}
