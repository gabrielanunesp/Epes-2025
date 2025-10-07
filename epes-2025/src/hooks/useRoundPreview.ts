import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface UseRoundPreviewParams {
  seasonId: string;
  roundId: string;
  teamId: string;
}

export interface RoundPreviewResult {
  loading: boolean;
  error: string | null;
  myTeam?: any;
  ranking: any[];
  totals: any | null;
  refresh: () => Promise<void>;
  season?: any;
  round?: any;
  teamDecision?: any;
}

const ENGINE_URL = import.meta.env.VITE_ENGINE_URL ?? 'http://localhost:8080';

const ensureNumber = (value: unknown, fallback = 0) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

export function useRoundPreview({ seasonId, roundId, teamId }: UseRoundPreviewParams): RoundPreviewResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ ranking: any[]; myTeam?: any; totals: any | null; season?: any; round?: any; teamDecision?: any }>();

  const fetchPreview = useCallback(async () => {
    if (!seasonId || !roundId) {
      setData(undefined);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const seasonRef = doc(db, 'seasons', seasonId);
      const [seasonSnap, roundSnap, publicTargetsSnap, decisionsSnap] = await Promise.all([
        getDoc(seasonRef),
        getDoc(doc(seasonRef, 'rounds', roundId)),
        getDocs(collection(seasonRef, 'publicTargets')),
        getDocs(collection(seasonRef, 'rounds', roundId, 'teams')),
      ]);

      if (!seasonSnap.exists()) throw new Error('Temporada não encontrada');

      const seasonData = seasonSnap.data() ?? {};
      const roundData = roundSnap.exists() ? roundSnap.data() : {};

      const publicTargets = publicTargetsSnap.docs.map((snap) => ({
        id: snap.id,
        ...(snap.data() as Record<string, unknown>),
      })) as Array<{
        id: string;
        deltas?: Record<string, number>;
        elasticity?: number;
        marketingBoost?: number;
      }>;

      const teamDecisions = await Promise.all(
        decisionsSnap.docs.map(async (snap) => {
          const payload = snap.data() as Record<string, unknown>;
          const teamDoc = await getDoc(doc(db, 'teams', snap.id));
          const seasonTeamDoc = await getDoc(doc(seasonRef, 'teams', snap.id));
          const meta = teamDoc.exists() ? teamDoc.data() : {};
          const seasonMeta = seasonTeamDoc.exists() ? seasonTeamDoc.data() : {};
          const benefitOverride =
            typeof payload.benefitCostOverride === 'number'
              ? payload.benefitCostOverride
              : null;
          return {
            teamId: snap.id,
            name: (meta?.name as string) ?? snap.id,
            publicTargetId: (meta?.publicTargetId as string) ?? (payload.publicTargetId as string) ?? '',
            price: ensureNumber(payload.price, seasonData.refPrice ?? 0),
            marketingSpend: ensureNumber(payload.marketingSpend, 0),
            capacity: ensureNumber(payload.capacity, 0),
            quality: ensureNumber(payload.quality, 0),
            efficiency: ensureNumber(payload.efficiency, 0),
            cx: ensureNumber(payload.cx, 0),
            launchEA: ensureNumber(payload.launchEA, 0),
            brandEA: ensureNumber(payload.brandEA, 0),
            benefitChoice: payload.benefitChoice ?? null,
            benefitCostOverride: benefitOverride,
            reinvestBudget: ensureNumber(seasonMeta?.reinvestBudget, 0),
            cash: ensureNumber(seasonMeta?.cash, 0),
            decision: payload,
            seasonMeta,
          };
        })
      );

      if (teamDecisions.length === 0) {
        setData({
          ranking: [],
          myTeam: undefined,
          totals: null,
          season: seasonData,
          round: { marketSize: ensureNumber(roundData?.marketSize, 0), roundId },
          teamDecision: undefined,
        });
        setLoading(false);
        return;
      }

      const seasonRefPrice = ensureNumber(seasonData.refPrice, 0);
      const computePayload = {
        season: {
          refPrice: seasonRefPrice,
          softmaxBeta: ensureNumber(seasonData.softmaxBeta, 1),
          shareCap: seasonData.shareCap ?? null,
          dampingAlpha: seasonData.dampingAlpha ?? null,
          weights: seasonData.weights ?? { price: 0, quality: 0, marketing: 0, cx: 0 },
          costs: seasonData.costs ?? { cvuBase: 0, kQuality: 0, kEfficiency: 0, fixedTeamCost: 0, benefitCost: 0 },
          rules: seasonData.rules ?? { reinvestRate: 0.2 },
        },
        publicTargets: publicTargets.map((target) => ({
          id: target.id,
          deltas: target.deltas ?? {},
          elasticity: ensureNumber(target.elasticity, 1),
          marketingBoost: ensureNumber(target.marketingBoost, 0),
        })),
        teams: teamDecisions.map((team) => ({
          teamId: team.teamId,
          name: team.name,
          publicTargetId: team.publicTargetId,
          price: ensureNumber(team.price, seasonRefPrice),
          marketingSpend: ensureNumber(team.marketingSpend, 0),
          capacity: ensureNumber(team.capacity, 0),
          quality: ensureNumber(team.quality, 0),
          efficiency: ensureNumber(team.efficiency, 0),
          cx: ensureNumber(team.cx, 0),
          launchEA: ensureNumber(team.launchEA, 0),
          brandEA: ensureNumber(team.brandEA, 0),
          benefitChoice: team.benefitChoice ?? null,
          benefitCostOverride: typeof team.benefitCostOverride === 'number' ? team.benefitCostOverride : null,
          reinvestBudget: ensureNumber(team.reinvestBudget, 0),
          cash: ensureNumber(team.cash, 0),
        })),
        round: {
          marketSize: ensureNumber(roundData?.marketSize, 0),
          roundId,
          startAt: roundData?.startAt ?? null,
          lockAt: roundData?.lockAt ?? null,
        },
      };

      const response = await fetch(`${ENGINE_URL}/v1/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(computePayload),
      });

      if (!response.ok) {
        const msg = await response.text();
        throw new Error(msg || 'Erro ao calcular rodada');
      }

      const result = await response.json();
      const ranking = Array.isArray(result.results) ? result.results : [];
      const myTeam = ranking.find((item: any) => item.teamId === teamId);
      const teamDecision = teamDecisions.find((t) => t.teamId === teamId);

      setData({
        ranking,
        myTeam,
        totals: result.totals ?? null,
        season: computePayload.season,
        round: computePayload.round,
        teamDecision,
      });
    } catch (err) {
      console.error(err);
      setError((err as Error).message ?? 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }, [seasonId, roundId, teamId]);

  useEffect(() => {
    void fetchPreview();
  }, [fetchPreview]);

  const memoized = useMemo(() => ({
    loading,
    error,
    myTeam: data?.myTeam,
    ranking: data?.ranking ?? [],
    totals: data?.totals ?? null,
    refresh: fetchPreview,
    season: data?.season,
    round: data?.round,
    teamDecision: data?.teamDecision,
  }), [loading, error, data, fetchPreview]);

  return memoized;
}
