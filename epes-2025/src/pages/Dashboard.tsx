import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../services/firebase";
import {
  doc,
  getDoc,
  setDoc
} from "firebase/firestore";
import Card from "./Card";
import Button from "../components/Button";
import Home from "./Home";
import RoundStatusCard from "../components/RoundStatusCard";
import "./Dashboard.css";

export default function Dashboard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<"home" | "main">("home");

  const [nome, setNome] = useState("");
  const [setor, setSetor] = useState("");
  const [missao, setMissao] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [cor, setCor] = useState("#000000");
  const [empresaExistente, setEmpresaExistente] = useState(false);
  const [isCapitao, setIsCapitao] = useState(false);
  const [empresaInfo, setEmpresaInfo] = useState<{
    nome: string;
    setor: string;
    missao: string;
    logoUrl?: string;
    cor?: string;
  } | null>(null);

  const [user, setUser] = useState<any>(null);
  const [codigoTurma, setCodigoTurma] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    setCodigoTurma(localStorage.getItem("codigoTurma"));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!codigoTurma || !user) return;

      try {
        const empresaRef = doc(db, "empresas", codigoTurma);
        const empresaSnap = await getDoc(empresaRef);

        if (empresaSnap.exists()) {
          const data = empresaSnap.data();
          setEmpresaExistente(true);
          setEmpresaInfo({
            nome: data.nome,
            setor: data.setor,
            missao: data.missao,
            logoUrl: data.logoUrl || "",
            cor: data.cor || "#000000",
          });
        }

        const timeRef = doc(db, "times", codigoTurma);
        const timeSnap = await getDoc(timeRef);
        const timeData = timeSnap.exists() ? timeSnap.data() : null;
        if (timeData?.criadoPor === user.uid) {
          setIsCapitao(true);
        }

        // ❌ Removido: setCurrentStep("main")
        // ✅ Agora a transição depende do Home.tsx chamar onFinish()
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      }
    };

    fetchEmpresa();
  }, [codigoTurma, user]);

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
    if (!user || !codigoTurma) return;

    const empresaData = {
      nome,
      setor,
      missao,
      logoUrl,
      cor,
      criadoPor: user.uid,
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
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>{currentStep === "home" ? "Alocação Inicial" : "Dashboard"}</h1>
        <Button className="btn-logout" onClick={handleLogout}>
          Sair
        </Button>
      </header>

      <main style={{ padding: "2rem" }}>
        {currentStep === "home" ? (
          <Home onFinish={() => setCurrentStep("main")} />
        ) : (
          <>
            {empresaInfo && (
              <div
                className="empresa-identidade"
                style={{ borderLeft: `6px solid ${empresaInfo.cor || "#4caf50"}` }}
              >
                <div className="empresa-header">
                  <div>
                    <h2>{empresaInfo.nome}</h2>
                    <p><strong>Setor:</strong> {empresaInfo.setor}</p>
                    <p><em>{empresaInfo.missao}</em></p>
                  </div>
                </div>
              </div>
            )}

            {isCapitao && (
              <div className="cadastro-empresa-box">
                <h2>{empresaExistente ? "✏️ Editar Empresa" : "🚀 Criar Empresa"}</h2>
                <p>
                  {empresaExistente
                    ? "Você pode atualizar os dados da empresa."
                    : "Como capitão, você deve criar a identidade da empresa antes de iniciar as decisões."}
                </p>

                <label>
                  Nome da empresa:
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder={empresaInfo?.nome || "Nome da empresa"}
                  />
                </label>

                <label>
                  Setor de atuação:
                  <input
                    type="text"
                    value={setor}
                    onChange={(e) => setSetor(e.target.value)}
                    placeholder={empresaInfo?.setor || "Setor de atuação"}
                  />
                </label>

                <label>
                  Missão ou slogan:
                  <textarea
                    value={missao}
                    onChange={(e) => setMissao(e.target.value)}
                    placeholder={empresaInfo?.missao || "Missão ou slogan"}
                  />
                </label>

                <label>
                  URL da logo (opcional):
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder={empresaInfo?.logoUrl || "https://..."}
                  />
                </label>

                <label>
                  Cor da identidade:
                  <input
                    type="color"
                    value={cor}
                    onChange={(e) => setCor(e.target.value)}
                  />
                </label>

                <button onClick={handleSaveEmpresa}>
                  {empresaExistente ? "💾 Atualizar Empresa" : "💾 Criar Empresa"}
                </button>
              </div>
            )}

            <div className="dashboard-grid">
              <RoundStatusCard onOpenDecisions={handleOpenDecisions} />

              <Card
                title="🏆 Ranking"
                description="Veja a pontuação dos grupos e jogadores."
                onClick={() => navigate("/ranking")}
              />

              <Card
                title="📊 Relatório"
                description="Visualize receita, custos e lucro de forma simples e direta."
                onClick={() => navigate("/relatorio")}
              />

              <Card
                title="🎮 Sobre o Jogo"
                description="Entenda as regras, objetivos e como pontuar na simulação."
                onClick={() => navigate("/informacoes")}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
