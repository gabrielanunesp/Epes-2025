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
        papel: "membro",
      });

      navigate("/dashboard");
    } catch (err) {
      setMensagem("❌ Erro ao criar time. Verifique os dados.");
    }
  };

  const handleIngressar = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setMensagem("⚠️ Faça login antes de ingressar.");
        return;
      }

      const timeRef = doc(db, "times", codigo);
      const snapshot = await getDoc(timeRef);

      if (!snapshot.exists()) {
        setMensagem("❌ Time não encontrado.");
        return;
      }

      const dados = snapshot.data();
      const membros = dados.membros || [];

      const jaSolicitou = membros.some((m: any) => m.uid === user.uid);
      if (jaSolicitou) {
        setMensagem("⏳ Solicitação já enviada. Aguarde aprovação.");
        return;
      }

      const nomeJaExiste = membros.some(
        (m: any) => m.nome.trim().toLowerCase() === nome.trim().toLowerCase()
      );
      if (nomeJaExiste) {
        setMensagem("⚠️ Já existe um jogador com esse nome no time. Escolha outro nome.");
        return;
      }

      await setDoc(timeRef, {
        ...dados,
        membros: [...membros, {
          uid: user.uid,
          nome,
          email,
          status: "pending",
        }],
      });

      await setDoc(doc(db, "users", user.uid), {
        nome,
        email,
        papel: "membro",
      }, { merge: true });

      setMensagem("✅ Solicitação enviada! Aguarde aprovação.");
    } catch (err) {
      setMensagem("❌ Erro ao ingressar no time.");
    }
  };

  const handleCadastrarResponsavel = async () => {
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, senha);
      const uid = userCred.user.uid;

      const userRef = doc(db, "users", uid);
      const snapshot = await getDoc(userRef);
      const dados = snapshot.data();

      if (dados?.papel === "responsavel") {
        navigate("/painel-responsavel");
      } else {
        setMensagem("❌ Você não tem permissão para acessar o painel.");
      }
    } catch (err) {
      setMensagem("❌ Erro ao fazer login como responsável.");
    }
  };

  const handleSair = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <div className="card">
      <h2>👥 Criar ou Ingressar em um Time</h2>

      <div className="tabs">
        <button className={modo === "ingressar" ? "active" : ""} onClick={() => setModo("ingressar")}>🚪 Ingressar</button>
        <button className={modo === "criar" ? "active" : ""} onClick={() => setModo("criar")}>✨ Criar</button>
        <button className={modo === "responsavel" ? "active" : ""} onClick={() => setModo("responsavel")}>🛡️ Responsável</button>
      </div>

      <input type="text" placeholder="👤 Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
      <input type="email" placeholder="📧 E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />

      {modo === "criar" && (
        <>
          <input type="password" placeholder="🔒 Senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <input type="text" placeholder="🏷️ Nome do time" value={nomeTime} onChange={(e) => setNomeTime(e.target.value)} />
          <input type="text" placeholder="🔑 Código do time" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          <button onClick={handleCriar}>🚀 Criar Time</button>
        </>
      )}

      {modo === "ingressar" && (
        <>
          <input type="text" placeholder="🔑 Código do time" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          <button onClick={handleIngressar}>📥 Solicitar Ingresso</button>
        </>
      )}

      {modo === "responsavel" && (
        <>
          <input type="password" placeholder="🔒 Senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <button onClick={handleCadastrarResponsavel}>🛡️ Entrar como Responsável</button>
        </>
      )}

      {mensagem && <p className="mensagem">{mensagem}</p>}

      <button className="btn-sair" onClick={handleSair}>🔙 Sair</button>
    </div>
  );
}
