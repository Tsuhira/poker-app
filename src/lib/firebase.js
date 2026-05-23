import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCnz26wUZ-78tDbkmnOiu2HSxxnwrFpztA",
  authDomain: "kuma-6c130.firebaseapp.com",
  projectId: "kuma-6c130",
  storageBucket: "kuma-6c130.firebasestorage.app",
  messagingSenderId: "753252248655",
  appId: "1:753252248655:web:f2b28c34cb40ea3aea8e3a",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
