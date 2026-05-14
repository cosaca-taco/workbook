/* ============================================================
   firebase.js
   Firebase の初期化・認証・Firestore 操作をまとめたファイル
   index.html から import して使う
============================================================ */

// Firebase SDK（CDN経由）
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ============================================================
   Firebase 設定
   ※ APIキーはGitHubに公開されますが、セキュリティルールで保護されているので問題ありません
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

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

/* ============================================================
   匿名サインイン
   子どもがアカウント作成なしで使えるようにする
   戻り値: Firebase User オブジェクト（失敗時は null）
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
   ユーザーを初回作成する
   すでに存在する場合は何もしない
============================================================ */
export async function createUserIfNew(uid, name) {
  try {
    const ref  = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        name,
        gradeId:   "g2",
        progress:  {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.error("createUserIfNew:", e);
  }
}

/* ============================================================
   進捗を読み込む
   戻り値: progress オブジェクト（例: { add: { s1: {cleared, bestScore} } }）
============================================================ */
export async function loadProgress(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) return snap.data().progress || {};
    return {};
  } catch (e) {
    console.error("loadProgress:", e);
    return {};
  }
}

/* ============================================================
   進捗を保存する
   progress オブジェクトごと上書き（merge: true で他フィールドは保持）

   Firestoreのデータ構造:
   users/{uid}/
     name: "たろう"
     gradeId: "g2"
     progress: {
       add: {
         s1: { cleared: true,  bestScore: 5 },
         s2: { cleared: false, bestScore: 3 },
         s3: { cleared: false, bestScore: 0 },
       },
       sub: { ... },
       mul: { ... },
     }
     createdAt: timestamp
     updatedAt: timestamp
============================================================ */
export async function saveProgress(uid, name, progress) {
  try {
    await setDoc(
      doc(db, "users", uid),
      { name, progress, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (e) {
    console.error("saveProgress:", e);
  }
}