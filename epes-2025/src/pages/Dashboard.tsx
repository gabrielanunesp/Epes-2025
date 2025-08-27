import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import Card from "./Card";
import Button from "../components/Button";
import Home from "./Home";
import RoundStatusCard from "../components/RoundStatusCard";
import "./Dashboard.css";

export default function Dashboard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<"home" | "main">("home");

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
        )}
      </main>
    </div>
  );
}
