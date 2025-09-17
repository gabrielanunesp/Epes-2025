import React from "react";

interface Props {
  custoUpgrades: number;
  limiteUpgrades: number;
}

const UpgradeLimitBar: React.FC<Props> = ({ custoUpgrades, limiteUpgrades }) => {
  const excedido = custoUpgrades > limiteUpgrades;

  return (
    <div style={{ margin: "1rem 0" }}>
      <label><strong>Uso do limite de upgrades:</strong></label>
      <progress
        value={custoUpgrades}
        max={limiteUpgrades}
        style={{
          width: "100%",
          height: "20px",
          backgroundColor: "#eee",
          borderRadius: "5px",
        }}
      />
      <p style={{ color: excedido ? "red" : "black" }}>
        R$ {custoUpgrades.toFixed(2)} / R$ {limiteUpgrades.toFixed(2)}
        {excedido && " ⚠️ Excedido"}
      </p>
    </div>
  );
};

export default UpgradeLimitBar;
