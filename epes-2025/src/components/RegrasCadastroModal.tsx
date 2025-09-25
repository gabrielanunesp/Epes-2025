import React from "react";
import "./RegrasCadastroModal.css";

interface Props {
  onClose: () => void;
}

export default function RegrasCadastroModal({ onClose }: Props) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-close" onClick={onClose}>×</div>
        <h2 className="modal-title">📋 Regras para Cadastro</h2>
        <ul>
          <li>✅ Todos os campos são obrigatórios</li>
          <li>🔒 A senha deve conter exatamente <strong>6 dígitos numéricos</strong></li>
          <li>🏷️ O nome do time deve começar com <strong>"Time "</strong> (ex: Time Falcões)</li>
          <li>🔑 A senha pode ser igual ou diferente do código da turma</li>
          <p style={{ marginTop: "1rem", fontWeight: "bold", color: "#444" }}>
  📌 Guarde o <strong>código da turma</strong> com atenção! Ele é essencial para fazer login como capitão e para que os jogadores da sua equipe consigam ingressar no time.
</p>
        </ul>
      </div>
    </div>
  );
}
