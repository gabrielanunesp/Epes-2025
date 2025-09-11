import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebase";
import Button from "../components/Button";
import Input from "../components/Input";
import HelpModal from "../components/HelpModal"; // novo componente
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [classCode, setClassCode] = useState("");
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false); // controla o modal

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("Usuário logado:", userCredential.user);

      localStorage.setItem("codigoTurma", classCode);
      navigate("/dashboard");
    } catch (err) {
      console.error("Erro ao logar:", err);
      setError("Erro ao logar. Verifique email e senha.");
    }
  };

  const handleEscolherTime = () => {
    navigate("/escolher-time");
  };

  const handleAjudaLogin = () => {
    setShowModal(true);
  };

  return (
    <div className="login-wrapper">
      <div className="login-side">
        {/* Aqui você pode manter o WelcomeMessage se quiser que apareça automaticamente */}
      </div>

      <div className="login-container">
        <form onSubmit={handleLogin} className="login-form">
          <img src="/logoepes.png" alt="Logo EPES" className="login-logo" />
         

          {error && <p className="login-error">{error}</p>}

          <Input 
            type="email" 
            placeholder="E-mail" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input 
            type="password" 
            placeholder="Senha" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
          />

          <Input 
            type="text" 
            placeholder="Código da turma" 
            value={classCode} 
            onChange={(e) => setClassCode(e.target.value)}
          />

          <div className="login-buttons">
            <Button type="submit" className="btn-primary">
              Entrar no jogo
            </Button>
            <Button type="button" className="btn-secondary" onClick={handleEscolherTime}>
              Novo Cadastro
            </Button>
          </div>

          <Button type="button" className="btn-help" onClick={handleAjudaLogin}>
            Ajuda no Login
          </Button>

          <footer className="login-footer">
            <a href="#">Política</a>
            <a href="#">Acessibilidade</a>
          </footer>
        </form>
      </div>

      {showModal && <HelpModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
