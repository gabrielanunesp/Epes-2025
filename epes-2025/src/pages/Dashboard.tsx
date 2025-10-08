import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import Card from "./Card";
import Button from "../components/Button";
import RoundStatusCard from "../components/RoundStatusCard";
import "./Dashboard.css";

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0e2a47 0%, #0a1e31 45%, #121212 100%)",
    color: "#eaf2f8",
  } as React.CSSProperties,
  container: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "24px 24px 56px",
  } as React.CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "12px 0 24px",
  } as React.CSSProperties,
  titleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  } as React.CSSProperties,
  titleBadge: {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    letterSpacing: 0.4,
    color: "#9fd3ff",
    background: "rgba(159, 211, 255, 0.12)",
    border: "1px solid rgba(159,211,255,0.25)",
  } as React.CSSProperties,
  h1: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: 0.2,
  } as React.CSSProperties,
  glassCard: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    backdropFilter: "blur(7px)",
    WebkitBackdropFilter: "blur(7px)",
    borderRadius: 16,
  } as React.CSSProperties,
  identity: {
    display: "grid",
    gridTemplateColumns: "72px 1fr auto",
    gap: 16,
    padding: 16,
    alignItems: "center",
  } as React.CSSProperties,
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    border: "2px solid rgba(255,255,255,0.18)",
  } as React.CSSProperties,
  quickRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16,
  } as React.CSSProperties,
  pillBtn: {
    appearance: "none",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#eaf2f8",
    padding: "10px 14px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 600,
  } as React.CSSProperties,
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
    marginTop: 24,
  } as React.CSSProperties,
  callout: {
    padding: 18,
    lineHeight: 1.65,
  } as React.CSSProperties,
  calloutTitle: { margin: 0, fontSize: 18, fontWeight: 700 } as React.CSSProperties,
  calloutP: { margin: "8px 0 0", color: "#cbe3ff" } as React.CSSProperties,
  formBox: { padding: 16, marginTop: 16 } as React.CSSProperties,
  formLabel: { display: "block", fontSize: 13, marginTop: 10, marginBottom: 6, opacity: 0.9 } as React.CSSProperties,
  input: {
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.16)",
    color: "#eaf2f8",
    padding: "10px 12px",
    borderRadius: 10,
  } as React.CSSProperties,
  textarea: {
    width: "100%",
    minHeight: 90,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.16)",
    color: "#eaf2f8",
    padding: "10px 12px",
    borderRadius: 10,
  } as React.CSSProperties,
  colorRow: { display: "flex", alignItems: "center", gap: 12, marginTop: 10 } as React.CSSProperties,
  colorSwatch: { width: 34, height: 34, borderRadius: 8, border: "2px solid rgba(255,255,255,0.2)" } as React.CSSProperties,
  sectionTitle: { margin: "22px 0 8px", fontSize: 18, fontWeight: 800 } as React.CSSProperties,
  footerHint: { opacity: 0.8, fontSize: 12, marginTop: 24 } as React.CSSProperties,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState("");
  const [missao, setMissao] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [cor, setCor] = useState("#000000");
  const [empresaExistente, setEmpresaExistente] = useState(false);
  const [isCapitao, setIsCapitao] = useState(false);
  const [empresaInfo, setEmpresaInfo] = useState<{
    nome: string;
    missao: string;
    logoUrl?: string;
    cor?: string;
    publicoAlvo?: string;
  } | null>(null);
  const [user, setUser] = useState<any>(null);
  const [codigoTurma, setCodigoTurma] = useState<string | null>(null);
  const papel = localStorage.getItem("papel");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    setCodigoTurma(localStorage.getItem("codigoTurma"));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchEmpresa = async () => {
      // Responsável não usa este dashboard “de jogador”
      if (papel === "responsavel") {
        setCarregando(false);
        return;
      }

      if (!codigoTurma || !user) return;

      try {
        const empresaRef = doc(db, "empresas", codigoTurma);
        const empresaSnap = await getDoc(empresaRef);

        if (empresaSnap.exists()) {
          const data = empresaSnap.data() as any;
          setEmpresaExistente(true);
          setEmpresaInfo({
            nome: data.nome,
            missao: data.missao,
            logoUrl: data.logoUrl || "",
            cor: data.cor || "#000000",
            publicoAlvo: data.publicoAlvo || "",
          });
        }

        const timeRef = doc(db, "times", codigoTurma);
        const timeSnap = await getDoc(timeRef);
        const timeData = timeSnap.exists() ? (timeSnap.data() as any) : null;

        if (timeData?.criadoPor === user.uid) {
          setIsCapitao(true);

          // Se a empresa não existe ou ainda não tem identidade, redireciona para /d0-identidade
          if (!empresaSnap.exists() || !empresaSnap.data()?.identidadeDefinida) {
            navigate("/d0-identidade");
            return;
          }
        }

        setCarregando(false);
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      }
    };

    fetchEmpresa();
  }, [codigoTurma, user, navigate, papel]);

  useEffect(() => {
    if (empresaInfo) {
      setNome(empresaInfo.nome || "");
      setMissao(empresaInfo.missao || "");
      setLogoUrl(empresaInfo.logoUrl || "");
      setCor(empresaInfo.cor || "#000000");
    }
  }, [empresaInfo]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (err) {
      console.error("Erro ao deslogar:", err);
    }
  };

  const handleOpenDecisions = () => {
    navigate("/decisoes");
  };

  const handleSaveEmpresa = async () => {
    if (!user || !codigoTurma || papel === "responsavel") return;

    if (!nome || !missao) {
      alert("⚠️ Preencha todos os campos obrigatórios.");
      return;
    }

    // preserva o público-alvo já definido
    const empresaData = {
      nome,
      missao,
      logoUrl,
      cor,
      publicoAlvo: empresaInfo?.publicoAlvo || "",
      criadoPor: user.uid,
      identidadeDefinida: true,
      timestamp: new Date(),
    };

    try {
      await setDoc(doc(db, "empresas", codigoTurma), empresaData);
      alert("✅ Empresa cadastrada com sucesso!");
      setEmpresaExistente(true);
      setEmpresaInfo(empresaData);
    } catch (error) {
      console.error("Erro ao salvar empresa:", error);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.titleWrap}>
            <span style={styles.titleBadge}>EPES • Challenge 2025</span>
            <h1 style={styles.h1}>Dashboard</h1>
          </div>
          <Button className="btn-logout" onClick={handleLogout}>Sair</Button>
        </header>

        <main>
          {carregando ? (
            <p>Carregando...</p>
          ) : (
            <>
              {empresaInfo && (
                <div style={{ ...styles.glassCard, ...styles.identity, marginBottom: 18 }}>
                  <div style={{ ...styles.logoBox, backgroundColor: empresaInfo.cor || "#4caf50" }} />
                  <div>
                    <h2 style={{ margin: 0 }}>{empresaInfo.nome}</h2>
                    <p style={{ margin: "6px 0 0", opacity: 0.9 }}>
                      <strong>Público-alvo:</strong> {empresaInfo.publicoAlvo || "—"}
                    </p>
                    <p style={{ margin: "6px 0 0", color: "#cbe3ff" }}>
                      <em>{empresaInfo.missao}</em>
                    </p>
                    {empresaInfo.logoUrl && empresaInfo.logoUrl.startsWith("http") && (
                      <img src={empresaInfo.logoUrl} alt="Logo da empresa" style={{ marginTop: 10, height: 44, borderRadius: 6 }} />
                    )}
                  </div>
                  <div>
                    <span style={{ ...styles.titleBadge, display: "inline-block" }}>Equipe</span>
                  </div>
                </div>
              )}

              <div style={{ ...styles.glassCard, ...styles.callout }}>
                <h3 style={styles.calloutTitle}>Como jogar bem esta rodada</h3>
                <p style={styles.calloutP}>
                  • O capitão envia as decisões enquanto a rodada estiver <strong>aberta</strong>.<br />
                  • O resultado oficial sai após <strong>23:59</strong> e alimenta Relatórios e Ranking.<br />
                  • Use <em>Painel Estratégico</em> para testar preço/marketing e entender o impacto.
                </p>
              </div>

              <div style={styles.grid}>
                <RoundStatusCard onOpenDecisions={handleOpenDecisions} />
                <Card
                  title="🧠 Painel Estratégico"
                  description="Acompanhe os resultados financeiros e decisões do seu time."
                  onClick={() => navigate("/informacoes")}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
