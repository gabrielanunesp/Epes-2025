import React, { useMemo, useState } from "react";

const palette = {
  bg1: "#0e2a47",
  bg2: "#0a1e31",
  bg3: "#121212",
  text: "#eaf2f8",
  textMuted: "#cbe3ff",
  badge: "#9fd3ff",
  glassBg: "rgba(255,255,255,0.06)",
  glassBorder: "rgba(255,255,255,0.12)",
};

const base = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0e2a47 0%, #0a1e31 45%, #121212 100%)",
    color: palette.text,
  } as React.CSSProperties,
  container: {
    maxWidth: 980,
    margin: "0 auto",
    padding: "24px 16px 56px",
  } as React.CSSProperties,
  header: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    background: "rgba(10, 30, 49, 0.7)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    borderBottom: `1px solid ${palette.glassBorder}`,
  } as React.CSSProperties,
  headerInner: {
    maxWidth: 980,
    margin: "0 auto",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  } as React.CSSProperties,
  h1: { margin: 0, fontSize: 22, fontWeight: 800 } as React.CSSProperties,
  sub: { margin: 0, opacity: 0.8, fontSize: 12 } as React.CSSProperties,
  tabsRow: { display: "flex", flexWrap: "wrap", gap: 8 } as React.CSSProperties,
  tabBtn: {
    appearance: "none",
    border: `1px solid ${palette.glassBorder}`,
    background: "rgba(255,255,255,0.06)",
    color: palette.text,
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all .2s ease",
  } as React.CSSProperties,
  tabBtnActive: {
    background: "rgba(159,211,255,0.18)",
    color: palette.text,
    border: "1px solid rgba(159,211,255,0.45)",
  } as React.CSSProperties,
  card: {
    background: palette.glassBg,
    border: `1px solid ${palette.glassBorder}`,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    borderRadius: 16,
    padding: 16,
  } as React.CSSProperties,
  sectionTitle: { margin: "0 0 6px", fontSize: 18, fontWeight: 800 } as React.CSSProperties,
  sectionLead: { margin: 0, color: palette.textMuted, fontSize: 13, lineHeight: 1.6 } as React.CSSProperties,
  accItem: {
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${palette.glassBorder}`,
    borderRadius: 12,
    marginTop: 10,
    overflow: "hidden",
  } as React.CSSProperties,
  accHeader: {
    width: "100%",
    textAlign: "left",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    cursor: "pointer",
    fontWeight: 700,
  } as React.CSSProperties,
  accContent: { padding: "0 14px 14px", color: palette.textMuted, lineHeight: 1.65 } as React.CSSProperties,
};

type QAItem = { q: string; a: string };
type Sections = "geral" | "jogo" | "metricas" | "estrategia";

const qaData: Record<Sections, QAItem[]> = {
  geral: [
    { q: "O que é o Simulador EPES Challenge 2025?", a: "É um jogo de simulação de negócios onde equipes de alunos competem gerenciando uma startup. O objetivo é tomar decisões estratégicas a cada rodada para maximizar o desempenho da empresa em um mercado competitivo." },
    { q: "Qual é o principal objetivo do simulador?", a: "O objetivo principal é alcançar o maior **lucro acumulado** ao final de todas as rodadas. O ranking será baseado na soma dos lucros obtidos em cada rodada, refletindo a performance financeira da empresa ao longo da competição." },
    { q: "O que é uma 'rodada'?", a: "Uma rodada representa um período de tempo no jogo (geralmente um dia) durante o qual as equipes devem analisar o cenário e submeter um conjunto de decisões estratégicas para sua empresa." },
    { q: "Quem compete contra quem?", a: "Todas as equipes (times) competem no mesmo mercado. Isso significa que a decisão de uma equipe afeta o desempenho de todas as outras, pois disputam os mesmos clientes." },
    { q: "Qual o papel do 'Responsável' ou 'ADM'?", a: "O Responsável é o administrador do jogo. Ele tem o poder de iniciar e encerrar as rodadas, aprovar a entrada de membros nos times, resetar o simulador e gerenciar os parâmetros gerais da competição." },
    { q: "O que é um 'time'?", a: "Um time é a representação da sua startup no jogo. É composto por um grupo de alunos (membros) liderados por um capitão. Cada time recebe um código único que o identifica." },
    { q: "Qual a diferença entre 'Capitão' e 'Membro'?", a: "O **Capitão** é o líder da equipe. Ele é o único que pode definir a identidade inicial da empresa e, mais importante, submeter as decisões finais da equipe a cada rodada. O **Membro** participa das discussões e pode visualizar todas as informações, mas não pode enviar as decisões." },
    { q: "Como um aluno pode criar um novo time?", a: 'Na tela de "Escolher Time", o aluno deve selecionar a opção "Criar", preencher seus dados (nome, e-mail, senha) e o nome do time. Um código único será gerado automaticamente para a equipe. O aluno que cria o time se torna o Capitão.' },
    { q: "Como um aluno pode ingressar em um time já existente?", a: 'Na tela de "Escolher Time", o aluno deve selecionar a opção "Ingressar", preencher seus dados e inserir o "Código da Turma" (que é o mesmo código do time) fornecido pelo Capitão. Após o envio, o Responsável (ADM) precisa aprovar a solicitação.' },
    { q: "O que é a 'Identidade da Empresa' (Etapa D0)?", a: "É o primeiro passo após a criação do time. O Capitão deve definir o nome da empresa, o público-alvo, um slogan e uma cor de marca. Essa identidade é fundamental e não pode ser alterada posteriormente." },
    { q: "É possível alterar o Público-Alvo depois de definido?", a: "Não. A escolha do público-alvo na etapa de 'Identidade da Empresa' é permanente e influenciará todas as rodadas do jogo, afetando a eficácia das suas estratégias de marketing, produto e preço." },
  ],
  jogo: [
    { q: "Como uma rodada começa e termina?", a: 'Uma rodada é iniciada manualmente pelo Responsável (ADM) através do "Painel do Responsável". Ela geralmente termina automaticamente no final do dia (às 23:59). Após o término, os resultados são processados e ficam disponíveis.' },
    { q: "O que acontece se uma equipe não enviar suas decisões a tempo?", a: "Se uma equipe não enviar as decisões para a rodada atual, o sistema automaticamente utilizará as **mesmas decisões da rodada anterior**. Caso seja a primeira rodada e não haja envio, serão consideradas decisões mínimas (zeradas), resultando em baixo desempenho." },
    { q: 'O que significa "Rodada Ativa" e "Rodada Fechada"?', a: '**Rodada Ativa** significa que o período para tomar decisões está aberto, e o cronômetro está correndo. **Rodada Fechada** significa que o prazo terminou, as decisões foram processadas e os resultados já estão (ou estarão em breve) disponíveis.' },
    { q: "Onde posso ver o tempo restante para o fim da rodada?", a: 'Na página de "Decisões", um cronômetro exibe o tempo restante até o encerramento automático da rodada (23:59 do dia).' },
    { q: "Quais são as principais áreas de decisão em cada rodada?", a: "As áreas são: Preço, Produto & P&D (Qualidade), Marketing & Branding, Capacidade Operacional, Equipe & Treinamento, Proteção de Marca e Benefício de Lançamento." },
    { q: 'Como o "Preço" afeta o jogo?', a: "O preço tem um impacto direto na atratividade do seu produto (EA) e na demanda. Preços muito acima da média do mercado podem reduzir a demanda, enquanto preços mais baixos podem atraí-la, mas também diminuir a margem de lucro. A sensibilidade ao preço (elasticidade) varia conforme o público-alvo." },
    { q: 'O que significa investir em "Produto & P&D"?', a: 'Significa investir na **Qualidade** do seu produto. Níveis mais altos (Básico, Intermediário, Avançado, Premium) aumentam a qualidade percebida pelo cliente, o que eleva o "Efeito de Atratividade" (EA), especialmente para públicos que valorizam mais a qualidade, como "Classe A/B" e "Sêniores".' },
    { q: 'O que é "Capacidade Operacional"?', a: "É a quantidade máxima de produtos que sua empresa consegue produzir e vender em uma rodada. Se a sua demanda for maior que a sua capacidade, você perderá vendas e sofrerá uma penalidade." },
    { q: 'Qual o impacto do investimento em "Marketing & Branding"?', a: 'Aumenta a visibilidade e o apelo da sua marca. Investir em níveis mais altos (Local, Regional, Nacional) gera um bônus de marketing que impulsiona diretamente o seu "Efeito de Atratividade" (EA).' },
    { q: 'Para que serve investir em "Equipe & Treinamento"?', a: "Melhora a eficiência e a qualidade do serviço. Um investimento maior em equipe (Enxuto, Balanceado, Reforçado) gera um bônus que aumenta o EA e também melhora a eficiência da produção, reduzindo o Custo Variável Unitário (CVU)." },
    { q: 'O que são os "Benefícios de Lançamento"?', a: "São ofertas especiais para atrair clientes, como 'Cupom', 'Brinde' ou 'Frete Grátis'. Cada benefício tem um custo e um impacto diferente no EA, podendo ser mais ou menos eficaz dependendo do seu público-alvo." },
    { q: "O que acontece se o total de investimentos ultrapassar o orçamento da rodada?", a: 'O sistema não permitirá que o Capitão salve as decisões. É necessário ajustar os investimentos para que o "Caixa restante" seja zero ou positivo.' },
    { q: "O que acontece com o orçamento de investimentos que não é gasto?", a: "O orçamento de investimentos é um limite de gastos para a rodada. **O valor que não for utilizado não é somado ao lucro nem ao caixa**. O lucro da empresa vem exclusivamente da sua operação (Receita - Custos). Portanto, é estratégico utilizar bem o orçamento disponível para maximizar o retorno sobre o investimento." },
  ],
  metricas: [
    { q: 'O que é o "Efeito de Atratividade" (EA)?', a: "É a principal métrica que mede o quão atrativa é a sua oferta para o mercado. É uma pontuação calculada com base em todas as suas decisões: preço, qualidade, marketing, equipe e benefícios. Um EA mais alto resulta em uma maior fatia de mercado (Share)." },
    { q: 'O que é "Demanda"?', a: "É a quantidade de unidades do seu produto que o mercado deseja comprar, com base no seu EA e no seu preço em comparação com os concorrentes." },
    { q: 'Qual a diferença entre "Demanda" e "Vendas"?', a: "A **Demanda** é o potencial de vendas. As **Vendas** são a quantidade efetivamente vendida, que é limitada pela sua **Capacidade Operacional**. Se a Demanda for 1.500, mas sua Capacidade for 1.000, suas Vendas serão 1.000." },
    { q: 'O que é "Backlog"?', a: "Ocorre quando a sua demanda é maior que a sua capacidade de produção. Isso significa que você deixou de atender clientes, o que gera uma penalidade de satisfação e pode impactar negativamente o EA da próxima rodada." },
    { q: 'Como o "Custo Variável Unitário" (CVU) é calculado?', a: "O CVU representa o custo para produzir uma única unidade do produto. Ele é calculado com base na **Qualidade** (quanto maior a qualidade, maior o CVU) e na **Eficiência** da equipe (quanto melhor a equipe, menor o CVU)." },
    { q: 'Como o "Lucro" é calculado?', a: "O Lucro é a **Receita** (Vendas x Preço) menos o **Custo Total**. O Custo Total inclui os custos de todas as suas decisões (Produto, Marketing, Equipe, etc.) mais os custos variáveis (Vendas x CVU) e um custo fixo." },
    { q: 'O que é "Reinvestimento"?', a: "É uma parcela de **20% do lucro** obtido em uma rodada que é destinada a aumentar o **orçamento de investimentos da rodada seguinte**. Esse mecanismo permite que as empresas que lucram mais possam investir mais no futuro, criando um ciclo de crescimento." },
    { q: 'O que é o "Caixa Final"?', a: "Representa o valor que sobra do lucro da rodada após a separação do reinvestimento (os outros 80%). Esse valor é somado ao caixa acumulado da empresa, refletindo sua saúde financeira." },
    { q: 'O que é "Satisfação"?', a: "É uma métrica que reflete a percepção do cliente, calculada com base no seu EA. Sofrer 'backlog' (não atender toda a demanda) pode aplicar uma penalidade e reduzir a satisfação." },
    { q: 'O que é "Share"?', a: "É a sua fatia de mercado, ou seja, a porcentagem de clientes que sua empresa conseguiu atrair em relação a todos os concorrentes. É diretamente influenciado pelo seu EA comparado ao EA das outras equipes." },
  ],
  estrategia: [
    { q: "Como o ranking é calculado?", a: "O ranking é calculado com base no **lucro acumulado** das rodadas. A equipe com a maior soma de lucros ao longo da competição ficará na primeira posição." },
    { q: "Onde posso ver os resultados e o ranking?", a: 'No **"Painel Estratégico"**. Esta tela centraliza todos os relatórios, incluindo o desempenho detalhado do seu time, o ranking geral e os resultados de todos os concorrentes. Você pode selecionar a rodada que deseja analisar.' },
    { q: 'O que encontro no "Painel Estratégico"?', a: 'É a central de inteligência da sua empresa. Lá você encontrará o **ranking geral** da competição (baseado no lucro acumulado), uma tabela com os **resultados detalhados de todos os times** por rodada e os **relatórios financeiros do seu próprio time**. É a ferramenta essencial para analisar a concorrência e o seu próprio desempenho.' },
    { q: 'A tela de "Decisões" mostra uma simulação dos resultados?', a: 'Não. A tela de "Decisões" não possui uma simulação em tempo real. Você deve basear suas escolhas na análise dos resultados das rodadas anteriores, disponíveis no "Painel Estratégico", e nas discussões com sua equipe. O impacto real das suas decisões só será conhecido após o fechamento da rodada.' },
    { q: 'Qual a importância de escolher um "Público-Alvo"?', a: 'É crucial. Cada público-alvo reage de forma diferente às suas estratégias. Por exemplo, "Jovens" são mais sensíveis a marketing, enquanto "Sêniores" valorizam mais a qualidade e o atendimento da equipe. Suas decisões devem estar alinhadas ao público escolhido.' },
    { q: "É uma boa estratégia investir o máximo em tudo?", a: "Não necessariamente. O simulador tem um orçamento limitado por rodada. A chave para o sucesso é o equilíbrio: alocar os recursos nas áreas que trazem o maior retorno para o seu público-alvo e sua estratégia, sem exceder o orçamento." },
    { q: "Se minha demanda for muito maior que a capacidade, o que devo fazer na próxima rodada?", a: "Você deve priorizar o aumento da sua 'Capacidade Operacional' para atender a essa demanda reprimida. Não conseguir atender a demanda gera perda de receita e penalidades de satisfação, prejudicando o crescimento a longo prazo." },
  ],
};

const SectionIntro: React.FC<{ title: string; lead: string }> = ({ title, lead }) => (
  <div style={base.card}>
    <h2 style={base.sectionTitle}>{title}</h2>
    <p style={base.sectionLead}>{lead}</p>
  </div>
);

export default function Guia() {
  const [activeTab, setActiveTab] = useState<Sections>("geral");
  const [openByKey, setOpenByKey] = useState<Record<string, boolean>>({});

  const sectionsIntro = useMemo(
    () => ({
      geral: { title: "Bem-vindo ao Simulador!", lead: "Conceitos fundamentais, objetivo e primeiros passos." },
      jogo: { title: "Como Jogar: Rodadas e Decisões", lead: "Dinâmica das rodadas e áreas de decisão." },
      metricas: { title: "Entendendo os Resultados", lead: "EA, Demanda, Vendas, Lucro, Reinvestimento e mais." },
      estrategia: { title: "Análise e Estratégia", lead: "Como usar o Painel Estratégico e alinhar decisões." },
    }),
    []
  );

  const tabs: { id: Sections; label: string }[] = [
    { id: "geral", label: "Visão Geral" },
    { id: "jogo", label: "O Jogo" },
    { id: "metricas", label: "Métricas" },
    { id: "estrategia", label: "Estratégia" },
  ];

  const toggle = (key: string) =>
    setOpenByKey((m) => ({ ...m, [key]: !m[key] }));

  return (
    <div style={base.page}>
      <header style={base.header}>
        <div style={base.headerInner}>
          <div>
            <h1 style={base.h1}>Guia Interativo</h1>
            <p style={base.sub}>EPES Challenge 2025</p>
          </div>
          <nav style={base.tabsRow}>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  ...base.tabBtn,
                  ...(activeTab === t.id ? base.tabBtnActive : null),
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main style={base.container}>
        <SectionIntro
          title={sectionsIntro[activeTab].title}
          lead={sectionsIntro[activeTab].lead}
        />

        <div style={{ marginTop: 12 }}>
          {qaData[activeTab].map((item, idx) => {
            const key = `${activeTab}-${idx}`;
            const open = !!openByKey[key];
            return (
              <div key={key} style={base.accItem}>
                <button style={base.accHeader} onClick={() => toggle(key)}>
                  <span>{item.q}</span>
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      transition: "transform .2s",
                      transform: open ? "rotate(180deg)" : "none",
                      opacity: 0.85,
                    }}
                  >
                    ▼
                  </span>
                </button>
                {open && (
                  <div style={base.accContent}>
                    {/* simples suporte a **negrito** usando replace */}
                    <div
                      dangerouslySetInnerHTML={{
                        __html: item.a.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
