import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA9mEhEtHDO8OimeZ02uatGkzCUhNaNzD4",
  authDomain: "logandlibrarynichols.firebaseapp.com",
  projectId: "logandlibrarynichols",
  storageBucket: "logandlibrarynichols.firebasestorage.app",
  messagingSenderId: "967150369201",
  appId: "1:967150369201:web:73472b1bbc67b8bfcba590",
  measurementId: "G-48SVTNBYEP",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Silently signs the current device in anonymously and resolves with the UID.
// Call this once when the app loads, before any Firestore reads/writes.
export function ensureSignedIn() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        resolve(user.uid);
      } else {
        signInAnonymously(auth)
          .then((cred) => resolve(cred.user.uid))
          .catch(reject);
      }
    });
  });
}

// Deployed ISBN-lookup Cloudflare Worker.
export const ISBN_LOOKUP_URL = "https://isbn-lookup.gpowers.workers.dev";

