/* ============================================================
   firebase.js — Phase2対応版 ver2
   追加機能: saveSession（理解度スコア・アドバイスを保存）
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
  } catch (e) {
    console.error("signInUser:", e);
    return null;
  }
}

/* ============================================================
   認証：先生用（メール/パスワード）
============================================================ */
export async function signInTeacher(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (e) {
    console.error("signInTeacher:", e);
    return null;
  }
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
   セッション保存（フェーズ2）
   ステージ終了ごとに理解度スコアと学習結果を保存する

   Firestoreのデータ構造:
   users/{uid}/sessions/{自動ID}
     unitId:            "add"
     unitName:          "たし算の筆算"
     stageId:           1
     stageName:         "きほん"
     score:             4        ← 正解数
     understandingScore: 78      ← 理解度スコア(0〜100)
     hintCount:         1        ← ヒント使用回数
     avgTimeSec:        8.5      ← 平均解答時間(秒)
     cleared:           true
     advice:            "よくできました！..."
     createdAt:         timestamp
============================================================ */
export async function saveSession(uid, sessionData) {
  try {
    await addDoc(
      collection(db, "users", uid, "sessions"),
      { ...sessionData, createdAt: serverTimestamp() }
    );
  } catch (e) { console.error("saveSession:", e); }
}

/* ============================================================
   セッション履歴を取得（直近10件）
   管理者ダッシュボード・保護者画面で使う予定
============================================================ */
export async function getRecentSessions(uid, count = 10) {
  try {
    const q = query(
      collection(db, "users", uid, "sessions"),
      orderBy("createdAt", "desc"),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error("getRecentSessions:", e); return []; }
}

/* ============================================================
   問題の取得（子ども用）
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
  } catch (e) {
    console.error("getProblems:", e);
    return [];
  }
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
   問題の管理（先生用）
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