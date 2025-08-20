import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import Card from './Card';
import Button from "../components/Button";
import Home from './Home';
import RoundStatusCard from "../components/RoundStatusCard";
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<'home' | 'main'>('home');

  // Dados simulados da rodada
  const currentRound = 2;
  const totalRounds = 10;
  const creditAvailable = 120;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (err) {
      console.error("Erro ao deslogar:", err);
    }
  };

  const handleOpenDecisions = () => {
    navigate(`/decisions/${currentRound}`);
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>{currentStep === 'home' ? 'Alocação Inicial' : 'Dashboard'}</h1>
        <Button className="btn-logout" onClick={handleLogout}>Sair</Button>
      </header>

      <main style={{ padding: '2rem' }}>
        {currentStep === 'home' ? (
          <Home onFinish={() => setCurrentStep('main')} />
        ) : (
          <div className="dashboard-grid">
            <RoundStatusCard
              currentRound={currentRound}
              totalRounds={totalRounds}
              creditAvailable={creditAvailable}
              onOpenDecisions={handleOpenDecisions}
            />
            <Card title="Card 2" description="Informações do card 2" />
            <Card title="Card 3" description="Informações do card 3" />
          </div>
        )}
      </main>
    </div>
  );
}
