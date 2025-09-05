import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../services/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import "./EscolherTime.css";

export default function EscolherTime() {
  const [modo, setModo] = useState<"criar" | "ingressar" | "responsavel">("ingressar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nomeTime, setNomeTime] = useState("");
  const [mensagem, setMensagem] = useState("");
  const navigate = useNavigate();

  const handleCriar = async () => {
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, senha);
      const uid = userCred.user.uid;

      await setDoc(doc(db, "times", codigo), {
        id: codigo,
        nome: nomeTime,
        criadoPor: uid,
        membros: [{ uid, nome, email, status: "aprovado" }],
      });

      await setDoc(doc(db, "users", uid), {
        nome,
        email,
        papel: "capitao",
      });

      await setDoc(doc(db, "jogadores", uid), {
        nome,
        email,
      });

      navigate("/dashboard");
    } catch (err) {
      setMensagem("❌ Erro ao criar time. Verifique os dados.");
    }
  };

  const handleIngressar = async () => {
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, senha);
      const uid = userCred.user.uid;

      const timeRef = doc(db, "times", codigo);
      const snapshot = await getDoc(timeRef);

      if (!snapshot.exists()) {
        setMensagem("❌ Turma não encontrada.");
        return;
      }

      const dados = snapshot.data();
      const membros = dados.membros || [];

      const nomeJaExiste = membros.some(
        (m: any) => m.nome.trim().toLowerCase() === nome.trim().toLowerCase()
      );
      if (nomeJaExiste) {
        setMensagem("⚠️ Já existe um jogador com esse nome no time.");
        return;
      }

      await setDoc(timeRef, {
        ...dados,
        membros: [...membros, {
          uid,
          nome,
          email,
          status: "pending",
        }],
      });

      await setDoc(doc(db, "users", uid), {
        nome,
        email,
        papel: "membro",
      });

      await setDoc(doc(db, "jogadores", uid), {
        nome,
        email,
      });

      setMensagem("✅ Solicitação enviada! Aguarde aprovação.");
    } catch (err) {
      setMensagem("❌ Erro ao ingressar. Verifique os dados.");
    }
  };

  const handleEntrarComoResponsavel = async () => {
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, senha);
      const uid = userCred.user.uid;

      const userRef = doc(db, "users", uid);
      const snapshot = await getDoc(userRef);
      const dados = snapshot.data();

      if (dados?.papel === "responsavel") {
        await setDoc(doc(db, "users", uid), {
          nome,
          email,
          papel: "responsavel",
        }, { merge: true });

        navigate("/painel-responsavel");
      } else {
        setMensagem("❌ Você não tem permissão para acessar o painel do Responsável.");
      }
    } catch (err) {
      setMensagem("❌ Erro ao fazer login como Responsável.");
    }
  };

  const handleSair = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <div className="container-escolher-time">
      <div className="mensagem-explicativa">
        <p>
          👋 <strong>Bem-vindo!</strong><br /><br />
          Aqui você pode <strong>criar um novo time</strong>, <strong>solicitar ingresso em um time existente</strong> ou <strong>acessar o painel como Responsável</strong>.<br /><br />
          ✨ <strong>Criar Time:</strong> Para criar um time, cadastre-se com e-mail e senha. O código do time será usado pelos colegas para ingressar. Quem cria o time se torna o capitão.<br /><br />
          📥 <strong>Ingressar em um Time:</strong> Informe o código da turma e envie sua solicitação. O Responsável da turma irá aprovar ou recusar seu ingresso.<br /><br />
          🛡️ <strong>Responsável:</strong> Use seu login para acessar o painel exclusivo. É quem libera as rodadas e aprova os jogadores que desejam entrar.<br /><br />
          ✅ <strong>Dica:</strong> Escolha com atenção seu nome e código, pois serão usados para identificar sua equipe durante toda a simulação.
        </p>
      </div>

      <div className="card">
        <h2>👥 Criar ou Ingressar em um Time</h2>

        <div className="tabs">
          <button className={modo === "ingressar" ? "active" : ""} onClick={() => setModo("ingressar")}>🚪 Ingressar</button>
          <button className={modo === "criar" ? "active" : ""} onClick={() => setModo("criar")}>✨ Criar</button>
          <button className={modo === "responsavel" ? "active" : ""} onClick={() => setModo("responsavel")}>🛡️ Responsável</button>
        </div>

        {modo === "criar" && (
          <>
            <input type="text" placeholder="👤 Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
            <input type="email" placeholder="📧 E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" placeholder="🔒 Senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
            <input type="text" placeholder="🏷️ Nome do time" value={nomeTime} onChange={(e) => setNomeTime(e.target.value)} />
            <input type="text" placeholder="🔑 Código da turma" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            <button onClick={handleCriar}>🚀 Criar Time</button>
          </>
        )}

        {modo === "ingressar" && (
          <>
            <input type="text" placeholder="👤 Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
            <input type="email" placeholder="📧 E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" placeholder="🔒 Senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
            <input type="text" placeholder="🔑 Código da turma" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            <button onClick={handleIngressar}>📥 Solicitar Ingresso</button>
          </>
        )}

        {modo === "responsavel" && (
          <>
            <h3>🧪 IMULADOR EPES</h3>
            <input type="text" placeholder="👤 Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
            <input type="email" placeholder="📧 E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" placeholder="🔒 Senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
            <button onClick={handleEntrarComoResponsavel}>🛡️ Entrar como Responsável</button>
          </>
        )}

        {mensagem && <p className="mensagem">{mensagem}</p>}

        <button className="btn-sair" onClick={handleSair}>🔙 Sair</button>
      </div>
    </div>
  );
}
