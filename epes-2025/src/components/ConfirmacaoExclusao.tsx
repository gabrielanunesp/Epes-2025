import { useState } from "react";
import {
  getAuth,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import type { User } from "firebase/auth"; // ✅ Correto para tipagem

import {
  getFirestore,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

interface Props {
  tipo: "time" | "membro";
  item: { id: string; nome: string; uid?: string };
  timeId?: string;
  onConfirmado: () => void;
  onCancelado: () => void;
}

export default function ConfirmacaoExclusao({
  tipo,
  item,
  timeId,
  onConfirmado,
  onCancelado,
}: Props) {
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const auth = getAuth();
  const db = getFirestore();

  const confirmar = async () => {
    setCarregando(true);
    const user: User | null = auth.currentUser;

    if (!user || !user.email) {
      alert("⚠️ Usuário não autenticado ou sem e-mail válido.");
      setCarregando(false);
      return;
    }

    const credencial = EmailAuthProvider.credential(user.email, senha);

    try {
      await reauthenticateWithCredential(user, credencial);

      if (tipo === "time") {
        await deleteDoc(doc(db, "times", item.id));
      } else if (tipo === "membro" && timeId) {
        const timeRef = doc(db, "times", timeId);
        const snapshot = await getDoc(timeRef);
        const dados = snapshot.data();

        if (!dados || !Array.isArray(dados.membros)) {
          throw new Error("Dados do time inválidos.");
        }

        const membrosAtualizados = dados.membros.filter((m: any) => m.uid !== item.uid);
        await updateDoc(timeRef, { membros: membrosAtualizados });
      }

      onConfirmado();
    } catch (error: any) {
      console.error("Erro na exclusão:", error);
      alert("❌ Senha incorreta ou erro na exclusão.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="modal-confirmacao">
      <h3>⚠️ Confirmar Exclusão</h3>
      <p>
        Você está prestes a excluir{" "}
        {tipo === "time" ? `o time "${item.nome}"` : `o jogador "${item.nome}"`}.
      </p>
      <p>Digite sua senha de login para confirmar:</p>
      <input
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="Senha do responsável"
        style={{ padding: "8px", width: "100%", marginBottom: "10px" }}
      />
      <div>
        <button onClick={confirmar} disabled={carregando}>
          🗑️ Confirmar
        </button>
        <button onClick={onCancelado} style={{ marginLeft: "10px" }}>
          ❌ Cancelar
        </button>
      </div>
    </div>
  );
}
