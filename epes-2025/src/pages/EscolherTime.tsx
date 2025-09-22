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
import AjudaModal from "../components/AjudaModal";
import "./EscolherTime.css";

export default function EscolherTime() {
  const [modo, setModo] = useState<"criar" | "ingressar" | "responsavel">("ingressar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nomeTime, setNomeTime] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [showAjuda, setShowAjuda] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState(false);

  const navigate = useNavigate();

  const camposPreenchidos = (...valores: string[]) => {
    return valores.every((v) => v.trim() !== "");
  };

  const handleCriar = async () => {
    if (!camposPreenchidos(nome, email, senha, nomeTime, codigo)) {
      setMensagem("⚠️ Preencha todos os campos antes de criar o time.");
      return;
    }

    try {
      const configRef = doc(db, "configuracoes", "geral");
      const configSnap = await getDoc(configRef);

      if (!configSnap.exists()) {
        setErroCarregamento(true);
        return;
      }

      if (configSnap.data()?.cadastroBloqueado) {
        setMensagem("🚫 Cadastro de novos times está bloqueado após a primeira rodada.");
        return;
      }

      const userCred = await createUserWithEmailAndPassword(auth, email, senha);
      const uid = userCred.user.uid;

      await setDoc(doc(db, "times", codigo), {
        id: codigo,
        nome: nomeTime,
        criadoPor: uid,
        membros: [{ uid, nome, email, status: "aprovado" }],
      });

      localStorage.setItem("idDoTime", codigo);
      localStorage.setItem("codigoTurma", codigo);
      localStorage.setItem("nomeDoTime", nomeTime);
      localStorage.setItem("papel", "capitao");

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
      const configRef = doc(db, "configuracoes", "geral");
      const configSnap = await getDoc(configRef);

      if (!configSnap.exists()) {
        setErroCarregamento(true);
        return;
      }

      if (configSnap.data()?.cadastroBloqueado) {
        setMensagem("🚫 Cadastro de novos times está bloqueado após a primeira rodada.");
        return;
      }

      const userCred = await createUserWithEmailAndPassword(auth, email, senha);
      const uid = userCred.user.uid;
      localStorage.setItem("uid", uid);

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
        membros: [...membros, { uid, nome, email, status: "pending" }],
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
        localStorage.setItem("papel", "responsavel");
        localStorage.setItem("uid", uid);
        localStorage.setItem("nome", dados.nome ?? nome);
        localStorage.setItem("email", dados.email ?? email);

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
  localStorage.clear(); // 🔥 limpa todos os dados da sessão anterior
  navigate("/login");   // ✅ redireciona para a tela de login
};

  return (
    <div className="container-escolher-time">
      <button className="btn-ajuda" onClick={() => setShowAjuda(true)}>❓ Ajuda</button>
      {showAjuda && <AjudaModal onClose={() => setShowAjuda(false)} />}

      {erroCarregamento && (
        <div className="erro-carregamento">
          ⚠️ Não foi possível carregar os dados iniciais. Verifique sua conexão ou tente novamente mais tarde.
        </div>
      )}

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
            <h3> SOMENTE ADM </h3>
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
