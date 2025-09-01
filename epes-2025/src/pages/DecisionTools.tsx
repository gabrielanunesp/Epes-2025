import React, { useState, useEffect } from 'react';

const RelogioComRodada = () => {
  const [tempoRestante, setTempoRestante] = useState<number>(0);
  const [rodadaAtual, setRodadaAtual] = useState<number>(1);
  const [mensagem, setMensagem] = useState<string>('');

  useEffect(() => {
    const calcularTempoRestante = () => {
      const agora = new Date();
      const fimDoDia = new Date();
      fimDoDia.setHours(23, 59, 0, 0); // 23:59:00

      const diferenca = Math.max(0, Math.floor((fimDoDia.getTime() - agora.getTime()) / 1000));
      setTempoRestante(diferenca);
    };

    calcularTempoRestante(); // inicializa

    const intervalo = setInterval(() => {
      setTempoRestante((prev) => {
        if (prev <= 1) {
          clearInterval(intervalo);
          setMensagem('⏰ Tempo esgotado!');
          setTimeout(() => {
            setRodadaAtual((r) => r + 1);
            setMensagem(`✅ Próxima rodada iniciada: Rodada ${rodadaAtual + 1}`);
            calcularTempoRestante(); // reinicia o tempo
          }, 2000); // espera 2 segundos antes de avançar
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalo);
  }, [rodadaAtual]);

  const formatarTempo = (segundos: number) => {
    const horas = Math.floor(segundos / 3600).toString().padStart(2, '0');
    const minutos = Math.floor((segundos % 3600) / 60).toString().padStart(2, '0');
    const segundosRestantes = (segundos % 60).toString().padStart(2, '0');
    return `${horas}:${minutos}:${segundosRestantes}`;
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', textAlign: 'center' }}>
      <h2>🕒 Rodada {rodadaAtual}</h2>
      <div style={{
        fontSize: '48px',
        backgroundColor: '#000',
        color: '#0f0',
        padding: '20px',
        borderRadius: '12px',
        width: '250px',
        margin: '0 auto',
        boxShadow: '0 0 10px #0f0',
      }}>
        {tempoRestante > 0 ? formatarTempo(tempoRestante) : mensagem}
      </div>
    </div>
  );
};

export default RelogioComRodada;
