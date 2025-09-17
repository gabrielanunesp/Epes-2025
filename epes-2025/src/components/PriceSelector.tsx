import React from "react";

interface Props {
  precoBase: number;
  precoEscolhido: number;
  setPrecoEscolhido: (valor: number) => void;
}

const PriceSelector: React.FC<Props> = ({ precoBase, precoEscolhido, setPrecoEscolhido }) => {
  const precoMin = precoBase * 0.8;
  const precoMax = precoBase * 1.2;
  const foraDaFaixa = precoEscolhido < precoMin || precoEscolhido > precoMax;

  return (
    <div className="card">
      <h2>💲 Preço do Produto</h2>
      <input
        type="number"
        value={precoEscolhido}
        min={precoMin}
        max={precoMax}
        step={1}
        onChange={e => setPrecoEscolhido(Number(e.target.value))}
      />
      <p>
        Faixa permitida: R$ {precoMin.toFixed(2)} – R$ {precoMax.toFixed(2)}
      </p>
      {foraDaFaixa && (
        <p style={{ color: "red", fontWeight: "bold" }}>
          ⚠️ Preço fora da faixa permitida!
        </p>
      )}
    </div>
  );
};

export default PriceSelector;
