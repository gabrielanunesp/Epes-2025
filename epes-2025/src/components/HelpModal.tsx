import React from "react";
import "./HelpModal.css";

interface HelpModalProps {
  onClose: () => void;
}

export default function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>×</button>
        <p>
          👋 <strong>Seja bem-vindo ao Simulador EPES!</strong><br /><br />
          Esta é a tela de login antes da experiência começar.  
          Se for sua primeira vez, crie um cadastro — ele será seu acesso ao jogo.<br /><br />
          Você pode <strong>criar um time</strong> e se tornar Capitão automaticamente,  
          ou <strong>ingressar em um time</strong> usando o ID que o Capitão definiu.<br /><br />
          No botão do card de login, você será levado à página de cadastro com essas duas opções.<br /><br />
          Decida com sabedoria e prepare-se para os desafios!
        </p>
      </div>
    </div>
  );
}
