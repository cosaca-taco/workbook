/* ============================================================
   firebase.js — 多科目対応版
   subjectId（math / japanese / science）に対応
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
   unitId でフィルタ（unitId は科目をまたいで一意）
   5問未満の場合は空配列 → JS生成にフォールバック

   Firestoreの問題データ構造（多科目対応版）:
   problems/{自動ID}
     subjectId:    "math" / "japanese" / "science"
     unitId:       "add" / "kanji2" など
     gradeId:      "g2"
     stageId:      1 / 2 / 3
     questionType: "number"（数字入力）/ "choice"（選択肢）
     question:     "問題文"
     answer:       70（numberの場合）/ 1（choiceの場合はインデックス0〜3）
     choices:      null / ["あ）東京","い）大阪","う）名古屋","え）京都"]
     hint:         "ヒント"
     explanation:  "解説"
     displayType:  "text" / "calc"
     displayLeft:  23（calcのとき）
     displayOp:    "+"（calcのとき）
     displayRight: 47（calcのとき）
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