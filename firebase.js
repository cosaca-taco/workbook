/* ============================================================
   firebase.js — マスターデータ対応版
   grades / subjects / units を Firestore で管理
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
  query, where, orderBy, limit, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
   認証
============================================================ */
export async function signInUser() {
  try { return (await signInAnonymously(auth)).user; }
  catch(e) { console.error("signInUser:", e); return null; }
}
export async function signInTeacher(email, password) {
  try { return (await signInWithEmailAndPassword(auth, email, password)).user; }
  catch(e) { console.error("signInTeacher:", e); return null; }
}
export async function signOutUser() {
  try { await signOut(auth); } catch(e) { console.error("signOut:", e); }
}

/* ============================================================
   マスターデータ取得
   grades / subjects / units を Firestore から取得する

   Firestoreのデータ構造:
   grades/{gradeId}          例: "g2"
     name:        "2年生"
     order:       2
     isPublished: true

   subjects/{subjectId}      例: "math"
     name:        "算数"
     icon:        "🔢"
     color:       "#EF9F27"
     order:       1
     isPublished: true

   units/{unitId}            例: "add"
     gradeId:     "g2"
     subjectId:   "math"
     name:        "たし算の筆算"
     icon:        "➕"
     chapter:     "だい1しょう"
     description: "くり上がりのあるたし算"
     order:       1
     hasAutoGen:  true   ← JS自動生成に対応しているか
     isPublished: true
============================================================ */
export async function getGrades() {
  try {
    const snap = await getDocs(collection(db,"grades"));
    return snap.docs
      .map(d=>({id:d.id,...d.data()}))
      .filter(g=>g.isPublished!==false)
      .sort((a,b)=>(a.order||0)-(b.order||0));
  } catch(e) { console.error("getGrades:",e); return []; }
}

export async function getSubjects() {
  try {
    const snap = await getDocs(collection(db,"subjects"));
    return snap.docs
      .map(d=>({id:d.id,...d.data()}))
      .filter(s=>s.isPublished!==false)
      .sort((a,b)=>(a.order||0)-(b.order||0));
  } catch(e) { console.error("getSubjects:",e); return []; }
}

export async function getUnits() {
  try {
    const snap = await getDocs(collection(db,"units"));
    return snap.docs
      .map(d=>({id:d.id,...d.data()}))
      .filter(u=>u.isPublished!==false)
      .sort((a,b)=>(a.order||0)-(b.order||0));
  } catch(e) { console.error("getUnits:",e); return []; }
}

/* 全マスターデータを一括取得（ログイン時に1回だけ呼ぶ） */
export async function getMasterData() {
  const [grades, subjects, units] = await Promise.all([
    getGrades(), getSubjects(), getUnits()
  ]);
  return { grades, subjects, units };
}

/* ============================================================
   マスターデータ管理（先生用）
============================================================ */

/* 学年 */
export async function getAllGrades() {
  try {
    const snap = await getDocs(query(collection(db,"grades"), orderBy("order")));
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  } catch(e) { console.error("getAllGrades:",e); return []; }
}
export async function saveGrade(id, data) {
  try {
    await setDoc(doc(db,"grades",id), {...data, updatedAt:serverTimestamp()}, {merge:true});
    return true;
  } catch(e) { console.error("saveGrade:",e); return false; }
}
export async function deleteGrade(id) {
  try { await deleteDoc(doc(db,"grades",id)); return true; }
  catch(e) { console.error("deleteGrade:",e); return false; }
}

/* 科目 */
export async function getAllSubjects() {
  try {
    const snap = await getDocs(query(collection(db,"subjects"), orderBy("order")));
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  } catch(e) { console.error("getAllSubjects:",e); return []; }
}
export async function saveSubject(id, data) {
  try {
    await setDoc(doc(db,"subjects",id), {...data, updatedAt:serverTimestamp()}, {merge:true});
    return true;
  } catch(e) { console.error("saveSubject:",e); return false; }
}
export async function deleteSubject(id) {
  try { await deleteDoc(doc(db,"subjects",id)); return true; }
  catch(e) { console.error("deleteSubject:",e); return false; }
}

/* 単元 */
export async function getAllUnits() {
  try {
    const snap = await getDocs(query(collection(db,"units"), orderBy("order")));
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  } catch(e) { console.error("getAllUnits:",e); return []; }
}
export async function saveUnit(id, data) {
  try {
    await setDoc(doc(db,"units",id), {...data, updatedAt:serverTimestamp()}, {merge:true});
    return true;
  } catch(e) { console.error("saveUnit:",e); return false; }
}
export async function deleteUnit(id) {
  try { await deleteDoc(doc(db,"units",id)); return true; }
  catch(e) { console.error("deleteUnit:",e); return false; }
}

/* ============================================================
   初期データ投入
   管理画面の「初期データを投入」ボタンで1回だけ実行する
============================================================ */
export async function seedMasterData() {
  const batch = writeBatch(db);

  /* 学年 */
  const grades = [
    { id:"g2", name:"2年生", order:2, isPublished:true },
    { id:"g3", name:"3年生", order:3, isPublished:true },
  ];
  grades.forEach(g=>{
    batch.set(doc(db,"grades",g.id), {...g, createdAt:serverTimestamp(), updatedAt:serverTimestamp()}, {merge:true});
  });

  /* 科目 */
  const subjects = [
    { id:"math",     name:"算数", icon:"🔢", color:"#EF9F27", order:1, isPublished:true },
    { id:"japanese", name:"国語", icon:"📝", color:"#2D7A4F", order:2, isPublished:true },
    { id:"science",  name:"理科", icon:"🔬", color:"#2563EB", order:3, isPublished:true },
  ];
  subjects.forEach(s=>{
    batch.set(doc(db,"subjects",s.id), {...s, createdAt:serverTimestamp(), updatedAt:serverTimestamp()}, {merge:true});
  });

  /* 単元（2年生・算数） */
  const units = [
    { id:"add",   gradeId:"g2", subjectId:"math", name:"たし算の筆算",   icon:"➕", chapter:"だい1しょう", description:"くり上がりのあるたし算", order:101, hasAutoGen:true,  isPublished:true },
    { id:"sub",   gradeId:"g2", subjectId:"math", name:"ひき算の筆算",   icon:"➖", chapter:"だい2しょう", description:"くり下がりのあるひき算", order:102, hasAutoGen:true,  isPublished:true },
    { id:"num",   gradeId:"g2", subjectId:"math", name:"1000までの数",  icon:"🔢", chapter:"だい3しょう", description:"大きい数のしくみ",         order:103, hasAutoGen:true,  isPublished:true },
    { id:"len",   gradeId:"g2", subjectId:"math", name:"長さ",           icon:"📏", chapter:"だい4しょう", description:"cmとmmをつかおう",         order:104, hasAutoGen:true,  isPublished:true },
    { id:"vol",   gradeId:"g2", subjectId:"math", name:"かさ",           icon:"🫙", chapter:"だい5しょう", description:"L・dLのたんい",             order:105, hasAutoGen:true,  isPublished:true },
    { id:"time",  gradeId:"g2", subjectId:"math", name:"時こくと時間",   icon:"⏰", chapter:"だい6しょう", description:"時間のけいさん",             order:106, hasAutoGen:true,  isPublished:true },
    { id:"mul",   gradeId:"g2", subjectId:"math", name:"かけ算（九九）", icon:"✖️", chapter:"だい7しょう", description:"九九をマスター！",           order:107, hasAutoGen:true,  isPublished:true },
    { id:"shape", gradeId:"g2", subjectId:"math", name:"三角形と四角形", icon:"🔷", chapter:"だい8しょう", description:"図形のとくちょう",           order:108, hasAutoGen:true,  isPublished:true },
    /* 2年生・国語 */
    { id:"kanji2",   gradeId:"g2", subjectId:"japanese", name:"かん字",    icon:"🔤", chapter:"だい1しょう", description:"2年生のかん字をおぼえよう", order:201, hasAutoGen:false, isPublished:true },
    { id:"reading2", gradeId:"g2", subjectId:"japanese", name:"よむこと",  icon:"📖", chapter:"だい2しょう", description:"文しょうをよんで答えよう",   order:202, hasAutoGen:false, isPublished:true },
    { id:"kotoba2",  gradeId:"g2", subjectId:"japanese", name:"ことば",    icon:"💬", chapter:"だい3しょう", description:"ことばのいみをおぼえよう",   order:203, hasAutoGen:false, isPublished:true },
    { id:"bunpo2",   gradeId:"g2", subjectId:"japanese", name:"文のしくみ",icon:"✍️", chapter:"だい4しょう", description:"文のきまりをおぼえよう",     order:204, hasAutoGen:false, isPublished:true },
    /* 2年生・理科 */
    { id:"shizen3",  gradeId:"g2", subjectId:"science", name:"しぜんのかんさつ", icon:"🌱", chapter:"だい1しょう", description:"しぜんをよくかんさつしよう", order:301, hasAutoGen:false, isPublished:true },
    { id:"konchu3",  gradeId:"g2", subjectId:"science", name:"こん虫",           icon:"🐛", chapter:"だい2しょう", description:"こん虫のからだとせいかつ",   order:302, hasAutoGen:false, isPublished:true },
    { id:"kage3",    gradeId:"g2", subjectId:"science", name:"日光とかげ",       icon:"☀️", chapter:"だい3しょう", description:"日光とかげのかんけい",       order:303, hasAutoGen:false, isPublished:true },
    { id:"jishaku3", gradeId:"g2", subjectId:"science", name:"じしゃく",         icon:"🧲", chapter:"だい4しょう", description:"じしゃくのふしぎをしろう",   order:304, hasAutoGen:false, isPublished:true },
    /* 3年生・算数 */
    { id:"div3",      gradeId:"g3", subjectId:"math", name:"わり算",            icon:"➗", chapter:"だい1しょう",  description:"わり算の意味と計算",         order:1001, hasAutoGen:true,  isPublished:true },
    { id:"remDiv3",   gradeId:"g3", subjectId:"math", name:"あまりのあるわり算",icon:"📐", chapter:"だい2しょう",  description:"あまりの処理を学ぼう",       order:1002, hasAutoGen:true,  isPublished:true },
    { id:"bigNum3",   gradeId:"g3", subjectId:"math", name:"大きい数（万）",    icon:"🔢", chapter:"だい3しょう",  description:"万・十万・百万・千万",       order:1003, hasAutoGen:true,  isPublished:true },
    { id:"decimal3",  gradeId:"g3", subjectId:"math", name:"小数",              icon:"🔸", chapter:"だい4しょう",  description:"0.1のしくみと計算",         order:1004, hasAutoGen:true,  isPublished:true },
    { id:"fraction3", gradeId:"g3", subjectId:"math", name:"分数",              icon:"🍕", chapter:"だい5しょう",  description:"分数の意味と計算",           order:1005, hasAutoGen:true,  isPublished:true },
    { id:"km3",       gradeId:"g3", subjectId:"math", name:"長さ（km）",        icon:"📏", chapter:"だい6しょう",  description:"km・m・cmの関係",           order:1006, hasAutoGen:true,  isPublished:true },
    { id:"weight3",   gradeId:"g3", subjectId:"math", name:"重さ",              icon:"⚖️", chapter:"だい7しょう",  description:"kg・gのたんい",             order:1007, hasAutoGen:true,  isPublished:true },
    { id:"circle3",   gradeId:"g3", subjectId:"math", name:"円と球",            icon:"⭕", chapter:"だい8しょう",  description:"半径・直径のしくみ",         order:1008, hasAutoGen:true,  isPublished:true },
    { id:"barGraph3", gradeId:"g3", subjectId:"math", name:"棒グラフ",          icon:"📊", chapter:"だい9しょう",  description:"グラフの読み方・かき方",     order:1009, hasAutoGen:true,  isPublished:true },
    { id:"timeCalc3", gradeId:"g3", subjectId:"math", name:"時間の計算",        icon:"⏱️", chapter:"だい10しょう", description:"時間・分・秒の計算",         order:1010, hasAutoGen:true,  isPublished:true },
    /* 3年生・国語 */
    { id:"kanji3",    gradeId:"g3", subjectId:"japanese", name:"漢字（3年）",  icon:"🔤", chapter:"だい1しょう", description:"3年生の漢字をおぼえよう",   order:1101, hasAutoGen:false, isPublished:true },
    { id:"kotowaza3", gradeId:"g3", subjectId:"japanese", name:"ことわざ",     icon:"📜", chapter:"だい2しょう", description:"ことわざの意味をおぼえよう", order:1102, hasAutoGen:false, isPublished:true },
    { id:"romaji3",   gradeId:"g3", subjectId:"japanese", name:"ローマ字",     icon:"🔡", chapter:"だい3しょう", description:"アルファベットと日本語",     order:1103, hasAutoGen:false, isPublished:true },
    { id:"reading3",  gradeId:"g3", subjectId:"japanese", name:"文章読解",     icon:"📖", chapter:"だい4しょう", description:"説明文・物語文の読み取り",   order:1104, hasAutoGen:false, isPublished:true },
    /* 3年生・理科 */
    { id:"plant3",  gradeId:"g3", subjectId:"science", name:"植物の育ち",  icon:"🌱", chapter:"だい1しょう", description:"種・芽・葉・花・実の順番", order:1201, hasAutoGen:false, isPublished:true },
    { id:"insect3", gradeId:"g3", subjectId:"science", name:"こん虫",      icon:"🐛", chapter:"だい2しょう", description:"からだのつくり・育ち方",   order:1202, hasAutoGen:false, isPublished:true },
    { id:"sun3",    gradeId:"g3", subjectId:"science", name:"太陽と地面",  icon:"☀️", chapter:"だい3しょう", description:"影のでき方・方位",         order:1203, hasAutoGen:false, isPublished:true },
    { id:"magnet3", gradeId:"g3", subjectId:"science", name:"磁石",        icon:"🧲", chapter:"だい4しょう", description:"N極・S極のふしぎ",         order:1204, hasAutoGen:false, isPublished:true },
  ];
  units.forEach(u=>{
    batch.set(doc(db,"units",u.id), {...u, createdAt:serverTimestamp(), updatedAt:serverTimestamp()}, {merge:true});
  });

  await batch.commit();
  return true;
}

/* ============================================================
   ユーザー管理
============================================================ */
export async function createUserIfNew(uid, name) {
  try {
    const ref = doc(db,"users",uid);
    const snap = await getDoc(ref);
    if(!snap.exists()) {
      await setDoc(ref, { name, progress:{}, createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
    }
  } catch(e) { console.error("createUserIfNew:",e); }
}
export async function loadProgress(uid) {
  try {
    const snap = await getDoc(doc(db,"users",uid));
    return snap.exists() ? (snap.data().progress||{}) : {};
  } catch(e) { console.error("loadProgress:",e); return {}; }
}
export async function saveProgress(uid, name, progress) {
  try {
    await setDoc(doc(db,"users",uid), {name,progress,updatedAt:serverTimestamp()}, {merge:true});
  } catch(e) { console.error("saveProgress:",e); }
}

/* ============================================================
   セッション管理
============================================================ */
export async function saveSession(uid, sessionData) {
  try {
    await addDoc(collection(db,"users",uid,"sessions"), {...sessionData, createdAt:serverTimestamp()});
  } catch(e) { console.error("saveSession:",e); }
}
export async function getUserSessions(uid, count=20) {
  try {
    const snap = await getDocs(query(collection(db,"users",uid,"sessions"), orderBy("createdAt","desc"), limit(count)));
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  } catch(e) { console.error("getUserSessions:",e); return []; }
}
export async function getAllUsers() {
  try {
    const snap = await getDocs(collection(db,"users"));
    return snap.docs.map(d=>({uid:d.id,...d.data()}));
  } catch(e) { console.error("getAllUsers:",e); return []; }
}
export async function getUserByName(name) {
  try {
    const snap = await getDocs(query(collection(db,"users"), where("name","==",name)));
    return snap.docs.map(d=>({uid:d.id,...d.data()}));
  } catch(e) { console.error("getUserByName:",e); return []; }
}

/* ============================================================
   問題管理
============================================================ */
export async function getProblems(unitId, stageId) {
  try {
    const snap = await getDocs(query(
      collection(db,"problems"),
      where("unitId","==",unitId)
    ));
    const all = snap.docs.map(d=>({id:d.id,...d.data()}));

    /* デバッグログ */
    console.log(`[getProblems] unitId="${unitId}" stageId=${stageId}(${typeof stageId})`);
    console.log(`[getProblems] Firestoreから ${all.length} 件取得`);
    all.forEach((p,i)=>{
      console.log(`  [${i}] stageId=${p.stageId}(${typeof p.stageId}) isPublished=${p.isPublished}(${typeof p.isPublished}) unitId=${p.unitId}`);
    });

    /* stageId の型を合わせてフィルタ */
    const list = all.filter(p => {
      const stageMatch = Number(p.stageId) === Number(stageId);
      const pubMatch   = p.isPublished === true || p.isPublished === "true";
      return stageMatch && pubMatch;
    });
    console.log(`[getProblems] フィルタ後 ${list.length} 件`);

    if(list.length<5) return [];
    return shuffleArray(list).slice(0,5);
  } catch(e) { console.error("[getProblems] エラー:",e); return []; }
}
function shuffleArray(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

export async function getAllProblems() {
  try {
    const snap = await getDocs(query(collection(db,"problems"), orderBy("createdAt","desc")));
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  } catch(e) { console.error("getAllProblems:",e); return []; }
}
export async function addProblem(data) {
  try {
    const ref = await addDoc(collection(db,"problems"), {...data, isPublished:data.isPublished??true, createdAt:serverTimestamp(), updatedAt:serverTimestamp()});
    return ref.id;
  } catch(e) { console.error("addProblem:",e); return null; }
}
export async function updateProblem(id, data) {
  try { await updateDoc(doc(db,"problems",id), {...data, updatedAt:serverTimestamp()}); return true; }
  catch(e) { console.error("updateProblem:",e); return false; }
}
export async function deleteProblem(id) {
  try { await deleteDoc(doc(db,"problems",id)); return true; }
  catch(e) { console.error("deleteProblem:",e); return false; }
}

/* ============================================================
   動画管理
============================================================ */
export async function getAllUnitVideos() {
  try {
    const snap = await getDocs(collection(db,"unitVideos"));
    const r={};snap.docs.forEach(d=>{r[d.id]=d.data();});return r;
  } catch(e) { console.error("getAllUnitVideos:",e); return {}; }
}
export async function saveUnitVideos(unitId, urls) {
  try {
    await setDoc(doc(db,"unitVideos",unitId), {unitId,...urls,updatedAt:serverTimestamp()}, {merge:true});
    return true;
  } catch(e) { console.error("saveUnitVideos:",e); return false; }
}
export function toYouTubeEmbedUrl(url) {
  if(!url)return null;
  const m1=url.match(/[?&]v=([^&]+)/);if(m1)return`https://www.youtube.com/embed/${m1[1]}`;
  const m2=url.match(/youtu\.be\/([^?&]+)/);if(m2)return`https://www.youtube.com/embed/${m2[1]}`;
  if(url.includes('/embed/'))return url;
  return null;
}