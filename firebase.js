/* ============================================================
   firebase.js — 多学年対応版（g2・g3以降）
============================================================ */

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInAnonymously,
  signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection, doc,
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ============================================================
   Firebase 設定
============================================================ */
const firebaseConfig = {
  apiKey:            "AIzaSyBJ6PmF2zjYf51nC1nWwMMFHyEGGd4wU3g",
  authDomain:        "workbook-ecd9b.firebaseapp.com",
  projectId:         "workbook-ecd9b",
  storageBucket:     "workbook-ecd9b.firebasestorage.app",
  messagingSenderId: "516796599564",
  appId:             "1:516796599564:web:b884b2c3d71b8c4b1c4d29",
  measurementId:     "G-STNDF8HY3X",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

/* ============================================================
   認証：子ども用（匿名）
============================================================ */
export async function signInUser() {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (e) { console.error("signInUser:", e); return null; }
}

/* ============================================================
   認証：先生用（メール/パスワード）
============================================================ */
export async function signInTeacher(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (e) { console.error("signInTeacher:", e); return null; }
}

export async function signOutUser() {
  try { await signOut(auth); } catch (e) { console.error("signOut:", e); }
}

/* ============================================================
   ユーザー管理
============================================================ */
export async function createUserIfNew(uid, name) {
  try {
    const ref  = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        name, gradeId: "g2", progress: {},
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }
  } catch (e) { console.error("createUserIfNew:", e); }
}

export async function loadProgress(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? (snap.data().progress || {}) : {};
  } catch (e) { console.error("loadProgress:", e); return {}; }
}

export async function saveProgress(uid, name, progress) {
  try {
    await setDoc(
      doc(db, "users", uid),
      { name, progress, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (e) { console.error("saveProgress:", e); }
}

/* ============================================================
   セッション保存
   gradeId を含めて保存することで学年別の分析が可能
============================================================ */
export async function saveSession(uid, sessionData) {
  try {
    await addDoc(
      collection(db, "users", uid, "sessions"),
      { ...sessionData, createdAt: serverTimestamp() }
    );
  } catch (e) { console.error("saveSession:", e); }
}

export async function getUserSessions(uid, count = 20) {
  try {
    const q = query(
      collection(db, "users", uid, "sessions"),
      orderBy("createdAt", "desc"),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error("getUserSessions:", e); return []; }
}

/* ============================================================
   全ユーザー取得（先生用）
============================================================ */
export async function getAllUsers() {
  try {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch (e) { console.error("getAllUsers:", e); return []; }
}

export async function getUserByName(name) {
  try {
    const q = query(collection(db, "users"), where("name", "==", name));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch (e) { console.error("getUserByName:", e); return []; }
}

/* ============================================================
   問題の取得（子ども用）
   unitId は学年をまたいで一意なので unitId + stageId で絞り込み可能
   Firestoreのデータ構造:
   problems/{自動ID}
     subjectId:    "math" / "japanese" / "science"
     gradeId:      "g2" / "g3" / ...
     unitId:       "add"（2年算数）/ "div3"（3年算数）など
     stageId:      1 / 2 / 3
     questionType: "number" / "choice"
     question:     "問題文"
     answer:       数値
     choices:      null / ["あ）…","い）…","う）…","え）…"]
     hint:         "ヒント"
     explanation:  "解説"
     displayType:  "text" / "calc"
     displayLeft:  数値（calcのとき）
     displayOp:    "+" / "−"（calcのとき）
     displayRight: 数値（calcのとき）
     isPublished:  true
     createdAt:    timestamp
     updatedAt:    timestamp
============================================================ */
export async function getProblems(unitId, stageId) {
  try {
    const q = query(
      collection(db, "problems"),
      where("unitId",      "==", unitId),
      where("stageId",     "==", stageId),
      where("isPublished", "==", true)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (list.length < 5) return [];
    return shuffleArray(list).slice(0, 5);
  } catch (e) { console.error("getProblems:", e); return []; }
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================================================
   動画URL管理
   unitVideos/{unitId}
     s1: "https://www.youtube.com/watch?v=xxxxx"
     s2: "https://www.youtube.com/watch?v=yyyyy"
     s3: "https://www.youtube.com/watch?v=zzzzz"
     updatedAt: timestamp
============================================================ */
export async function getAllUnitVideos() {
  try {
    const snap = await getDocs(collection(db, "unitVideos"));
    const result = {};
    snap.docs.forEach(d => { result[d.id] = d.data(); });
    return result;
  } catch (e) { console.error("getAllUnitVideos:", e); return {}; }
}

export async function getUnitVideos(unitId) {
  try {
    const snap = await getDoc(doc(db, "unitVideos", unitId));
    return snap.exists() ? snap.data() : {};
  } catch (e) { console.error("getUnitVideos:", e); return {}; }
}

export async function saveUnitVideos(unitId, urls) {
  try {
    await setDoc(
      doc(db, "unitVideos", unitId),
      { unitId, ...urls, updatedAt: serverTimestamp() },
      { merge: true }
    );
    return true;
  } catch (e) { console.error("saveUnitVideos:", e); return false; }
}

/* YouTubeのURLを埋め込みURLに変換 */
export function toYouTubeEmbedUrl(url) {
  if (!url) return null;
  const m1 = url.match(/[?&]v=([^&]+)/);
  if (m1) return `https://www.youtube.com/embed/${m1[1]}`;
  const m2 = url.match(/youtu\.be\/([^?&]+)/);
  if (m2) return `https://www.youtube.com/embed/${m2[1]}`;
  if (url.includes('/embed/')) return url;
  return null;
}

/* ============================================================
   問題管理（先生用）
============================================================ */
export async function getAllProblems() {
  try {
    const snap = await getDocs(
      query(collection(db, "problems"), orderBy("createdAt", "desc"))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error("getAllProblems:", e); return []; }
}

export async function addProblem(data) {
  try {
    const ref = await addDoc(collection(db, "problems"), {
      ...data,
      isPublished: data.isPublished ?? true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (e) { console.error("addProblem:", e); return null; }
}

export async function updateProblem(id, data) {
  try {
    await updateDoc(doc(db, "problems", id), {
      ...data, updatedAt: serverTimestamp(),
    });
    return true;
  } catch (e) { console.error("updateProblem:", e); return false; }
}

export async function deleteProblem(id) {
  try {
    await deleteDoc(doc(db, "problems", id));
    return true;
  } catch (e) { console.error("deleteProblem:", e); return false; }
}