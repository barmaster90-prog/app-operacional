import { iso, somarDias, type DataISO } from "./datas.ts";

export type TipoData = "feriado" | "ponto_facultativo" | "comercial" | "local";

export interface DataEspecial {
  data: DataISO;
  nome: string;
  tipo: TipoData;
  /** true quando foi cadastrada pela equipe (pode editar/apagar). */
  editavel?: boolean;
  id?: string;
  /** Lembrar de pedir arte para esta data, com quantos dias de antecedência. */
  precisa_arte?: boolean;
  avisar_dias?: number;
}

/** Domingo de Páscoa (algoritmo gregoriano de Meeus/Jones/Butcher). */
export function pascoa(ano: number): DataISO {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(ano, mes, dia);
}

/**
 * Feriados nacionais (Lei 662/1949, Lei 6.802/1980, Lei 10.607/2002 e Lei 14.759/2023),
 * Sexta-feira Santa e os pontos facultativos móveis mais usados (Carnaval e Corpus Christi).
 * Funciona para qualquer ano. Feriados estaduais e municipais entram como datas cadastradas.
 */
export function feriadosNacionais(ano: number): DataEspecial[] {
  const p = pascoa(ano);
  const lista: DataEspecial[] = [
    { data: iso(ano, 1, 1), nome: "Confraternização Universal", tipo: "feriado" },
    { data: somarDias(p, -48), nome: "Carnaval", tipo: "ponto_facultativo" },
    { data: somarDias(p, -47), nome: "Carnaval", tipo: "ponto_facultativo" },
    { data: somarDias(p, -46), nome: "Quarta-feira de Cinzas", tipo: "ponto_facultativo" },
    { data: somarDias(p, -2), nome: "Sexta-feira Santa", tipo: "feriado" },
    { data: p, nome: "Páscoa", tipo: "comercial" },
    { data: iso(ano, 4, 21), nome: "Tiradentes", tipo: "feriado" },
    { data: iso(ano, 5, 1), nome: "Dia do Trabalho", tipo: "feriado" },
    { data: somarDias(p, 60), nome: "Corpus Christi", tipo: "ponto_facultativo" },
    { data: iso(ano, 9, 7), nome: "Independência do Brasil", tipo: "feriado" },
    { data: iso(ano, 10, 12), nome: "Nossa Senhora Aparecida", tipo: "feriado" },
    { data: iso(ano, 11, 2), nome: "Finados", tipo: "feriado" },
    { data: iso(ano, 11, 15), nome: "Proclamação da República", tipo: "feriado" },
    { data: iso(ano, 12, 25), nome: "Natal", tipo: "feriado" },
  ];
  if (ano >= 2024) {
    lista.push({ data: iso(ano, 11, 20), nome: "Dia da Consciência Negra", tipo: "feriado" });
  }
  return lista.sort((x, y) => x.data.localeCompare(y.data));
}

/** Datas fixas de Blumenau que já foram confirmadas. As demais a equipe cadastra no app. */
export function datasBlumenau(ano: number): DataEspecial[] {
  return [{ data: iso(ano, 9, 2), nome: "Aniversário de Blumenau", tipo: "feriado" }];
}

export function datasFixasDoAno(ano: number): DataEspecial[] {
  return [...feriadosNacionais(ano), ...datasBlumenau(ano)];
}
