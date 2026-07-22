// Data-access layer for The Reading Log.
// This is the module the React app's next revision will import from —
// it swaps the current in-memory useState logic for real Firestore reads/writes.
// Every function here maps 1:1 to something the current prototype already does
// with local state, so wiring it in should mostly be a find-and-replace job.

import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  query, where, onSnapshot, serverTimestamp, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db } from "./firebase";

// ---------- Students ----------

// Creates the student doc the first time this device is seen for this class.
export async function ensureStudentDoc(studentId, name, classId) {
  await setDoc(doc(db, "students", studentId), { name, classId, createdAt: serverTimestamp() }, { merge: true });
}

export function subscribeStudents(classId, callback) {
  const q = query(collection(db, "students"), where("classId", "==", classId));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

// The "someday" list lives as an array field on the student's own doc,
// so no separate collection is needed for it.
export async function addToSomeday(studentId, bookId) {
  return updateDoc(doc(db, "students", studentId), { someday: arrayUnion(bookId) });
}
export async function removeFromSomeday(studentId, bookId) {
  return updateDoc(doc(db, "students", studentId), { someday: arrayRemove(bookId) });
}

// ---------- Reading log ----------

export function subscribeReadingLog(classId, callback) {
  const q = query(collection(db, "readingLog"), where("classId", "==", classId));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function addLogEntry(studentId, classId, { title, author, genre, dateStarted, isbn, cover }) {
  return addDoc(collection(db, "readingLog"), {
    studentId, classId, title, author, genre,
    isbn: isbn || null, cover: cover || null,
    dateStarted, dateFinished: null, dateAbandoned: null,
    status: "reading", rating: null, review: null, reason: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export async function finishEntry(entryId, { dateFinished, rating, review }) {
  return updateDoc(doc(db, "readingLog", entryId), {
    status: "finished", dateFinished, rating, review, updatedAt: serverTimestamp(),
  });
}

export async function abandonEntry(entryId, { dateAbandoned, reason }) {
  return updateDoc(doc(db, "readingLog", entryId), {
    status: "abandoned", dateAbandoned, reason, updatedAt: serverTimestamp(),
  });
}

export async function editEntry(entryId, updates) {
  return updateDoc(doc(db, "readingLog", entryId), { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteEntry(entryId) {
  return deleteDoc(doc(db, "readingLog", entryId));
}

// ---------- Library ----------

export function subscribeLibraryBooks(classId, callback) {
  const q = query(collection(db, "libraryBooks"), where("classId", "==", classId));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export function subscribeCopies(classId, callback) {
  const q = query(collection(db, "copies"), where("classId", "==", classId));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function addLibraryBook(classId, { title, author, genre, isbn, cover, copies }) {
  const bookRef = await addDoc(collection(db, "libraryBooks"), {
    classId, title, author, genre, isbn: isbn || null, cover: cover || null, createdAt: serverTimestamp(),
  });
  const writes = [];
  for (let i = 0; i < copies; i++) {
    writes.push(addDoc(collection(db, "copies"), {
      bookId: bookRef.id, classId, status: "available", holderStudentId: null, since: null,
    }));
  }
  await Promise.all(writes);
  return bookRef.id;
}

export async function checkOutCopy(copyId, studentId, since) {
  return updateDoc(doc(db, "copies", copyId), { status: "checked_out", holderStudentId: studentId, since });
}

export async function checkInCopy(copyId) {
  return updateDoc(doc(db, "copies", copyId), { status: "available", holderStudentId: null, since: null });
}

// Resets every copy in a class back to available — used by the Teacher View
// "Check In All Copies" button. Caller is responsible for confirming with the user first.
export async function bulkCheckIn(copyDocs) {
  return Promise.all(copyDocs.map((c) => checkInCopy(c.id)));
}

// ---------- Wishlist ----------

export function subscribeWishlist(classId, callback) {
  const q = query(collection(db, "wishlist"), where("classId", "==", classId));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function addWishlistRequest(classId, title, author, studentId) {
  return addDoc(collection(db, "wishlist"), {
    classId, title, author, votes: [studentId], createdAt: serverTimestamp(),
  });
}

export async function voteWishlist(wishId, studentId) {
  return updateDoc(doc(db, "wishlist", wishId), { votes: arrayUnion(studentId) });
}

// ---------- ISBN lookup (via the Cloudflare Worker, not Open Library directly) ----------

import { ISBN_LOOKUP_URL } from "./firebase";

export async function lookupISBN(isbn) {
  const clean = isbn.replace(/[^0-9Xx]/g, "");
  if (!clean) return null;
  const res = await fetch(`${ISBN_LOOKUP_URL}/?isbn=${clean}`);
  if (!res.ok) throw new Error("lookup failed");
  const data = await res.json();
  if (!data.found) return null;
  return { title: data.title, author: data.author, cover: data.cover, isbn: clean, subjects: data.subjects };
}
