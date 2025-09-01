import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Card from './Card';
import Button from '../components/Button';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../services/firebase';

interface Attribute {
  name: string;
  value: number;
  max: number;
}

interface HomeProps {
  onFinish: () => void;
}

interface DadosFirebase {
  usuario: {
    nome: string;
    email: string;
    papel: string;
  };
  jogador: {
    pontuacao: number;
    posicao: number;
  };
  relatorio: {
    resumo: string[];
  };
  time?: {
    nome: string;
    pontuacao: number;
    membros: { nome: string; email: string; status: string }[];
  };
}
const Home: React.FC<HomeProps> = ({ onFinish }) => {
  const seedBalance = 100;
  const uid = 'MPUDV05GVNg2yHS526JscZBsfqG3'; // substitua pelo UID real

  const [attributes, setAttributes] = useState<Attribute[]>([
    { name: 'Quality', value: 0, max: 50 },
    { name: 'Capacity', value: 0, max: 50 },
    { name: 'CX', value: 0, max: 50 },
    { name: 'Marketing', value: 0, max: 50 },
  ]);

  const [remainingBalance, setRemainingBalance] = useState(seedBalance);
  const [dados, setDados] = useState<DadosFirebase | null>(null);

  useEffect(() => {
    const totalAllocated = attributes.reduce((sum, attr) => sum + attr.value, 0);
    setRemainingBalance(seedBalance - totalAllocated);
  }, [attributes]);

  useEffect(() => {
    async function buscarDados(uid: string) {
      const userRef = doc(db, 'users', uid);
      const jogadorRef = doc(db, 'jogadores', uid);
      const relatorioRef = doc(db, 'decisoes', uid);

      const [userSnap, jogadorSnap, relatorioSnap] = await Promise.all([
        getDoc(userRef),
        getDoc(jogadorRef),
        getDoc(relatorioRef)
      ]);

      if (!userSnap.exists() || !jogadorSnap.exists() || !relatorioSnap.exists()) return;

      const usuario = userSnap.data();

      const timesQuery = query(collection(db, 'times'), where('membros', 'array-contains', {
        uid: uid,
        nome: usuario.nome,
        email: usuario.email,
        status: 'aprovado'
      }));

      const timesSnap = await getDocs(timesQuery);
      const timeData = timesSnap.docs[0]?.data();

      setDados({
        usuario: usuario as DadosFirebase['usuario'],
        jogador: jogadorSnap.data() as DadosFirebase['jogador'],
        relatorio: relatorioSnap.data() as DadosFirebase['relatorio'],
        time: timeData as DadosFirebase['time']
      });
    }

    buscarDados(uid);
  }, []);
  const handleSliderChange = (index: number, newValue: number) => {
    const totalOther = attributes.reduce(
      (sum, attr, i) => i !== index ? sum + attr.value : sum,
      0
    );
    if (totalOther + newValue > seedBalance) return;

    const newAttributes = [...attributes];
    newAttributes[index].value = newValue;
    setAttributes(newAttributes);
  };

  const handleSave = () => {
    console.log('Decisões salvas:', attributes);
    onFinish();
  };

  const gerarPDF = async () => {
    const elemento = document.getElementById('relatorio-pdf');
    if (!elemento) return;

    const canvas = await html2canvas(elemento);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('relatorio_gabriela.pdf');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
      {attributes.map((attr, index) => (
        <Card
          key={attr.name}
          title={attr.name}
          className="home-card"
          description={
            <>
              <input
                type="range"
                min={0}
                max={attr.max}
                value={attr.value}
                onChange={(e) => handleSliderChange(index, Number(e.target.value))}
                className="w-full"
              />
              <div style={{
                height: '10px',
                background: '#ddd',
                borderRadius: '5px',
                overflow: 'hidden',
                marginTop: '5px',
                width: '100%'
              }}>
                <div style={{
                  width: `${(attr.value / attr.max) * 100}%`,
                  height: '100%',
                  background: '#10b981'
                }} />
              </div>
              <p style={{ textAlign: 'right', margin: '0.25rem 0 0 0' }}>
                {attr.value} / {attr.max}
              </p>
            </>
          }
        />
      ))}
      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Button
          className="btn-primary"
          onClick={handleSave}
          disabled={remainingBalance < 0}
        >
          Salvar Decisões e Avançar
        </Button>
        <Button
          className="btn-secondary"
          onClick={gerarPDF}
        >
          📥 Gerar PDF
        </Button>
        {remainingBalance < 0 && (
          <p style={{ color: 'red', marginTop: '0.5rem' }}>Saldo insuficiente!</p>
        )}
      </div>

      {dados && (
        <div
          id="relatorio-pdf"
          style={{
            marginTop: '3rem',
            padding: '20px',
            width: '100%',
            maxWidth: '600px',
            background: '#f9f9f9',
            borderRadius: '8px',
            boxShadow: '0 0 10px rgba(0,0,0,0.05)'
          }}
        >
          <h2 style={{ textAlign: 'center' }}>📊 Relatório de Decisões</h2>
          <p><strong>Data de geração:</strong> {new Date().toLocaleString("pt-BR")}</p>
          <p><strong>Usuário:</strong> {dados.usuario.nome}</p>
          <p><strong>Email:</strong> {dados.usuario.email}</p>
          <p><strong>Papel:</strong> {dados.usuario.papel}</p>
          <p><strong>Saldo Inicial:</strong> {seedBalance}</p>
          <p><strong>Saldo Restante:</strong> {remainingBalance}</p>

          <h3 style={{ marginTop: '1rem' }}>🔧 Atributos Alocados</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#eee' }}>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>Atributo</th>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>Valor</th>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>Máximo</th>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>% do saldo</th>
              </tr>
            </thead>
            <tbody>
              {attributes.map((attr, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f7f7f7" }}>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>{attr.name}</td>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>{attr.value}</td>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>{attr.max}</td>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                    {((attr.value / seedBalance) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: '1.5rem' }}>🏆 Ranking</h3>
          <p><strong>Posição:</strong> {dados.jogador.posicao}º lugar</p>
          <p><strong>Pontuação Total:</strong> {dados.jogador.pontuacao} pontos</p>

          <h3 style={{ marginTop: '1.5rem' }}>📝 Relatório</h3>
          <ul style={{ paddingLeft: '20px' }}>
            {dados.relatorio.resumo.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>

          {dados.time && (
            <>
              <h3 style={{ marginTop: '1.5rem' }}>👥 Informações do Time</h3>
              <p><strong>Nome do Time:</strong> {dados.time.nome}</p>
              <p><strong>Pontuação do Time:</strong> {dados.time.pontuacao}</p>

              <h4 style={{ marginTop: '1rem' }}>Membros</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#eee' }}>
                    <th style={{ border: '1px solid #ccc', padding: '8px' }}>Nome</th>
                    <th style={{ border: '1px solid #ccc', padding: '8px' }}>Email</th>
                    <th style={{ border: '1px solid #ccc', padding: '8px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.time.membros.map((m, i) => (
                    <tr key={i}>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>{m.nome}</td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>{m.email}</td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>{m.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
