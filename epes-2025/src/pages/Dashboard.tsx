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
import RoundStatusCard from "../components/RoundStatusCard";
import "./Dashboard.css";

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
      if (papel === "responsavel") {
        setCarregando(false);
        return;
      }

      if (!codigoTurma || !user) return;

      try {
        const empresaRef = doc(db, "empresas", codigoTurma);
        const empresaSnap = await getDoc(empresaRef);

        if (empresaSnap.exists()) {
          const data = empresaSnap.data();
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
        const timeData = timeSnap.exists() ? timeSnap.data() : null;

        if (timeData?.criadoPor === user.uid) {
          setIsCapitao(true);

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
  }, [codigoTurma, user]);

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

    const empresaData = {
      nome,
      missao,
      logoUrl,
      cor,
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
  <div className="dashboard-container">
    <header className="dashboard-header">
      <h1>Dashboard</h1>
      <Button className="btn-logout" onClick={handleLogout}>
        Sair
      </Button>
    </header>

    <main style={{ padding: "2rem" }}>
  {carregando ? (
    <p>Carregando...</p>
  ) : (
    <>
      {empresaInfo && (
        <div className="empresa-identidade" style={{ padding: "1rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                backgroundColor: empresaInfo.cor || "#4caf50",
                borderRadius: "6px",
                border: "2px solid #ccc",
              }}
            />
            <div>
              <h2>{empresaInfo.nome}</h2>
              <p><strong>Público-alvo:</strong> {empresaInfo.publicoAlvo}</p>
              <p><em>{empresaInfo.missao}</em></p>
            </div>
          </div>
          {empresaInfo.logoUrl && empresaInfo.logoUrl.startsWith("http") && (
            <img
              src={empresaInfo.logoUrl}
              alt="Logo da empresa"
              style={{ marginTop: "1rem", height: "50px", borderRadius: "4px" }}
            />
          )}
        </div>
      )}

      <div style={{
        backgroundColor: '#e8f5e9',
        border: '2px solid #4caf50',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '2rem',
        color: '#2e7d32',
        fontWeight: 500,
        lineHeight: 1.6
      }}>
        <p>
          👥 <strong>Bem-vindo ao Dashboard da sua equipe!</strong><br /><br />
          Aqui você acompanha o desempenho da empresa, acessa relatórios, rankings e toma decisões estratégicas a cada rodada.<br /><br />
          🧭 <strong>Identidade da Empresa:</strong> Antes de iniciar as decisões, defina o nome, missão e estilo visual da sua empresa. Essa identidade será usada em todas as rodadas e impacta a percepção dos clientes e concorrentes.<br /><br />
          👑 <strong>Capitão:</strong> Apenas o capitão pode criar ou editar a identidade da empresa. O botão <strong>"Criar Empresa"</strong> aparece exclusivamente para o capitão que criou a equipe. Preencha com atenção — sua equipe depende disso!<br /><br />
          ⚠️ <strong>Importante:</strong> A identidade será exibida nos rankings e relatórios. Escolha com estratégia e criatividade!<br /><br />
          🕒 <strong>Rodadas:</strong> São liberadas pelo administrador da turma. Ao iniciar, um cronômetro é ativado com prazo máximo até <strong>23:59</strong> do mesmo dia. Mesmo após o capitão salvar as decisões, o cronômetro continua ativo até o fim. Após esse horário, a rodada é encerrada e os resultados ficam disponíveis nas páginas de <strong>Relatórios</strong> e <strong>Ranking</strong>.<br /><br />
          📦 <strong>Decisões:</strong> No card de decisões, apenas o capitão pode enviar as escolhas da equipe. O botão de envio só aparece enquanto a rodada estiver aberta. Fique atento ao tempo e alinhe as decisões com seu grupo antes de confirmar!<br /><br />
          ✅ <strong>Dica:</strong> Use os relatórios e rankings para embasar suas estratégias. Cada rodada é uma chance de ajustar o rumo da empresa e buscar a liderança!
        </p>
      </div>

      {isCapitao && papel !== "responsavel" && (
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

          {logoUrl && logoUrl.startsWith("http") && (
            <div style={{ marginTop: "10px" }}>
              <p style={{ fontSize: "0.9rem", color: "#555" }}>Pré-visualização da logo:</p>
              <img src={logoUrl} alt="Prévia da logo" style={{ height: "50px", borderRadius: "4px" }} />
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
  Cor da identidade:
  <input
    type="color"
    value={cor}
    onChange={(e) => setCor(e.target.value)}
  />
  <div
    style={{
      width: "30px",
      height: "30px",
      backgroundColor: cor,
      borderRadius: "6px",
      border: "2px solid #ccc",
    }}
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
          title="📊 Pontuações da Rodada"
          description="Veja o desempenho do grupo e nesta rodada."
          onClick={() => navigate("/ranking")}
        />

        <Card
          title="📁 Relatório do Grupo"
          description="Revise seus dados para melhorar sua pontuação."
          onClick={() => navigate("/relatorio")}
        />

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
);
}
