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
  const base = 20;
  const alpha = 0.2;
  const beta = 0.1;

  const cvu = base + alpha * qualidade - beta * eficiencia;
  return Math.max(0, parseFloat(cvu.toFixed(2)));
}

export function calcularRodada(d: {
  preco: number;
  qualidade: number;
  marketingBonus: number;
  equipeBonus: number;
  beneficioBonus: number;
  capacidade: number;
  publicoAlvo: string;
  caixaAcumulado: number;
  precoMedioMercado?: number;
  marketSize?: number;
  eaDosOutrosTimes?: number[];
}): ResultadoRodada {
  const {
    preco,
    qualidade,
    marketingBonus,
    equipeBonus,
    beneficioBonus,
    capacidade,
    publicoAlvo,
    caixaAcumulado,
    precoMedioMercado = 100,
    marketSize = 10000,
    eaDosOutrosTimes = [],
  } = d;

  const qualidadeMultiplicador: Record<string, number> = {
    "Jovens (15–24 anos)": 0.8,
    "Adultos (25–40 anos)": 1.0,
    "Sêniores (40+)": 1.2,
    "Classe A/B": 1.25,
    "Classe C/D": 0.8,
  };

  const marketingMultiplicador: Record<string, number> = {
    "Jovens (15–24 anos)": 1.3,
    "Adultos (25–40 anos)": 1.0,
    "Sêniores (40+)": 1.2,
    "Classe A/B": 1.1,
    "Classe C/D": 1.15,
  };

  const equipeMultiplicador: Record<string, number> = {
    "Jovens (15–24 anos)": 0.9,
    "Adultos (25–40 anos)": 1.0,
    "Sêniores (40+)": 1.3,
    "Classe A/B": 1.1,
    "Classe C/D": 0.9,
  };

  const elasticidadePreco: Record<string, number> = {
    "Jovens (15–24 anos)": 1.2,
    "Adultos (25–40 anos)": 1.0,
    "Sêniores (40+)": 0.8,
    "Classe A/B": 0.9,
    "Classe C/D": 1.5,
  };

  const beneficioBonusExtra: Record<string, number> = {
    "Cupom|Classe C/D": 5,
    "Brinde|Jovens (15–24 anos)": 5,
    "Frete grátis|Adultos (25–40 anos)": 5,
    "Frete grátis|Sêniores (40+)": 5,
  };

  const modificadorEA = 1.0;
  const epsilon = elasticidadePreco[publicoAlvo] ?? 1.0;

  const precoValido = preco > 0 ? preco : 100;
  const qualidadeValida = qualidade ?? 0;
  const marketingValido = marketingBonus ?? 0;
  const equipeValida = equipeBonus ?? 0;

  const beneficioTipo =
    beneficioBonus === 10 ? "Cupom" :
    beneficioBonus === 15 ? "Brinde" :
    beneficioBonus === 20 ? "Frete grátis" : "Nenhum";

  const publicoValido = publicoAlvo.trim();
  const chaveBeneficio = `${beneficioTipo}|${publicoValido}`;
  const bonusExtra = beneficioBonusExtra[chaveBeneficio] ?? 0;
  const beneficioValido = beneficioBonus + bonusExtra;

  const eaBase =
    (100 - precoValido) +
    qualidadeValida * (qualidadeMultiplicador[publicoValido] ?? 1) +
    marketingValido * (marketingMultiplicador[publicoValido] ?? 1) +
    equipeValida * (equipeMultiplicador[publicoValido] ?? 1) +
    beneficioValido;

  let eaAjustado = eaBase * modificadorEA;

  const todosEA = [...eaDosOutrosTimes, eaAjustado];
  const somaExp = todosEA.reduce((acc, ea) => acc + Math.exp(ea || 0), 0);
  const share = somaExp > 0 ? Math.exp(eaAjustado) / somaExp : 0;

  const fatorPreco = Math.pow(precoMedioMercado / precoValido, epsilon);
  const demandaBruta = marketSize * share * fatorPreco;

  const vendas = Math.min(demandaBruta, capacidade);
  const houveBacklog = demandaBruta > capacidade;

  if (houveBacklog) {
    if (["Jovens (15–24 anos)", "Classe C/D"].includes(publicoValido)) {
      eaAjustado -= 15;
    } else if (["Sêniores (40+)", "Classe A/B"].includes(publicoValido)) {
      eaAjustado -= 5;
    }
  }

  const receita = vendas * precoValido;
  const eficiencia = capacidade / 100;
  const cvu = calcularCVU(qualidadeValida, eficiencia);
  const custoVariavel = vendas * cvu;

  const custoMarketing = marketingValido * 1000;
  const custoEquipe = equipeValida * 1000;
  const custoBeneficio = beneficioValido * 1000;

  const custoTotal = custoVariavel + custoMarketing + custoEquipe + custoBeneficio;

  const lucroBruto = receita - custoTotal;
  const reinvestimento = Math.max(0, lucroBruto) * 0.2;
  const caixaFinal = caixaAcumulado + Math.max(0, lucroBruto) * 0.8;

  return {
    ea: parseFloat(eaAjustado.toFixed(2)),
    demanda: Math.round(demandaBruta),
    receita: parseFloat(receita.toFixed(2)),
    custo: parseFloat(custoTotal.toFixed(2)),
    lucro: parseFloat(lucroBruto.toFixed(2)),
    reinvestimento: parseFloat(reinvestimento.toFixed(2)),
    caixaFinal: parseFloat(caixaFinal.toFixed(2)),
    cvu: parseFloat(cvu.toFixed(2)),
    backlog: houveBacklog,
    satisfacao: Math.min(100, eaAjustado / 2),
    evento: undefined,
    share: parseFloat((share * 100).toFixed(2)),
  };
}
