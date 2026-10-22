// Datas são tratadas sempre como texto "AAAA-MM-DD" para não depender do fuso do aparelho.

export type DataISO = string;

export function iso(ano: number, mes: number, dia: number): DataISO {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function partes(data: DataISO): [number, number, number] {
  const [a, m, d] = data.split("-").map(Number);
  return [a, m, d];
}

export function somarDias(data: DataISO, dias: number): DataISO {
  const [a, m, d] = partes(data);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 0 = domingo ... 6 = sábado */
export function diaDaSemana(data: DataISO): number {
  const [a, m, d] = partes(data);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function hojeISO(): DataISO {
  const h = new Date();
  return iso(h.getFullYear(), h.getMonth() + 1, h.getDate());
}

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export function dataPorExtenso(data: DataISO): string {
  const [a, m, d] = partes(data);
  return `${DIAS_SEMANA[diaDaSemana(data)]}, ${d} de ${MESES[m - 1].toLowerCase()} de ${a}`;
}

/** Grade de 6 semanas (42 dias) começando no domingo, com o mês pedido no meio. */
export function gradeDoMes(ano: number, mes: number): DataISO[] {
  const primeiro = iso(ano, mes, 1);
  const inicio = somarDias(primeiro, -diaDaSemana(primeiro));
  return Array.from({ length: 42 }, (_, i) => somarDias(inicio, i));
}
