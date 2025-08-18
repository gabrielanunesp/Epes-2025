import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCu5icuhGn-FWiA0ecT2bokRRxnD2BE90w",
  authDomain: "epes-challenge-2025.firebaseapp.com",
  projectId: "epes-challenge-2025",
  storageBucket: "epes-challenge-2025.appspot.com", // corrigido
  messagingSenderId: "494996795526",
  appId: "1:494996795526:web:4e4ba179f398acf2de6107",
  measurementId: "G-9W918W8161"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
