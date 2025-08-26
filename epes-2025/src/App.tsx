import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Páginas
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DecisionPage from './pages/DecisionsPage';
import RankingPage from './pages/RankingPage';
import EscolherTime from './pages/EscolherTime'; // ✅ nova importação

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <p style={{ textAlign: 'center', marginTop: '2rem' }}>Carregando...</p>;
  }

  return (
    <Router>
      <Routes>
        {/* ✅ Rota de login agora está explícita */}
        <Route path="/login" element={<Login />} />

        {/* ✅ Redireciona para login se não estiver logado */}
        <Route
          path="/"
          element={!user ? <Navigate to="/login" /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/dashboard"
          element={user ? <Dashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/decisoes"
          element={user ? <DecisionPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/ranking"
          element={user ? <RankingPage /> : <Navigate to="/login" />}
        />
        {/* ✅ Rota liberada para qualquer usuário */}
        <Route path="/escolher-time" element={<EscolherTime />} />
      </Routes>

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
    </Router>
  );
}

export default App;
