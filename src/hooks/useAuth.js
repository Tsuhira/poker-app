import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithCustomToken } from "firebase/auth";
import { auth } from "../lib/firebase.js";

export function useAuth() {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    // くまアプリから kumaToken 付きで遷移してきた場合はカスタムトークンでサインイン
    const params = new URLSearchParams(window.location.search);
    const kumaToken = params.get("kumaToken");
    if (kumaToken) {
      window.history.replaceState({}, "", window.location.pathname);
      signInWithCustomToken(auth, kumaToken).catch(console.error);
    }

    return onAuthStateChanged(auth, setUser);
  }, []);

  return { user, loading: user === undefined };
}
