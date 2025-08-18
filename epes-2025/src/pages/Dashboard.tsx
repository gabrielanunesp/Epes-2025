// src/pages/Dashboard.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";

export default function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/"); // volta para login
  };

  return (
    <div className="min-h-screen bg-green-50">
      <header className="bg-green-700 text-white p-4 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <Button onClick={handleLogout} className="bg-white text-green-700 hover:bg-gray-200">
          Sair
        </Button>
      </header>

      <main className="p-6">
        <h2 className="text-green-800 text-2xl font-semibold mb-6">Bem-vindo ao painel!</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-4 rounded shadow hover:shadow-lg transition">
            <h3 className="font-semibold text-green-700 mb-2">Card 1</h3>
            <p className="text-gray-600 mb-4">Informações do card 1</p>
            <Button>Detalhes</Button>
          </div>

          <div className="bg-white p-4 rounded shadow hover:shadow-lg transition">
            <h3 className="font-semibold text-green-700 mb-2">Card 2</h3>
            <p className="text-gray-600 mb-4">Informações do card 2</p>
            <Button>Detalhes</Button>
          </div>

          <div className="bg-white p-4 rounded shadow hover:shadow-lg transition">
            <h3 className="font-semibold text-green-700 mb-2">Card 3</h3>
            <p className="text-gray-600 mb-4">Informações do card 3</p>
            <Button>Detalhes</Button>
          </div>
        </div>
      </main>
    </div>
  );
}
