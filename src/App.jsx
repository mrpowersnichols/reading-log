import React, { useState, useEffect, useMemo } from "react";
import { BookOpen, Plus, Star, X, Library, ListChecks, Users, ChevronRight, BookMarked, RotateCcw, Search, Flag, Barcode, Heart, Pencil, Trash2, Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import { ensureSignedIn } from "./firebase";
import {
  ensureStudentDoc, subscribeStudents, addToSomeday, removeFromSomeday,
  subscribeReadingLog, addLogEntry, finishEntry, abandonEntry, editEntry, deleteEntry,
  subscribeLibraryBooks, subscribeCopies, addLibraryBook as fsAddLibraryBook, checkOutCopy, checkInCopy, bulkCheckIn as fsBulkCheckIn,
  subscribeWishlist, addWishlistRequest, voteWishlist as fsVoteWishlist,
  lookupISBN,
} from "./firestore-data-layer";

// TODO: once you're running more than one class period through this, swap this
// constant for a real class-switcher (e.g. a code students enter, or a
// subdomain/query-param per class). Every Firestore doc is already tagged with
// classId, so the data model doesn't need to change — only this line does.
const CLASS_ID = "default";

// ---------- Design tokens ----------
const STYLES = `
  .rl-root {
    --paper: #EDE6D6;
    --paper-card: #F7F2E6;
    --ink: #2B2E26;
    --ink-soft: #5B5A4E;
    --green: #3F5B4F;
    --green-deep: #2C4239;
    --brass: #A9803F;
    --brass-light: #C9A56A;
    --rust: #A64B2A;
    --line: #C9BFA6;
    font-family: Georgia, 'Times New Roman', serif;
    background: var(--paper);
    color: var(--ink);
    min-height: 100%;
    padding: 0;
  }
  .rl-shell { max-width: 1020px; margin: 0 auto; padding: 28px 20px 60px; }
  .rl-header { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 12px; border-bottom: 3px double var(--green-deep); padding-bottom: 14px; margin-bottom: 4px; }
  .rl-title { font-size: 28px; font-weight: 700; letter-spacing: 0.3px; color: var(--green-deep); }
  .rl-title small { display: block; font-family: 'Courier New', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--brass); margin-top: 2px; }
  .rl-student { font-family: 'Courier New', monospace; font-size: 12px; color: var(--ink-soft); }

  .rl-shelf { display: flex; gap: 6px; margin: 22px 0 24px; border-bottom: 4px solid var(--green-deep); }
  .rl-spine {
    flex: 1; cursor: pointer; border: none; border-top-left-radius: 4px; border-top-right-radius: 4px;
    padding: 14px 6px 10px; font-family: 'Courier New', monospace; font-size: 12px; letter-spacing: 1px;
    text-transform: uppercase; display: flex; flex-direction: column; align-items: center; gap: 6px;
    color: var(--paper-card); background: var(--ink-soft); opacity: 0.55; transition: opacity 0.15s, transform 0.1s;
  }
  .rl-spine:hover { opacity: 0.8; }
  .rl-spine.active { opacity: 1; background: var(--green-deep); transform: translateY(-2px); }
  .rl-spine svg { width: 16px; height: 16px; }

  .rl-note { font-family: 'Courier New', monospace; font-size: 11.5px; color: var(--ink-soft); background: var(--paper-card); border: 1px dashed var(--line); padding: 8px 12px; border-radius: 3px; margin-bottom: 20px; }

  .rl-section-title { display: flex; align-items: center; gap: 8px; font-size: 15px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--green-deep); margin: 26px 0 12px; font-family: 'Courier New', monospace; }
  .rl-section-title .rl-count { background: var(--brass); color: var(--paper-card); font-size: 10px; padding: 1px 7px; border-radius: 10px; }

  .rl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }

  .rl-card {
    background: var(--paper-card); border: 1px solid var(--line); border-left: 5px solid var(--green);
    border-radius: 3px; padding: 12px 14px 12px; box-shadow: 1px 2px 0 rgba(43,46,38,0.05);
  }
  .rl-card.abandoned { border-left-color: var(--rust); opacity: 0.9; }
  .rl-card-body { display: flex; gap: 10px; }
  .rl-cover { width: 44px; height: 64px; object-fit: cover; border: 1px solid var(--line); border-radius: 2px; background: #ddd6c4; flex-shrink: 0; }
  .rl-cover-fallback { width: 44px; height: 64px; flex-shrink: 0; border: 1px solid var(--line); border-radius: 2px; background: var(--green); color: var(--paper-card); display: flex; align-items: center; justify-content: center; font-family: Georgia, serif; font-weight: 700; font-size: 18px; }
  .rl-card-text { flex: 1; min-width: 0; }
  .rl-card-title { font-weight: 700; font-size: 15px; line-height: 1.25; }
  .rl-card-author { font-size: 12.5px; color: var(--ink-soft); margin-top: 1px; }
  .rl-tagrow { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; font-family: 'Courier New', monospace; font-size: 10.5px; color: var(--ink-soft); flex-wrap: wrap; gap: 4px; }
  .rl-genre-tag { background: var(--green); color: var(--paper-card); padding: 2px 7px; border-radius: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
  .rl-reason-tag { background: var(--rust); color: var(--paper-card); padding: 2px 7px; border-radius: 2px; text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px; margin-top: 6px; display: inline-block; }
  .rl-flag { background: var(--rust); color: #fff; font-family: 'Courier New', monospace; font-size: 10px; padding: 3px 7px; border-radius: 2px; margin-top: 8px; display: inline-flex; align-items: center; gap: 4px; }
  .rl-btnrow { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }

  .rl-btn { font-family: 'Courier New', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid var(--green-deep); background: transparent; color: var(--green-deep); padding: 6px 9px; border-radius: 2px; cursor: pointer; display: flex; align-items: center; gap: 5px; }
  .rl-btn:hover { background: var(--green-deep); color: var(--paper-card); }
  .rl-btn.solid { background: var(--green-deep); color: var(--paper-card); }
  .rl-btn.solid:hover { background: var(--green); }
  .rl-btn.rust { border-color: var(--rust); color: var(--rust); }
  .rl-btn.rust:hover { background: var(--rust); color: var(--paper-card); }
  .rl-btn.small { padding: 4px 7px; font-size: 10px; }
  .rl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .rl-btn:disabled:hover { background: transparent; color: var(--green-deep); }

  .rl-stars { display: flex; align-items: center; gap: 2px; margin-top: 8px; }
  .rl-stars span { font-family: 'Courier New', monospace; font-size: 11px; color: var(--brass); margin-left: 4px; }
  .rl-review { font-size: 12.5px; line-height: 1.5; margin-top: 8px; font-style: italic; color: var(--ink); border-top: 1px dotted var(--line); padding-top: 8px; }

  .rl-empty { font-family: 'Courier New', monospace; font-size: 12px; color: var(--ink-soft); padding: 18px; border: 1px dashed var(--line); border-radius: 3px; text-align: center; }

  .rl-overlay { position: fixed; inset: 0; background: rgba(43,46,38,0.45); display: flex; align-items: center; justify-content: center; z-index: 40; padding: 16px; overflow-y: auto; }
  .rl-modal { background: var(--paper-card); border: 1px solid var(--line); border-top: 6px solid var(--green-deep); width: 100%; max-width: 440px; padding: 20px; border-radius: 3px; position: relative; margin: auto; }
  .rl-modal h3 { font-size: 17px; margin-bottom: 12px; color: var(--green-deep); }
  .rl-close { position: absolute; top: 12px; right: 12px; cursor: pointer; color: var(--ink-soft); background: none; border: none; }
  .rl-field { margin-bottom: 12px; }
  .rl-field label { display: block; font-family: 'Courier New', monospace; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ink-soft); margin-bottom: 4px; }
  .rl-field input, .rl-field select, .rl-field textarea { width: 100%; padding: 7px 9px; border: 1px solid var(--line); border-radius: 2px; background: #fff; font-family: Georgia, serif; font-size: 13.5px; color: var(--ink); }
  .rl-field textarea { min-height: 70px; resize: vertical; }
  .rl-isbn-row { display: flex; gap: 6px; }
  .rl-isbn-row input { flex: 1; }
  .rl-isbn-status { font-family: 'Courier New', monospace; font-size: 10.5px; margin-top: 5px; color: var(--ink-soft); }
  .rl-rating-row { display: flex; gap: 4px; flex-wrap: wrap; }
  .rl-rate-pip { width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--brass); background: transparent; color: var(--brass); font-family: 'Courier New', monospace; font-size: 11px; cursor: pointer; }
  .rl-rate-pip.on { background: var(--brass); color: #fff; }

  .rl-lib-recos { background: var(--green-deep); color: var(--paper-card); border-radius: 4px; padding: 14px 16px; margin-bottom: 20px; }
  .rl-lib-recos h4 { font-family: 'Courier New', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--brass-light); margin-bottom: 8px; }
  .rl-reco-list { display: flex; gap: 10px; flex-wrap: wrap; }
  .rl-reco-pill { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.25); padding: 6px 10px; border-radius: 3px; font-size: 12.5px; display: flex; align-items: center; gap: 8px; }

  .rl-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 22px; }
  .rl-stat { background: var(--paper-card); border: 1px solid var(--line); border-radius: 3px; padding: 12px 14px; }
  .rl-stat .num { font-size: 24px; font-weight: 700; color: var(--green-deep); }
  .rl-stat .label { font-family: 'Courier New', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ink-soft); }

  .rl-bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-family: 'Courier New', monospace; font-size: 11.5px; }
  .rl-bar-label { width: 150px; flex-shrink: 0; color: var(--ink-soft); }
  .rl-bar-track { flex: 1; background: var(--line); height: 12px; border-radius: 2px; overflow: hidden; }
  .rl-bar-fill { background: var(--green); height: 100%; }
  .rl-bar-fill.rust { background: var(--rust); }
  .rl-bar-val { width: 24px; text-align: right; color: var(--ink-soft); }

  .rl-student-row { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; background: var(--paper-card); border: 1px solid var(--line); border-radius: 3px; margin-bottom: 6px; font-size: 13px; }
  .rl-student-row .name { font-weight: 700; }
  .rl-student-row .meta { font-family: 'Courier New', monospace; font-size: 10.5px; color: var(--ink-soft); }

  .rl-filter-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
  .rl-filter-bar input, .rl-filter-bar select { font-family: 'Courier New', monospace; font-size: 12px; padding: 7px 9px; border: 1px solid var(--line); border-radius: 2px; background: var(--paper-card); color: var(--ink); }
  .rl-filter-bar label { font-family: 'Courier New', monospace; font-size: 11px; color: var(--ink-soft); display: flex; align-items: center; gap: 5px; }

  .rl-copy-dots { display: flex; gap: 4px; margin-top: 8px; }
  .rl-dot { width: 11px; height: 11px; border-radius: 50%; background: var(--line); border: 1px solid var(--ink-soft); }
  .rl-dot.avail { background: var(--green); border-color: var(--green-deep); }
  .rl-dot.out { background: var(--brass); border-color: var(--brass); }

  .rl-wish-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--paper-card); border: 1px solid var(--line); border-left: 4px solid var(--brass); border-radius: 3px; padding: 10px 12px; margin-bottom: 8px; flex-wrap: wrap; }
  .rl-wish-row .info { font-size: 13px; }
  .rl-wish-row .info .t { font-weight: 700; }
  .rl-wish-row .info .a { color: var(--ink-soft); font-size: 12px; }
  .rl-wish-row .votes { font-family: 'Courier New', monospace; font-size: 11px; color: var(--brass); display: flex; align-items: center; gap: 6px; }

  .rl-checkout-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; border-bottom: 1px dotted var(--line); font-size: 12.5px; }
  .rl-checkout-row:last-child { border-bottom: none; }
  .rl-checkout-row .who { font-weight: 700; }
  .rl-checkout-row .days { font-family: 'Courier New', monospace; font-size: 11px; color: var(--rust); }

  .rl-icon-btn { border: 1px solid var(--line); background: var(--paper-card); color: var(--ink-soft); width: 24px; height: 24px; border-radius: 2px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
  .rl-icon-btn:hover { border-color: var(--green-deep); color: var(--green-deep); }
  .rl-icon-btn.danger:hover { border-color: var(--rust); color: var(--rust); }
  .rl-card-corner { display: flex; gap: 4px; margin-left: auto; }

  .rl-identity { background: linear-gradient(135deg, var(--green-deep), var(--green)); color: var(--paper-card); border-radius: 4px; padding: 16px 18px; margin-bottom: 22px; display: flex; flex-wrap: wrap; gap: 22px; align-items: center; }
  .rl-identity h4 { font-family: 'Courier New', monospace; font-size: 10.5px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--brass-light); margin-bottom: 10px; width: 100%; display: flex; align-items: center; gap: 6px; }
  .rl-identity-stat { text-align: left; }
  .rl-identity-stat .num { font-size: 20px; font-weight: 700; }
  .rl-identity-stat .label { font-family: 'Courier New', monospace; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.85; }

  .rl-social-proof { font-family: 'Courier New', monospace; font-size: 10px; color: var(--brass); margin-top: 6px; display: flex; align-items: center; gap: 4px; }

  .rl-spoiler-hint { display: flex; align-items: flex-start; gap: 6px; font-family: 'Courier New', monospace; font-size: 10px; color: var(--ink-soft); margin-top: 5px; }
  .rl-spoiler-hint.warn { color: var(--rust); }

  .rl-bulk-bar { display: flex; justify-content: flex-end; margin-bottom: 4px; }

  .rl-gate { min-height: 60vh; display: flex; align-items: center; justify-content: center; }
`;

const GENRES = ["Realistic Fiction", "Fantasy", "Sci-Fi", "Mystery/Thriller", "Historical Fiction", "Graphic Novel", "Memoir/Nonfiction", "Horror", "Poetry", "Adventure"];
const ABANDON_REASONS = ["Too hard", "Not interested", "Wrong genre for me right now", "Life got busy", "Other"];

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysSince = (dateStr) => Math.floor((Date.now() - new Date(dateStr + "T00:00:00").getTime()) / 86400000);
const STALL_DAYS = 10;

function guessGenre(subjects = []) {
  const s = subjects.join(" ").toLowerCase();
  if (s.includes("fantasy")) return "Fantasy";
  if (s.includes("science fiction")) return "Sci-Fi";
  if (s.includes("mystery") || s.includes("thriller")) return "Mystery/Thriller";
  if (s.includes("historical")) return "Historical Fiction";
  if (s.includes("graphic novel") || s.includes("comic")) return "Graphic Novel";
  if (s.includes("biography") || s.includes("memoir") || s.includes("nonfiction")) return "Memoir/Nonfiction";
  if (s.includes("horror")) return "Horror";
  if (s.includes("poetry")) return "Poetry";
  if (s.includes("adventure")) return "Adventure";
  return "Realistic Fiction";
}

const SPOILER_PHRASES = ["at the end", "in the end", "turns out", "dies", "kills", "the ending", "spoiler", "twist is"];
function spoilerCheck(text) {
  const low = text.toLowerCase();
  return SPOILER_PHRASES.find((p) => low.includes(p)) || null;
}

function Cover({ src, title }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="rl-cover-fallback">{title?.[0] || "?"}</div>;
  }
  return <img className="rl-cover" src={src} alt="" onError={() => setFailed(true)} />;
}

function Stars({ value }) {
  return (
    <div className="rl-stars">
      {"★".repeat(Math.round(value / 2)).padEnd(5, "☆").split("").map((c, i) => (
        <span key={i} style={{ fontSize: 14, marginLeft: i === 0 ? 0 : -2 }}>{c}</span>
      ))}
      <span>{value}/10</span>
    </div>
  );
}

export default function ReadingLogApp() {
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState("");

  const [students, setStudents] = useState([]);
  const [readingLog, setReadingLog] = useState([]);
  const [libraryBooks, setLibraryBooks] = useState([]);
  const [copies, setCopies] = useState([]);
  const [wishlist, setWishlist] = useState([]);

  const [view, setView] = useState("log");
  const [addOpen, setAddOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(null);
  const [libAddOpen, setLibAddOpen] = useState(false);
  const [editEntryState, setEditEntryState] = useState(null);

  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("All");
  const [availOnly, setAvailOnly] = useState(false);

  // Sign in (silently) once, then subscribe to everything scoped to this class.
  useEffect(() => {
    let unsubs = [];
    ensureSignedIn().then((theUid) => {
      setUid(theUid);
      unsubs = [
        subscribeStudents(CLASS_ID, setStudents),
        subscribeReadingLog(CLASS_ID, setReadingLog),
        subscribeLibraryBooks(CLASS_ID, setLibraryBooks),
        subscribeCopies(CLASS_ID, setCopies),
        subscribeWishlist(CLASS_ID, setWishlist),
      ];
      setLoading(false);
    });
    return () => unsubs.forEach((u) => u && u());
  }, []);

  const me = students.find((s) => s.id === uid);
  const myName = me?.name || null;
  const mySomeday = me?.someday || [];

  async function claimName() {
    const name = nameDraft.trim();
    if (!name || !uid) return;
    await ensureStudentDoc(uid, name, CLASS_ID);
  }

  const library = useMemo(
    () => libraryBooks.map((b) => ({ ...b, copies: copies.filter((c) => c.bookId === b.id) })),
    [libraryBooks, copies]
  );

  const current = readingLog.filter((e) => e.studentId === uid);
  const reading = current.filter((b) => b.status === "reading");
  const finished = current.filter((b) => b.status === "finished");
  const abandoned = current.filter((b) => b.status === "abandoned");

  const favoriteGenre = useMemo(() => {
    const counts = {};
    current.forEach((b) => { counts[b.genre] = (counts[b.genre] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || null;
  }, [current]);

  const readTitles = new Set(current.map((b) => b.title));
  const recos = library.filter((b) => b.genre === favoriteGenre && !readTitles.has(b.title)).slice(0, 3);

  const communityReadCounts = useMemo(() => {
    const counts = {};
    const seenPerStudent = {};
    readingLog.forEach((e) => {
      if (e.studentId === uid) return;
      if (e.status !== "finished" && e.status !== "reading") return;
      seenPerStudent[e.studentId] = seenPerStudent[e.studentId] || new Set();
      if (!seenPerStudent[e.studentId].has(e.title)) {
        seenPerStudent[e.studentId].add(e.title);
        counts[e.title] = (counts[e.title] || 0) + 1;
      }
    });
    return counts;
  }, [readingLog, uid]);

  async function addBook({ title, author, genre, dateStarted, isbn, cover }) {
    await addLogEntry(uid, CLASS_ID, { title, author, genre, dateStarted, isbn, cover });
    setAddOpen(false);
  }

  async function closeBook(id, mode, { date, rating, review, reason }) {
    if (mode === "finish") await finishEntry(id, { dateFinished: date, rating, review });
    else await abandonEntry(id, { dateAbandoned: date, reason });
    setCloseOpen(null);
  }

  async function deleteBook(id) {
    if (!window.confirm("Delete this entry from your log? This can't be undone.")) return;
    await deleteEntry(id);
  }

  async function saveEditedEntry(id, updates) {
    await editEntry(id, updates);
    setEditEntryState(null);
  }

  async function toggleSomeday(bookId) {
    if (mySomeday.includes(bookId)) await removeFromSomeday(uid, bookId);
    else await addToSomeday(uid, bookId);
  }

  async function startFromSomeday(bookId) {
    const book = library.find((b) => b.id === bookId);
    if (!book) return;
    await addLogEntry(uid, CLASS_ID, { title: book.title, author: book.author, genre: book.genre, dateStarted: todayStr(), isbn: book.isbn, cover: book.cover });
    await doCheckOut(bookId);
    await removeFromSomeday(uid, bookId);
    setView("log");
  }

  async function doCheckOut(bookId) {
    const book = library.find((b) => b.id === bookId);
    const avail = book?.copies.find((c) => c.status === "available");
    if (!avail) return;
    await checkOutCopy(avail.id, uid, todayStr());
  }

  async function doCheckIn(bookId) {
    const book = library.find((b) => b.id === bookId);
    const mine = book?.copies.find((c) => c.holderStudentId === uid);
    if (!mine) return;
    await checkInCopy(mine.id);
  }

  async function doBulkCheckIn() {
    if (!window.confirm("Check in every copy currently checked out across the whole shelf?")) return;
    const out = copies.filter((c) => c.status === "checked_out");
    await fsBulkCheckIn(out);
  }

  async function handleAddLibraryBook({ title, author, genre, isbn, cover, copies: n }) {
    await fsAddLibraryBook(CLASS_ID, { title, author, genre, isbn, cover, copies: n });
    setLibAddOpen(false);
  }

  async function requestWishlist(title, author) {
    const existing = wishlist.find((w) => w.title.toLowerCase() === title.toLowerCase());
    if (existing) {
      if (!existing.votes.includes(uid)) await fsVoteWishlist(existing.id, uid);
    } else {
      await addWishlistRequest(CLASS_ID, title, author, uid);
    }
  }

  async function doVoteWishlist(id) {
    await fsVoteWishlist(id, uid);
  }

  const filteredLibrary = library.filter((b) => {
    const matchesSearch = !search || b.title.toLowerCase().includes(search.toLowerCase()) || b.author.toLowerCase().includes(search.toLowerCase());
    const matchesGenre = genreFilter === "All" || b.genre === genreFilter;
    const matchesAvail = !availOnly || b.copies.some((c) => c.status === "available");
    return matchesSearch && matchesGenre && matchesAvail;
  });

  // Teacher aggregate stats (across the whole class)
  const allEntries = readingLog;
  const genreCounts = {};
  allEntries.forEach((b) => { genreCounts[b.genre] = (genreCounts[b.genre] || 0) + 1; });
  const maxGenreCount = Math.max(1, ...Object.values(genreCounts));
  const finishedAll = allEntries.filter((b) => b.status === "finished");
  const avgRating = finishedAll.length ? (finishedAll.reduce((a, b) => a + b.rating, 0) / finishedAll.length).toFixed(1) : "—";
  const abandonRate = allEntries.length ? Math.round((allEntries.filter((b) => b.status === "abandoned").length / allEntries.length) * 100) : 0;
  const stalledAll = allEntries.filter((b) => b.status === "reading" && daysSince(b.dateStarted) >= STALL_DAYS);
  const reasonCounts = {};
  allEntries.filter((b) => b.status === "abandoned" && b.reason).forEach((b) => { reasonCounts[b.reason] = (reasonCounts[b.reason] || 0) + 1; });
  const maxReasonCount = Math.max(1, ...Object.values(reasonCounts), 0);
  const checkedOutCopies = library.flatMap((b) => b.copies.filter((c) => c.status === "checked_out").map((c) => ({ ...c, title: b.title, holderName: students.find((s) => s.id === c.holderStudentId)?.name || "Unknown" }))).sort((a, b) => (daysSince(a.since) < daysSince(b.since) ? 1 : -1));

  const shelfGenreCounts = {};
  const outGenreCounts = {};
  library.forEach((b) => {
    shelfGenreCounts[b.genre] = (shelfGenreCounts[b.genre] || 0) + b.copies.length;
    outGenreCounts[b.genre] = (outGenreCounts[b.genre] || 0) + b.copies.filter((c) => c.status === "checked_out").length;
  });
  const maxShelfCount = Math.max(1, ...Object.values(shelfGenreCounts));

  if (loading) {
    return (
      <div className="rl-root">
        <style>{STYLES}</style>
        <div className="rl-gate"><div className="rl-note">Connecting...</div></div>
      </div>
    );
  }

  if (!myName) {
    return (
      <div className="rl-root">
        <style>{STYLES}</style>
        <div className="rl-gate">
          <div className="rl-modal" style={{ position: "static" }}>
            <h3>Welcome to The Reading Log</h3>
            <div className="rl-field">
              <label>What's your name?</label>
              <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && claimName()} placeholder="First name, last initial" />
            </div>
            <button className="rl-btn solid" style={{ width: "100%", justifyContent: "center" }} disabled={!nameDraft.trim()} onClick={claimName}>
              Start Reading <ChevronRight size={14} />
            </button>
            <div className="rl-note" style={{ marginTop: 14, marginBottom: 0 }}>
              This ties your reading log to this device. If you switch computers, you'll set up a new profile there — talk to your teacher if that happens.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rl-root">
      <style>{STYLES}</style>
      <div className="rl-shell">
        <div className="rl-header">
          <div className="rl-title">The Reading Log<small>Independent Reading &middot; Workshop Edition</small></div>
          <div className="rl-student">Reading as <strong>{myName}</strong></div>
        </div>

        <nav className="rl-shelf">
          <button className={`rl-spine ${view === "log" ? "active" : ""}`} onClick={() => setView("log")}><BookOpen /> My Log</button>
          <button className={`rl-spine ${view === "library" ? "active" : ""}`} onClick={() => setView("library")}><Library /> Library Shelf</button>
          <button className={`rl-spine ${view === "someday" ? "active" : ""}`} onClick={() => setView("someday")}><ListChecks /> Someday List{mySomeday.length ? ` (${mySomeday.length})` : ""}</button>
          <button className={`rl-spine ${view === "teacher" ? "active" : ""}`} onClick={() => setView("teacher")}><Users /> Teacher View</button>
        </nav>

        {view === "log" && (
          <>
            {current.length > 0 && (
              <div className="rl-identity">
                <h4><Sparkles size={12} /> {myName}'s Reading Identity</h4>
                <div className="rl-identity-stat"><div className="num">{current.length}</div><div className="label">Books Logged</div></div>
                <div className="rl-identity-stat"><div className="num">{finished.length}</div><div className="label">Finished</div></div>
                <div className="rl-identity-stat"><div className="num">{finished.length ? (finished.reduce((a, b) => a + b.rating, 0) / finished.length).toFixed(1) : "—"}</div><div className="label">Avg. Rating</div></div>
                <div className="rl-identity-stat"><div className="num" style={{ fontSize: 15 }}>{favoriteGenre || "—"}</div><div className="label">Top Genre</div></div>
              </div>
            )}
            <div className="rl-section-title">
              Currently Reading <span className="rl-count">{reading.length}</span>
              <span style={{ marginLeft: "auto" }}>
                <button className="rl-btn solid" onClick={() => setAddOpen(true)}><Plus size={13} /> Start a New Book</button>
              </span>
            </div>
            {reading.length === 0 ? (
              <div className="rl-empty">Nothing in progress. Start a new book above.</div>
            ) : (
              <div className="rl-grid">
                {reading.map((b) => {
                  const stalled = daysSince(b.dateStarted) >= STALL_DAYS;
                  return (
                    <div className="rl-card" key={b.id}>
                      <div className="rl-card-body">
                        <Cover src={b.cover} title={b.title} />
                        <div className="rl-card-text">
                          <div className="rl-card-title">{b.title}</div>
                          <div className="rl-card-author">{b.author}</div>
                          <div className="rl-tagrow"><span className="rl-genre-tag">{b.genre}</span><span>started {b.dateStarted}</span></div>
                          {stalled && <div className="rl-flag"><Flag size={10} /> {daysSince(b.dateStarted)} days, no update — check in?</div>}
                        </div>
                      </div>
                      <div className="rl-btnrow">
                        <button className="rl-btn" onClick={() => setCloseOpen({ id: b.id, mode: "finish" })}><BookMarked size={13} /> Finish</button>
                        <button className="rl-btn rust" onClick={() => setCloseOpen({ id: b.id, mode: "abandon" })}><RotateCcw size={13} /> Abandon</button>
                        <span className="rl-card-corner">
                          <button className="rl-icon-btn" title="Edit" onClick={() => setEditEntryState(b)}><Pencil size={12} /></button>
                          <button className="rl-icon-btn danger" title="Delete" onClick={() => deleteBook(b.id)}><Trash2 size={12} /></button>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="rl-section-title">Finished <span className="rl-count">{finished.length}</span></div>
            {finished.length === 0 ? <div className="rl-empty">No finished books yet.</div> : (
              <div className="rl-grid">
                {finished.map((b) => (
                  <div className="rl-card" key={b.id}>
                    <div className="rl-card-body">
                      <Cover src={b.cover} title={b.title} />
                      <div className="rl-card-text">
                        <div className="rl-card-title">{b.title}</div>
                        <div className="rl-card-author">{b.author}</div>
                        <div className="rl-tagrow"><span className="rl-genre-tag">{b.genre}</span><span>{b.dateStarted} → {b.dateFinished}</span></div>
                        <Stars value={b.rating} />
                      </div>
                    </div>
                    <div className="rl-review">&ldquo;{b.review}&rdquo;</div>
                    <div className="rl-btnrow">
                      <span className="rl-card-corner">
                        <button className="rl-icon-btn" title="Edit" onClick={() => setEditEntryState(b)}><Pencil size={12} /></button>
                        <button className="rl-icon-btn danger" title="Delete" onClick={() => deleteBook(b.id)}><Trash2 size={12} /></button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rl-section-title">Abandoned <span className="rl-count">{abandoned.length}</span></div>
            {abandoned.length === 0 ? <div className="rl-empty">No abandoned books.</div> : (
              <div className="rl-grid">
                {abandoned.map((b) => (
                  <div className="rl-card abandoned" key={b.id}>
                    <div className="rl-card-body">
                      <Cover src={b.cover} title={b.title} />
                      <div className="rl-card-text">
                        <div className="rl-card-title">{b.title}</div>
                        <div className="rl-card-author">{b.author}</div>
                        <div className="rl-tagrow"><span className="rl-genre-tag">{b.genre}</span><span>{b.dateStarted} → {b.dateAbandoned}</span></div>
                        {b.reason && <span className="rl-reason-tag">{b.reason}</span>}
                      </div>
                    </div>
                    <div className="rl-btnrow">
                      <span className="rl-card-corner">
                        <button className="rl-icon-btn" title="Edit" onClick={() => setEditEntryState(b)}><Pencil size={12} /></button>
                        <button className="rl-icon-btn danger" title="Delete" onClick={() => deleteBook(b.id)}><Trash2 size={12} /></button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {view === "library" && (
          <>
            {recos.length > 0 && (
              <div className="rl-lib-recos">
                <h4>Because you've been reading {favoriteGenre}</h4>
                <div className="rl-reco-list">
                  {recos.map((b) => (
                    <div className="rl-reco-pill" key={b.id}>
                      {b.title} — {b.author}
                      <button className="rl-btn small" style={{ borderColor: "rgba(255,255,255,0.4)", color: "#fff" }} onClick={() => toggleSomeday(b.id)}>
                        {mySomeday.includes(b.id) ? "Added" : "+ Someday"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rl-section-title">
              Classroom Shelf <span className="rl-count">{filteredLibrary.length} of {library.length}</span>
              <span style={{ marginLeft: "auto" }}>
                <button className="rl-btn solid" onClick={() => setLibAddOpen(true)}><Barcode size={13} /> Add Title to Shelf</button>
              </span>
            </div>

            <div className="rl-filter-bar">
              <input placeholder="Search title or author..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 200 }} />
              <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}>
                <option>All</option>
                {GENRES.map((g) => <option key={g}>{g}</option>)}
              </select>
              <label><input type="checkbox" checked={availOnly} onChange={(e) => setAvailOnly(e.target.checked)} /> Available only</label>
            </div>

            {filteredLibrary.length === 0 ? <div className="rl-empty">No titles yet. Use "Add Title to Shelf" above to get started.</div> : (
              <div className="rl-grid">
                {filteredLibrary.map((b) => {
                  const available = b.copies.filter((c) => c.status === "available").length;
                  const myCopy = b.copies.find((c) => c.holderStudentId === uid);
                  return (
                    <div className="rl-card" key={b.id}>
                      <div className="rl-card-body">
                        <Cover src={b.cover} title={b.title} />
                        <div className="rl-card-text">
                          <div className="rl-card-title">{b.title}</div>
                          <div className="rl-card-author">{b.author}</div>
                          <div className="rl-tagrow"><span className="rl-genre-tag">{b.genre}</span><span>{available}/{b.copies.length} on shelf</span></div>
                          <div className="rl-copy-dots">
                            {b.copies.map((c) => <div key={c.id} className={`rl-dot ${c.status === "available" ? "avail" : "out"}`} title={c.status === "available" ? "Available" : "Checked out"} />)}
                          </div>
                          {communityReadCounts[b.title] > 0 && (
                            <div className="rl-social-proof"><Users size={10} /> {communityReadCounts[b.title]} {communityReadCounts[b.title] === 1 ? "classmate has" : "classmates have"} read this</div>
                          )}
                        </div>
                      </div>
                      <div className="rl-btnrow">
                        {myCopy ? (
                          <button className="rl-btn" onClick={() => doCheckIn(b.id)}>Return My Copy</button>
                        ) : (
                          <button className="rl-btn" disabled={available === 0} onClick={() => doCheckOut(b.id)}>{available === 0 ? "All checked out" : "Check Out"}</button>
                        )}
                        <button className="rl-btn small" onClick={() => toggleSomeday(b.id)}>{mySomeday.includes(b.id) ? "★" : "☆"}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="rl-section-title">Class Wishlist <span className="rl-count">{wishlist.length}</span></div>
            <div className="rl-note" style={{ marginBottom: 12 }}>Don't see a book you want on the shelf? Request it — if someone already has, add your vote instead.</div>
            {[...wishlist].sort((a, b) => b.votes.length - a.votes.length).map((w) => (
              <div className="rl-wish-row" key={w.id}>
                <div className="info"><span className="t">{w.title}</span>{w.author && <span className="a"> — {w.author}</span>}</div>
                <div className="votes">
                  <Heart size={12} /> {w.votes.length} {w.votes.length === 1 ? "student wants this" : "students want this"}
                  <button className="rl-btn small" disabled={w.votes.includes(uid)} onClick={() => doVoteWishlist(w.id)}>{w.votes.includes(uid) ? "You voted" : "+1 Me too"}</button>
                </div>
              </div>
            ))}
            <WishlistForm onSubmit={requestWishlist} />
          </>
        )}

        {view === "someday" && (
          <>
            <div className="rl-section-title">Someday List <span className="rl-count">{mySomeday.length}</span></div>
            {mySomeday.length === 0 ? (
              <div className="rl-empty">Nothing saved yet. Browse the Library Shelf and tap the star to add a book here.</div>
            ) : (
              <div className="rl-grid">
                {mySomeday.map((id) => {
                  const b = library.find((x) => x.id === id);
                  if (!b) return null;
                  const available = b.copies.filter((c) => c.status === "available").length;
                  return (
                    <div className="rl-card" key={id}>
                      <div className="rl-card-body">
                        <Cover src={b.cover} title={b.title} />
                        <div className="rl-card-text">
                          <div className="rl-card-title">{b.title}</div>
                          <div className="rl-card-author">{b.author}</div>
                          <div className="rl-tagrow"><span className="rl-genre-tag">{b.genre}</span><span>{available}/{b.copies.length} available</span></div>
                        </div>
                      </div>
                      <div className="rl-btnrow">
                        <button className="rl-btn solid" disabled={available === 0} onClick={() => startFromSomeday(id)}>{available === 0 ? "All checked out" : "Start Reading"}</button>
                        <button className="rl-btn small" onClick={() => toggleSomeday(id)}><X size={12} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {view === "teacher" && (
          <>
            <div className="rl-section-title">Class Snapshot</div>
            <div className="rl-stat-grid">
              <div className="rl-stat"><div className="num">{students.length}</div><div className="label">Students Logging</div></div>
              <div className="rl-stat"><div className="num">{allEntries.length}</div><div className="label">Books Logged</div></div>
              <div className="rl-stat"><div className="num">{finishedAll.length}</div><div className="label">Finished</div></div>
              <div className="rl-stat"><div className="num">{avgRating}</div><div className="label">Avg. Rating</div></div>
              <div className="rl-stat"><div className="num">{abandonRate}%</div><div className="label">Abandon Rate</div></div>
              <div className="rl-stat"><div className="num">{stalledAll.length}</div><div className="label">Stalled Books</div></div>
            </div>

            {stalledAll.length > 0 && (
              <>
                <div className="rl-section-title">Stalled Books — Worth a Conference</div>
                {stalledAll.map((b) => (
                  <div className="rl-checkout-row" key={b.id}>
                    <span className="who">{students.find((s) => s.id === b.studentId)?.name || "Unknown"} — {b.title}</span>
                    <span className="days">{daysSince(b.dateStarted)} days, no update</span>
                  </div>
                ))}
              </>
            )}

            <div className="rl-section-title">Genre Trends, Whole Class</div>
            {Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).map(([genre, count]) => (
              <div className="rl-bar-row" key={genre}>
                <div className="rl-bar-label">{genre}</div>
                <div className="rl-bar-track"><div className="rl-bar-fill" style={{ width: `${(count / maxGenreCount) * 100}%` }} /></div>
                <div className="rl-bar-val">{count}</div>
              </div>
            ))}

            {Object.keys(reasonCounts).length > 0 && (
              <>
                <div className="rl-section-title">Why Students Abandon Books</div>
                {Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                  <div className="rl-bar-row" key={reason}>
                    <div className="rl-bar-label">{reason}</div>
                    <div className="rl-bar-track"><div className="rl-bar-fill rust" style={{ width: `${(count / maxReasonCount) * 100}%` }} /></div>
                    <div className="rl-bar-val">{count}</div>
                  </div>
                ))}
              </>
            )}

            <div className="rl-section-title">Collection Balance — On Shelf vs. Checked Out</div>
            {Object.entries(shelfGenreCounts).sort((a, b) => b[1] - a[1]).map(([genre, count]) => (
              <div key={genre} style={{ marginBottom: 10 }}>
                <div className="rl-bar-row">
                  <div className="rl-bar-label">{genre}</div>
                  <div className="rl-bar-track"><div className="rl-bar-fill" style={{ width: `${(count / maxShelfCount) * 100}%` }} /></div>
                  <div className="rl-bar-val">{count}</div>
                </div>
                <div className="rl-bar-row">
                  <div className="rl-bar-label" style={{ opacity: 0.6 }}>↳ checked out</div>
                  <div className="rl-bar-track"><div className="rl-bar-fill rust" style={{ width: `${((outGenreCounts[genre] || 0) / maxShelfCount) * 100}%` }} /></div>
                  <div className="rl-bar-val">{outGenreCounts[genre] || 0}</div>
                </div>
              </div>
            ))}

            {checkedOutCopies.length > 0 && (
              <>
                <div className="rl-section-title">
                  Currently Checked Out <span className="rl-count">{checkedOutCopies.length}</span>
                </div>
                <div className="rl-bulk-bar">
                  <button className="rl-btn small rust" onClick={doBulkCheckIn}><RefreshCw size={11} /> Check In All Copies</button>
                </div>
                {checkedOutCopies.map((c) => (
                  <div className="rl-checkout-row" key={c.id}>
                    <span><span className="who">{c.holderName}</span> — {c.title}</span>
                    <span className="days">{daysSince(c.since)} days</span>
                  </div>
                ))}
              </>
            )}

            <div className="rl-section-title">By Student</div>
            {students.map((s) => (
              <div className="rl-student-row" key={s.id}>
                <span className="name">{s.name}</span>
                <span className="meta">
                  {readingLog.filter((b) => b.studentId === s.id && b.status === "reading").length} reading &middot;
                  {" "}{readingLog.filter((b) => b.studentId === s.id && b.status === "finished").length} finished &middot;
                  {" "}{readingLog.filter((b) => b.studentId === s.id && b.status === "abandoned").length} abandoned
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {addOpen && <AddBookModal onClose={() => setAddOpen(false)} onSave={addBook} />}
      {closeOpen && (
        <CloseBookModal
          mode={closeOpen.mode}
          onClose={() => setCloseOpen(null)}
          onSave={(data) => closeBook(closeOpen.id, closeOpen.mode, data)}
        />
      )}
      {libAddOpen && <AddLibraryBookModal onClose={() => setLibAddOpen(false)} onSave={handleAddLibraryBook} />}
      {editEntryState && <EditEntryModal book={editEntryState} onClose={() => setEditEntryState(null)} onSave={(updates) => saveEditedEntry(editEntryState.id, updates)} />}
    </div>
  );
}

function WishlistForm({ onSubmit }) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  return (
    <div className="rl-card" style={{ marginTop: 4 }}>
      <div className="rl-field"><label>Book Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A book you wish we had..." /></div>
      <div className="rl-field"><label>Author (if known)</label><input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name" /></div>
      <button className="rl-btn solid" disabled={!title.trim()} onClick={() => { onSubmit(title.trim(), author.trim()); setTitle(""); setAuthor(""); }}>
        Request This Book
      </button>
    </div>
  );
}

function EditEntryModal({ book, onClose, onSave }) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [genre, setGenre] = useState(book.genre);
  const [dateStarted, setDateStarted] = useState(book.dateStarted);
  const [dateFinished, setDateFinished] = useState(book.dateFinished || "");
  const [dateAbandoned, setDateAbandoned] = useState(book.dateAbandoned || "");
  const [rating, setRating] = useState(book.rating || 0);
  const [review, setReview] = useState(book.review || "");
  const [reason, setReason] = useState(book.reason || ABANDON_REASONS[0]);

  function handleSave() {
    const updates = { title, author, genre, dateStarted };
    if (book.status === "finished") { updates.dateFinished = dateFinished; updates.rating = rating; updates.review = review; }
    if (book.status === "abandoned") { updates.dateAbandoned = dateAbandoned; updates.reason = reason; }
    onSave(updates);
  }

  return (
    <div className="rl-overlay" onClick={onClose}>
      <div className="rl-modal" onClick={(e) => e.stopPropagation()}>
        <button className="rl-close" onClick={onClose}><X size={18} /></button>
        <h3>Edit Entry</h3>
        <div className="rl-field"><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="rl-field"><label>Author</label><input value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
        <div className="rl-field"><label>Genre</label>
          <select value={genre} onChange={(e) => setGenre(e.target.value)}>
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="rl-field"><label>Date Started</label><input type="date" value={dateStarted} onChange={(e) => setDateStarted(e.target.value)} /></div>
        {book.status === "finished" && (
          <>
            <div className="rl-field"><label>Date Finished</label><input type="date" value={dateFinished} onChange={(e) => setDateFinished(e.target.value)} /></div>
            <div className="rl-field">
              <label>Rating (1–10)</label>
              <div className="rl-rating-row">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" className={`rl-rate-pip ${rating >= n ? "on" : ""}`} onClick={() => setRating(n)}>{n}</button>
                ))}
              </div>
            </div>
            <div className="rl-field"><label>Review</label><textarea value={review} onChange={(e) => setReview(e.target.value)} /></div>
          </>
        )}
        {book.status === "abandoned" && (
          <>
            <div className="rl-field"><label>Date Abandoned</label><input type="date" value={dateAbandoned} onChange={(e) => setDateAbandoned(e.target.value)} /></div>
            <div className="rl-field"><label>Reason</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)}>
                {ABANDON_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </>
        )}
        <button className="rl-btn solid" style={{ width: "100%", justifyContent: "center" }} disabled={!title || !author} onClick={handleSave}>
          Save Changes
        </button>
      </div>
    </div>
  );
}

function IsbnLookupField({ onFound }) {
  const [isbn, setIsbn] = useState("");
  const [status, setStatus] = useState("");

  async function handleLookup() {
    if (!isbn.trim()) return;
    setStatus("Looking up...");
    try {
      const result = await lookupISBN(isbn.trim());
      if (result) {
        setStatus(`Found: ${result.title}`);
        onFound({ ...result, genre: guessGenre(result.subjects || []) });
      } else {
        setStatus("No match found — enter details manually below.");
      }
    } catch {
      setStatus("Couldn't reach the lookup service — enter details manually below.");
    }
  }

  return (
    <div className="rl-field">
      <label>ISBN (optional — auto-fills title, author, cover)</label>
      <div className="rl-isbn-row">
        <input value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="e.g. 9780062498533" />
        <button type="button" className="rl-btn" onClick={handleLookup}><Search size={12} /> Look Up</button>
      </div>
      {status && <div className="rl-isbn-status">{status}</div>}
    </div>
  );
}

function AddBookModal({ onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState(GENRES[0]);
  const [dateStarted, setDateStarted] = useState(todayStr());
  const [isbn, setIsbn] = useState(null);
  const [cover, setCover] = useState(null);

  function handleFound(result) {
    setTitle(result.title);
    setAuthor(result.author);
    setGenre(result.genre);
    setIsbn(result.isbn);
    setCover(result.cover);
  }

  return (
    <div className="rl-overlay" onClick={onClose}>
      <div className="rl-modal" onClick={(e) => e.stopPropagation()}>
        <button className="rl-close" onClick={onClose}><X size={18} /></button>
        <h3>Start a New Book</h3>
        <IsbnLookupField onFound={handleFound} />
        <div className="rl-field"><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book title" /></div>
        <div className="rl-field"><label>Author</label><input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name" /></div>
        <div className="rl-field"><label>Genre</label>
          <select value={genre} onChange={(e) => setGenre(e.target.value)}>
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="rl-field"><label>Date Started</label><input type="date" value={dateStarted} onChange={(e) => setDateStarted(e.target.value)} /></div>
        <button className="rl-btn solid" style={{ width: "100%", justifyContent: "center" }} disabled={!title || !author} onClick={() => onSave({ title, author, genre, dateStarted, isbn, cover })}>
          Add to My Log <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function AddLibraryBookModal({ onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState(GENRES[0]);
  const [isbn, setIsbn] = useState(null);
  const [cover, setCover] = useState(null);
  const [copies, setCopies] = useState(1);

  function handleFound(result) {
    setTitle(result.title);
    setAuthor(result.author);
    setGenre(result.genre);
    setIsbn(result.isbn);
    setCover(result.cover);
  }

  return (
    <div className="rl-overlay" onClick={onClose}>
      <div className="rl-modal" onClick={(e) => e.stopPropagation()}>
        <button className="rl-close" onClick={onClose}><X size={18} /></button>
        <h3>Add Title to Shelf</h3>
        <IsbnLookupField onFound={handleFound} />
        <div className="rl-field"><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book title" /></div>
        <div className="rl-field"><label>Author</label><input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name" /></div>
        <div className="rl-field"><label>Genre</label>
          <select value={genre} onChange={(e) => setGenre(e.target.value)}>
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="rl-field"><label>Number of Copies</label><input type="number" min="1" max="20" value={copies} onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))} /></div>
        <button className="rl-btn solid" style={{ width: "100%", justifyContent: "center" }} disabled={!title || !author} onClick={() => onSave({ title, author, genre, isbn, cover, copies })}>
          Add to Shelf <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function CloseBookModal({ mode, onClose, onSave }) {
  const [date, setDate] = useState(todayStr());
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [reason, setReason] = useState(ABANDON_REASONS[0]);
  const isFinish = mode === "finish";
  const canSave = isFinish ? rating > 0 && review.trim().length > 0 : true;

  return (
    <div className="rl-overlay" onClick={onClose}>
      <div className="rl-modal" onClick={(e) => e.stopPropagation()}>
        <button className="rl-close" onClick={onClose}><X size={18} /></button>
        <h3>{isFinish ? "Finish This Book" : "Abandon This Book"}</h3>
        <div className="rl-field"><label>{isFinish ? "Date Finished" : "Date Abandoned"}</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        {isFinish ? (
          <>
            <div className="rl-field">
              <label>Rating (1–10)</label>
              <div className="rl-rating-row">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" className={`rl-rate-pip ${rating >= n ? "on" : ""}`} onClick={() => setRating(n)}>{n}</button>
                ))}
              </div>
            </div>
            <div className="rl-field">
              <label>Review (3–4 sentences, no spoilers)</label>
              <textarea value={review} onChange={(e) => setReview(e.target.value)} placeholder="What did you think? Would you recommend it, and to whom?" />
              {spoilerCheck(review) ? (
                <div className="rl-spoiler-hint warn"><AlertTriangle size={12} /> That might give away what happens — double check before you save.</div>
              ) : (
                <div className="rl-spoiler-hint">Focus on how it made you feel and who'd like it — save what happens for book talks.</div>
              )}
            </div>
          </>
        ) : (
          <div className="rl-field">
            <label>Why are you abandoning it?</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {ABANDON_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}
        <button className="rl-btn solid" style={{ width: "100%", justifyContent: "center", background: isFinish ? undefined : "#A64B2A", borderColor: isFinish ? undefined : "#A64B2A" }} disabled={!canSave} onClick={() => onSave({ date, rating, review, reason })}>
          {isFinish ? "Save & Finish" : "Mark as Abandoned"}
        </button>
      </div>
    </div>
  );
}
