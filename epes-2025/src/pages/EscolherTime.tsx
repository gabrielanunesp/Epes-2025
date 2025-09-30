import React, { useState, useEffect } from "react";
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
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { runTransaction } from "firebase/firestore";
import AjudaModal from "../components/AjudaModal";
import RegrasCadastroModal from "../components/RegrasCadastroModal";
import "./EscolherTime.css";

const gerarCodigoUnico = async (): Promise<string> => {
  let codigo: string = "";
  let existe = true;

  while (existe) {
    codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const docRef = doc(db, "times", codigo);
    const snapshot = await getDoc(docRef);
    existe = snapshot.exists();
  }

  return codigo;
};



export default function EscolherTime() {
  const [modo, setModo] = useState<"criar" | "ingressar" | "responsavel">("ingressar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nomeTime, setNomeTime] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [showAjuda, setShowAjuda] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState(false);
  const [showRegras, setShowRegras] = useState(false);


  const navigate = useNavigate();

  useEffect(() => {
  const gerar = async () => {
    if (modo === "criar" && codigo === "") {
      const novoCodigo = await gerarCodigoUnico();
      console.log("🔢 Código gerado:", novoCodigo);
      setCodigo(novoCodigo);
    }
  };
  gerar();
}, [modo, codigo]);


  const camposPreenchidos = (...valores: string[]) => {
    return valores.every((v) => v.trim() !== "");
  };

 const handleCriar = async () => {
  if (!camposPreenchidos(nome, email, senha, nomeTime, codigo)) {
    setMensagem("⚠️ Preencha todos os campos antes de criar o time.");
    return;
  }

  console.log("📡 Iniciando criação de usuário...");
  console.log("📧 E-mail:", email);
  console.log("🔑 Senha:", senha);

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, senha);
    console.log("✅ Usuário criado com sucesso:", userCred.user.uid);

    const uid = userCred.user.uid;

    // 🔐 Grava os dados no Firestore
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

    // 💾 Salva dados localmente
    localStorage.setItem("idDoTime", codigo);
    localStorage.setItem("codigoTurma", codigo);
    localStorage.setItem("nomeDoTime", nomeTime);
    localStorage.setItem("papel", "capitao");

    // 🚀 Redireciona para o dashboard
    navigate("/dashboard");
  } catch (err: any) {
    console.log("🔥 Erro na criação do usuário:", err.code, err.message);

    if (err.code === "auth/email-already-in-use") {
      setMensagem("❌ Este e-mail já está em uso. Tente outro ou faça login.");
    } else if (err.code === "auth/invalid-email") {
      setMensagem("❌ E-mail inválido. Verifique o formato.");
    } else if (err.code === "auth/weak-password") {
      setMensagem("❌ Senha fraca. Use pelo menos 6 caracteres.");
    } else if (err.code === "auth/network-request-failed") {
      setMensagem("❌ Falha de rede. Verifique sua conexão com a internet.");
    } else if (err.code === "auth/operation-not-allowed") {
      setMensagem("❌ Método de login não permitido. Verifique se 'E-mail/senha' está ativado.");
    } else {
      setMensagem(`❌ Erro inesperado: ${err.message || "Verifique os dados ou tente novamente."}`);
    }
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


// ✅ Aguarda autenticação estar ativa
await new Promise((resolve) => {
  const unsubscribe = auth.onAuthStateChanged((user) => {
    if (user) {
      console.log("✅ Usuário autenticado:", user.uid);
      unsubscribe();
      resolve(null);
    }
  });
});


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

const novoMembro = { uid, nome, email, status: "pending" };

// Garante que o campo membros existe
if (!dados.membros) {
  await updateDoc(timeRef, {
    membros: [],
  });
}

// Adiciona o novo membro com segurança
await updateDoc(timeRef, {
  membros: arrayUnion(novoMembro),
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
    } catch (err: any) {
  console.log("🔥 Erro ao ingressar:", err.code, err.message);

  if (err.code === "auth/email-already-in-use") {
    setMensagem("❌ Este e-mail já está em uso. Tente outro ou faça login.");
  } else if (err.code === "auth/invalid-email") {
    setMensagem("❌ E-mail inválido. Verifique o formato.");
  } else if (err.code === "auth/weak-password") {
    setMensagem("❌ Senha fraca. Use pelo menos 6 caracteres.");
  } else if (err.code === "auth/network-request-failed") {
    setMensagem("❌ Falha de rede. Verifique sua conexão com a internet.");
  } else {
    setMensagem(`❌ Erro inesperado: ${err.message || "Verifique os dados ou tente novamente."}`);
  }
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
      <button className="btn-ajuda" onClick={() => setShowRegras(true)}>📋 Regras</button>
      {showAjuda && <AjudaModal onClose={() => setShowAjuda(false)} />}
        {showRegras && <RegrasCadastroModal onClose={() => setShowRegras(false)} />}


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
            <div className="campo-senha">
  <input
    type={mostrarSenha ? "text" : "password"}
    placeholder="🔒 Senha"
    value={senha}
    onChange={(e) => setSenha(e.target.value)}
  />
  <button
    type="button"
    className="btn-ver-senha"
    onClick={() => setMostrarSenha(!mostrarSenha)}
  >
    {mostrarSenha ? "🙈 Ocultar" : "👁️ Mostrar"}
  </button>
</div>

            <input type="text" placeholder="🏷️ Nome do time" value={nomeTime} onChange={(e) => setNomeTime(e.target.value)} />
            <p className="codigo-gerado">🔢 Código gerado: {codigo}</p>
            <input type="text" placeholder="🔑 Código da turma" value={codigo} disabled />
            <button onClick={handleCriar}>🚀 Criar Time</button>
          </>
        )}

        {modo === "ingressar" && (
          <>
            <input type="text" placeholder="👤 Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
            <input type="email" placeholder="📧 E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="campo-senha">
  <input
    type={mostrarSenha ? "text" : "password"}
    placeholder="🔒 Senha"
    value={senha}
    onChange={(e) => setSenha(e.target.value)}
  />
  <button
    type="button"
    className="btn-ver-senha"
    onClick={() => setMostrarSenha(!mostrarSenha)}
  >
    {mostrarSenha ? "🙈 Ocultar" : "👁️ Mostrar"}
  </button>
</div>

            <input type="text" placeholder="🔑 Código da turma" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            <button onClick={handleIngressar}>📥 Solicitar Ingresso</button>
          </>
        )}

        {modo === "responsavel" && (
          <>
            <h3> SOMENTE ADM </h3>
            <input type="text" placeholder="👤 Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
            <input type="email" placeholder="📧 E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="campo-senha">
  <input
    type={mostrarSenha ? "text" : "password"}
    placeholder="🔒 Senha"
    value={senha}
    onChange={(e) => setSenha(e.target.value)}
  />
  <button
    type="button"
    className="btn-ver-senha"
    onClick={() => setMostrarSenha(!mostrarSenha)}
  >
    {mostrarSenha ? "🙈 Ocultar" : "👁️ Mostrar"}
  </button>
</div>

            <button onClick={handleEntrarComoResponsavel}>🛡️ Entrar como Responsável</button>
          </>
        )}

        {mensagem && <p className="mensagem">{mensagem}</p>}

        <button className="btn-sair" onClick={handleSair}>🔙 Sair</button>
      </div>
    </div>
  );
}


















