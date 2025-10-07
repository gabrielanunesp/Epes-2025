import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import { db } from '../services/firebase';
import { useRoundPreview } from '../hooks/useRoundPreview';
import './DecisionPage.css';

interface DecisionFormState {
  price: number;
  marketingSpend: number;
  capacity: number;
  quality: number;
  efficiency: number;
  cx: number;
  launchEA: number;
  brandEA: number;
  benefitChoice: string | null;
}

const DEFAULT_DECISION: DecisionFormState = {
  price: 0,
  marketingSpend: 0,
  capacity: 0,
  quality: 50,
  efficiency: 50,
  cx: 50,
  launchEA: 0,
  brandEA: 0,
  benefitChoice: null,
};

const ensureNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const DecisionPage = () => {
  const navigate = useNavigate();
  const [seasonId, setSeasonId] = useState('');
  const [roundId, setRoundId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [form, setForm] = useState<DecisionFormState>(DEFAULT_DECISION);
  const [baseAttributes, setBaseAttributes] = useState({ quality: 50, efficiency: 50, cx: 50 });
  const [loadingDecision, setLoadingDecision] = useState(false);

  useEffect(() => {
    const storedTeam = localStorage.getItem('idDoTime');
    if (!storedTeam) {
      toast.error('Nenhum time selecionado. Escolha um time antes de enviar decisões.');
      navigate('/escolher-time');
      return;
    }
    setTeamId(storedTeam);

    (async () => {
      setLoadingDecision(true);
      try {
        const geralSnap = await getDoc(doc(db, 'configuracoes', 'geral'));
        const geral = geralSnap.data() ?? {};
        const season = (geral.seasonId as string) ?? 'default-season';
        const rodadaNumero = Number(geral.rodadaAtual ?? 1);
        setSeasonId(season);
        setRoundId(`D${rodadaNumero}`);

        const decisionRef = doc(db, 'seasons', season, 'rounds', `D${rodadaNumero}`, 'teams', storedTeam);
        const decisionSnap = await getDoc(decisionRef);
        if (decisionSnap.exists()) {
          const data = decisionSnap.data() as Record<string, unknown>;
          setForm({
            price: ensureNumber(data.price, DEFAULT_DECISION.price),
            marketingSpend: ensureNumber(data.marketingSpend, DEFAULT_DECISION.marketingSpend),
            capacity: ensureNumber(data.capacity, DEFAULT_DECISION.capacity),
            quality: ensureNumber(data.quality, DEFAULT_DECISION.quality),
            efficiency: ensureNumber(data.efficiency, DEFAULT_DECISION.efficiency),
            cx: ensureNumber(data.cx, DEFAULT_DECISION.cx),
            launchEA: ensureNumber(data.launchEA, DEFAULT_DECISION.launchEA),
            brandEA: ensureNumber(data.brandEA, DEFAULT_DECISION.brandEA),
            benefitChoice: (data.benefitChoice as string) ?? DEFAULT_DECISION.benefitChoice,
          });
          setBaseAttributes({
            quality: ensureNumber(data.quality, 50),
            efficiency: ensureNumber(data.efficiency, 50),
            cx: ensureNumber(data.cx, 50),
          });
        }
      } catch (error) {
        console.error(error);
        toast.error('Erro ao carregar decisão atual.');
      } finally {
        setLoadingDecision(false);
      }
    })();
  }, [navigate]);

  const preview = useRoundPreview({ seasonId, roundId, teamId });
  const refPrice = preview.season?.refPrice ?? 100;
  const reinvestBudget = ensureNumber(preview.myTeam?.reinvestBudget ?? preview.teamDecision?.reinvestBudget, 0);
  const minPrice = Number((refPrice * 0.8).toFixed(2));
  const maxPrice = Number((refPrice * 1.2).toFixed(2));

  useEffect(() => {
    if (form.price === 0 && refPrice > 0) {
      setForm((prev) => ({ ...prev, price: refPrice }));
    }
  }, [refPrice, form.price]);

  const upgradeCost = useMemo(() => {
    const deltaQuality = Math.max(0, form.quality - baseAttributes.quality);
    const deltaEfficiency = Math.max(0, form.efficiency - baseAttributes.efficiency);
    const deltaCx = Math.max(0, form.cx - baseAttributes.cx);
    const costPerPoint = 100;
    return (deltaQuality + deltaEfficiency + deltaCx) * costPerPoint;
  }, [form.quality, form.efficiency, form.cx, baseAttributes]);

  const isPriceValid = form.price >= minPrice && form.price <= maxPrice;
  const isUpgradeAffordable = upgradeCost <= reinvestBudget + 1e-6;
  const formValid =
    isPriceValid &&
    isUpgradeAffordable &&
    !preview.loading &&
    !loadingDecision &&
    teamId.length > 0;

  const updateField = <K extends keyof DecisionFormState>(key: K, value: DecisionFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!formValid) {
      toast.error('Revise os campos antes de salvar.');
      return;
    }
    try {
      if (!seasonId || !roundId) throw new Error('Configuração da rodada ausente.');
      const decisionRef = doc(db, 'seasons', seasonId, 'rounds', roundId, 'teams', teamId);
      await setDoc(decisionRef, {
        ...form,
        upgradeCost,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      toast.success('Decisão salva com sucesso!');
      await preview.refresh();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar decisão.');
    }
  };

  const handlePreview = async () => {
    await preview.refresh();
  };

  return (
    <div className="decision-page">
      <header className="decision-header">
        <h1>Planejamento da Rodada</h1>
        <div>
          <strong>Rodada:</strong> {roundId || 'Carregando...'} • <strong>Time:</strong> {teamId || 'N/D'}
        </div>
      </header>

      <section className="decision-card">
        <h2>Parâmetros comerciais</h2>
        <div className="decision-grid">
          <label>
            Preço (R$)
            <input
              type="number"
              value={form.price}
              min={minPrice}
              max={maxPrice}
              step={0.5}
              onChange={(event) => updateField('price', Number(event.target.value))}
            />
            <span className="hint">Faixa permitida: {minPrice.toFixed(2)} – {maxPrice.toFixed(2)}</span>
            {!isPriceValid && <span className="error">Preço deve respeitar ±20% do preço de referência.</span>}
          </label>

          <label>
            Marketing (R$)
            <input
              type="number"
              value={form.marketingSpend}
              min={0}
              step={1000}
              onChange={(event) => updateField('marketingSpend', Math.max(0, Number(event.target.value)))}
            />
          </label>

          <label>
            Capacidade (unid)
            <input
              type="number"
              value={form.capacity}
              min={0}
              step={100}
              onChange={(event) => updateField('capacity', Math.max(0, Number(event.target.value)))}
            />
          </label>
        </div>
      </section>

      <section className="decision-card">
        <h2>Upgrades financiados (Reinvestimento disponível: R$ {reinvestBudget.toLocaleString('pt-BR')})</h2>
        <div className="decision-grid">
          <label>
            Qualidade (%)
            <input
              type="number"
              value={form.quality}
              min={0}
              max={100}
              onChange={(event) => updateField('quality', Math.min(100, Math.max(0, Number(event.target.value))))}
            />
          </label>
          <label>
            Eficiência (%)
            <input
              type="number"
              value={form.efficiency}
              min={0}
              max={100}
              onChange={(event) => updateField('efficiency', Math.min(100, Math.max(0, Number(event.target.value))))}
            />
          </label>
          <label>
            Experiência do Cliente (%)
            <input
              type="number"
              value={form.cx}
              min={0}
              max={100}
              onChange={(event) => updateField('cx', Math.min(100, Math.max(0, Number(event.target.value))))}
            />
          </label>
        </div>
        <p className="hint">
          Custo estimado dos upgrades: R$ {upgradeCost.toLocaleString('pt-BR')} (100 por ponto acima do patamar anterior)
        </p>
        {!isUpgradeAffordable && <p className="error">Os upgrades excedem o reinvestimento disponível.</p>}
      </section>

      <section className="decision-card">
        <h2>Marca e lançamento</h2>
        <div className="decision-grid">
          <label>
            Bônus de lançamento (%)
            <input
              type="number"
              value={form.launchEA}
              min={0}
              max={1}
              step={0.01}
              onChange={(event) => updateField('launchEA', Math.min(1, Math.max(0, Number(event.target.value))))}
            />
          </label>
          <label>
            Força de marca (%)
            <input
              type="number"
              value={form.brandEA}
              min={0}
              max={1}
              step={0.01}
              onChange={(event) => updateField('brandEA', Math.min(1, Math.max(0, Number(event.target.value))))}
            />
          </label>
          <label>
            Benefício promocional
            <select
              value={form.benefitChoice ?? 'nenhum'}
              onChange={(event) => updateField('benefitChoice', event.target.value === 'nenhum' ? null : event.target.value)}
            >
              <option value="nenhum">Nenhum</option>
              <option value="cupom">Cupom</option>
              <option value="brinde">Brinde</option>
              <option value="frete">Frete grátis</option>
            </select>
          </label>
        </div>
      </section>

      <section className="decision-actions">
        <button type="button" onClick={handlePreview} disabled={preview.loading || !seasonId}>
          Calcular Preview
        </button>
        <button type="button" className="primary" onClick={handleSave} disabled={!formValid}>
          Salvar Decisão
        </button>
      </section>

      <section className="decision-card">
        <h2>Resultado previsto do meu time</h2>
        {preview.loading && <p>Calculando...</p>}
        {preview.error && <p className="error">{preview.error}</p>}
        {!preview.loading && preview.myTeam && (
          <div className="preview-grid">
            <div>
              <strong>EA linear:</strong> {preview.myTeam.eaLinear.toFixed(2)}
            </div>
            <div>
              <strong>Participação:</strong> {(preview.myTeam.share * 100).toFixed(2)}%
            </div>
            <div>
              <strong>Demanda:</strong> {Math.round(preview.myTeam.demandRaw).toLocaleString('pt-BR')} unid.
            </div>
            <div>
              <strong>Vendas:</strong> {Math.round(preview.myTeam.sales).toLocaleString('pt-BR')} unid.
            </div>
            <div>
              <strong>Receita:</strong> R$ {preview.myTeam.revenue.toLocaleString('pt-BR')}
            </div>
            <div>
              <strong>Lucro:</strong> R$ {preview.myTeam.profit.toLocaleString('pt-BR')}
            </div>
            <div>
              <strong>Reinvest (20%):</strong> R$ {preview.myTeam.reinvest.toLocaleString('pt-BR')}
            </div>
            <div>
              <strong>Caixa (80%):</strong> R$ {preview.myTeam.cashToFinal.toLocaleString('pt-BR')}
            </div>
            <div>
              <strong>Limite capacidade:</strong> {preview.myTeam.flags.capacityBound ? 'Sim' : 'Não'}
            </div>
          </div>
        )}
      </section>

      <section className="decision-card">
        <h2>Ranking previsto (lucro)</h2>
        {preview.loading && <p>Carregando...</p>}
        {!preview.loading && preview.ranking.length === 0 && <p>Aguardando decisões das equipes.</p>}
        {!preview.loading && preview.ranking.length > 0 && (
          <table className="ranking-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Time</th>
                <th>Participação</th>
                <th>Vendas</th>
                <th>Lucro</th>
              </tr>
            </thead>
            <tbody>
              {preview.ranking.map((team: any, index: number) => (
                <tr key={team.teamId} className={team.teamId === teamId ? 'highlight' : ''}>
                  <td>{index + 1}</td>
                  <td>{team.name ?? team.teamId}</td>
                  <td>{(team.share * 100).toFixed(2)}%</td>
                  <td>{Math.round(team.sales).toLocaleString('pt-BR')}</td>
                  <td>R$ {team.profit.toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default DecisionPage;
