export interface ResultadoRodada {
  ea: number;
  demanda: number;
  receita: number;
  custo: number;
  lucro: number;
  reinvestimento: number;
  caixaFinal: number;
  cvu: number;
  backlog: boolean;
  satisfacao: number;
  evento?: string;
  share?: number;
}

export function calcularCVU(qualidade: number, eficiencia: number): number {
  const base = 50;
  const alpha = 2;
  const beta = 1.5;

  const cvu = base + alpha * qualidade - beta * eficiencia;
  return Math.max(0, parseFloat(cvu.toFixed(2)));
}

export function calcularRodada(d: {
  preco: number;
  produto: number;
  marketing: number;
  capacidade: number;
  equipe: number;
  beneficio: number;
  publicoAlvo?: string;
  caixaAcumulado: number;
  atraso?: boolean;
  penalidadeBacklog?: boolean;
  eaDosOutrosTimes?: number[];
}): ResultadoRodada {
  const {
    preco,
    produto,
    marketing,
    capacidade,
    equipe,
    beneficio,
    publicoAlvo = "classe-cd",
    caixaAcumulado,
    atraso = false,
    penalidadeBacklog = false,
    eaDosOutrosTimes = [],
  } = d;

  // ✅ Proteção contra dados inválidos
  if (
    isNaN(preco) ||
    isNaN(produto) ||
    isNaN(marketing) ||
    isNaN(capacidade) ||
    isNaN(equipe) ||
    isNaN(beneficio) ||
    isNaN(caixaAcumulado)
  ) {
    return {
      ea: 0,
      demanda: 0,
      receita: 0,
      custo: 0,
      lucro: 0,
      reinvestimento: 0,
      caixaFinal: caixaAcumulado,
      cvu: 0,
      backlog: false,
      satisfacao: 0,
      evento: undefined,
      share: 0,
    };
  }

  // ✅ Cálculo do EA base
  let ea = produto * 0.2 + equipe * 0.3 + beneficio * 0.5;

  if (penalidadeBacklog) {
    if (publicoAlvo === "jovens" || publicoAlvo === "classe-cd") ea -= 15;
    if (publicoAlvo === "seniores" || publicoAlvo === "classe-ab") ea -= 5;
  }

  if (publicoAlvo === "jovens") ea *= 1.1;
  if (publicoAlvo === "classe-cd") ea *= 1.05;
  if (publicoAlvo === "seniores") ea *= 0.95;

  // ✅ Cálculo de participação de mercado
  const todosEAs = [...eaDosOutrosTimes, ea];
  const expEAs = todosEAs.map(v => Math.exp(v));
  const somaExp = expEAs.reduce((acc, val) => acc + val, 0);
  const share = Math.exp(ea) / somaExp;

  const demandaTotal = 1000;
  const demanda = demandaTotal * share;

  const qualidade = produto / 10;
  const eficiencia = capacidade / 10;

  const cvu = calcularCVU(qualidade, eficiencia);
  const custoVariavel = demanda * cvu;

  const receita = demanda * preco;

  const custoFixo =
    capacidade * 0.3 +
    equipe * 0.2 +
    beneficio * 0.2 +
    marketing * 0.3;

  const custo = custoVariavel + custoFixo;

  let lucro = receita - custo;
  if (atraso) lucro *= 0.7;

  const reinvestimento = lucro * 0.2;
  const caixaFinal = caixaAcumulado + lucro - reinvestimento;

  const houveBacklog = demanda > capacidade;

  return {
    ea: Math.round(ea),
    demanda: Math.round(demanda),
    receita: parseFloat(receita.toFixed(2)),
    custo: parseFloat(custo.toFixed(2)),
    lucro: parseFloat(lucro.toFixed(2)),
    reinvestimento: parseFloat(reinvestimento.toFixed(2)),
    caixaFinal: parseFloat(caixaFinal.toFixed(2)),
    cvu: parseFloat(cvu.toFixed(2)),
    backlog: houveBacklog,
    satisfacao: Math.min(100, ea / 100),
    evento: undefined,
    share: parseFloat((share * 100).toFixed(2)),
  };
}
