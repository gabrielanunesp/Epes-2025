import React from "react";
import "./AjudaModal.css";

interface AjudaModalProps {
  onClose: () => void;
}

export default function AjudaModal({ onClose }: AjudaModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <span
          className="modal-close"
          role="button"
          tabIndex={0}
          onClick={onClose}
          onKeyDown={(e) => e.key === "Enter" && onClose()}
        >
          ×
        </span>
        <h2 className="modal-title">Ajuda para Cadastro</h2>
        <p>
          👋 <strong>Bem-vindo!</strong><br /><br />
          Aqui você pode <strong>criar um novo time</strong>, <strong>solicitar ingresso em um time existente</strong> ou <strong>acessar o painel como Responsável</strong>.<br /><br />
          ✨ <strong>Criar Time:</strong> Para criar um time, cadastre-se com e-mail e senha. O código do time será usado pelos colegas para ingressar. Quem cria o time se torna o capitão.<br /><br />
          📥 <strong>Ingressar em um Time:</strong> Informe o código da turma e envie sua solicitação. O Responsável da turma irá aprovar ou recusar seu ingresso.<br /><br />
          🛡️ <strong>Responsável:</strong> Use seu login para acessar o painel exclusivo. É quem libera as rodadas e aprova os jogadores que desejam entrar.<br /><br />
          ✅ <strong>Dica:</strong> Escolha com atenção seu nome e código, pois serão usados para identificar sua equipe durante toda a simulação.
        </p>
      </div>
    </div>
  );
}

