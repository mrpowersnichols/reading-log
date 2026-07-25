import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "firebase/auth";

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

// TODO: verify this is actually the domain on students' Google accounts —
// some schools issue student email on a subdomain (e.g. students.nicholsschool.org)
// rather than the main domain. Check a real student's email address before
// relying on this for real classes.
export const SCHOOL_DOMAIN = "nicholsschool.org";

const provider = new GoogleAuthProvider();
// This just pre-filters which accounts Google's picker shows — it's a
// convenience hint, not real enforcement. The actual enforcement is the
// email-domain check below, plus the matching check in firestore.rules.
provider.setCustomParameters({ hd: SCHOOL_DOMAIN });

// Opens the Google sign-in popup. Throws if the signed-in account isn't on
// the school domain (and signs them back out so they're not left in a
// half-signed-in state).
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  const email = result.user.email || "";
  if (!email.toLowerCase().endsWith("@" + SCHOOL_DOMAIN)) {
    await signOut(auth);
    throw new Error(`Please sign in with your school account (@${SCHOOL_DOMAIN}).`);
  }
  return result.user;
}

export function signOutUser() {
  return signOut(auth);
}

// Calls callback(user) whenever auth state changes — user is null when
// signed out. Returns an unsubscribe function.
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

// Deployed ISBN-lookup Cloudflare Worker.
export const ISBN_LOOKUP_URL = "https://isbn-lookup.gpowers.workers.dev";
