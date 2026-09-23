import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, setDoc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBq4v6W1igek7oh8cTS0M1mgBGrPXrgsl0",
  authDomain: "kitacat-historyvault.firebaseapp.com",
  projectId: "kitacat-historyvault",
  storageBucket: "kitacat-historyvault.firebasestorage.app",
  messagingSenderId: "1054498101484",
  appId: "1:1054498101484:web:0d18ae7f1b90bf7acbedc9",
  measurementId: "G-3DYP9C03M6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const setupScreen = document.getElementById('setup-screen');
const userDisplay = document.getElementById('user-display');

// Views
const topicsView = document.getElementById('topics-view');
const subtopicsView = document.getElementById('subtopics-view');
const infocardsView = document.getElementById('infocards-view');

// Lists
const topicsList = document.getElementById('topics-list');
const subtopicsList = document.getElementById('subtopics-list');
const infocardsList = document.getElementById('infocards-list');

// Forms
const createTopicForm = document.getElementById('create-topic-form');
const createSubtopicForm = document.getElementById('create-subtopic-form');
const createInfocardForm = document.getElementById('create-infocard-form');

// Breadcrumbs
const breadcrumbs = document.getElementById('breadcrumbs');
const navHome = document.getElementById('nav-home');
const navTopic = document.getElementById('nav-topic');
const navTopicDivider = document.getElementById('nav-topic-divider');
const navSubtopic = document.getElementById('nav-subtopic');
const navSubtopicDivider = document.getElementById('nav-subtopic-divider');

let currentUserData = null;
let currentTopicId = null;
let currentSubtopicId = null;
let unsubTopics, unsubSubtopics, unsubInfocards;

// --- AUTHENTICATION ---
document.getElementById('login-btn').addEventListener('click', async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } 
    catch (e) { alert("Login failed: " + e.message); }
});
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        authScreen.classList.add('hidden');
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
            currentUserData = userSnap.data();
            applyUserSettings();
            showApp();
        } else {
            setupScreen.classList.remove('hidden');
        }
    } else {
        authScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
        setupScreen.classList.add('hidden');
        if(unsubTopics) unsubTopics();
        if(unsubSubtopics) unsubSubtopics();
        if(unsubInfocards) unsubInfocards();
    }
});

// --- SETTINGS & SETUP ---
document.getElementById('setup-save-btn').addEventListener('click', async () => {
    const username = document.getElementById('setup-username').value.trim();
    const color = document.getElementById('setup-color').value;
    if (!username) return alert("Please enter a username!");
    currentUserData = { username, color, email: auth.currentUser.email };
    await setDoc(doc(db, "users", auth.currentUser.uid), currentUserData);
    setupScreen.classList.add('hidden');
    applyUserSettings();
    showApp();
});

document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-username').value = currentUserData.username;
    document.getElementById('settings-color').value = currentUserData.color;
    document.getElementById('settings-modal').classList.remove('hidden');
});
document.getElementById('settings-cancel-btn').addEventListener('click', () => document.getElementById('settings-modal').classList.add('hidden'));
document.getElementById('settings-save-btn').addEventListener('click', async () => {
    currentUserData.username = document.getElementById('settings-username').value.trim();
    currentUserData.color = document.getElementById('settings-color').value;
    await setDoc(doc(db, "users", auth.currentUser.uid), currentUserData, { merge: true });
    applyUserSettings();
    userDisplay.innerText = currentUserData.username;
    document.getElementById('settings-modal').classList.add('hidden');
});

function applyUserSettings() {
    document.documentElement.style.setProperty('--theme-color', currentUserData.color);
}

function showApp() {
    appScreen.classList.remove('hidden');
    userDisplay.innerText = currentUserData.username;
    navigateToHome();
}

// --- NAVIGATION ---
navHome.addEventListener('click', navigateToHome);
navTopic.addEventListener('click', () => {
    if(currentTopicId) navigateToTopic(currentTopicId, navTopic.innerText);
});

function navigateToHome() {
    currentTopicId = null; currentSubtopicId = null;
    topicsView.classList.remove('hidden');
    subtopicsView.classList.add('hidden');
    infocardsView.classList.add('hidden');
    breadcrumbs.classList.add('hidden');
    loadTopics();
}

function navigateToTopic(topicId, topicName) {
    currentTopicId = topicId; currentSubtopicId = null;
    topicsView.classList.add('hidden');
    subtopicsView.classList.remove('hidden');
    infocardsView.classList.add('hidden');
    
    breadcrumbs.classList.remove('hidden');
    navTopic.classList.remove('hidden');
    navTopicDivider.classList.remove('hidden');
    navTopic.innerText = topicName;
    navTopic.classList.add('nav-current');
    navSubtopic.classList.add('hidden');
    navSubtopicDivider.classList.add('hidden');
    
    document.getElementById('subtopics-title').innerText = `${topicName} > Subtopics`;
    loadSubtopics(topicId);
}

function navigateToSubtopic(subtopicId, subtopicName) {
    currentSubtopicId = subtopicId;
    subtopicsView.classList.add('hidden');
    infocardsView.classList.remove('hidden');
    
    navTopic.classList.remove('nav-current');
    navSubtopic.classList.remove('hidden');
    navSubtopicDivider.classList.remove('hidden');
    navSubtopic.innerText = subtopicName;
    
    document.getElementById('infocards-title').innerText = `Cards in ${subtopicName}`;
    loadInfoCards(subtopicId);
}

// --- DATA CREATION ---
createTopicForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('new-topic-name');
    if (!input.value.trim()) return;
    await addDoc(collection(db, "topics"), {
        name: input.value.trim(), createdBy: auth.currentUser.uid,
        creatorName: currentUserData.username, createdAt: Date.now()
    });
    input.value = '';
});

createSubtopicForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('new-subtopic-name');
    if (!input.value.trim() || !currentTopicId) return;
    await addDoc(collection(db, "subtopics"), {
        name: input.value.trim(), topicId: currentTopicId,
        createdBy: auth.currentUser.uid, creatorName: currentUserData.username, createdAt: Date.now()
    });
    input.value = '';
});

createInfocardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('new-infocard-content');
    if (!input.value.trim() || !currentSubtopicId) return;
    await addDoc(collection(db, "infocards"), {
        content: input.value.trim(), subtopicId: currentSubtopicId,
        createdBy: auth.currentUser.uid, creatorName: currentUserData.username, createdAt: Date.now()
    });
    input.value = '';
});

// --- DATA LOADING & RENDERING ---
function loadTopics() {
    if(unsubTopics) unsubTopics();
    const q = query(collection(db, "topics"));
    unsubTopics = onSnapshot(q, (snapshot) => {
        const docs = [];
        snapshot.forEach(d => docs.push({ id: d.id, ...d.data() }));
        docs.sort((a, b) => b.createdAt - a.createdAt); // Client side sort
        
        topicsList.innerHTML = '';
        docs.forEach(topic => {
            const div = document.createElement('div');
            div.className = 'item-card';
            div.innerHTML = `<div><h3>${topic.name}</h3><span class="meta">By ${topic.creatorName}</span></div>`;
            div.onclick = (e) => { if(!e.target.classList.contains('delete-btn')) navigateToTopic(topic.id, topic.name); };
            
            if (topic.createdBy === auth.currentUser.uid) {
                const btn = document.createElement('button');
                btn.className = 'delete-btn'; btn.innerText = 'Delete';
                btn.onclick = async () => { if(confirm("Delete this topic?")) await deleteDoc(doc(db, "topics", topic.id)); };
                div.appendChild(btn);
            }
            topicsList.appendChild(div);
        });
    });
}

function loadSubtopics(topicId) {
    if(unsubSubtopics) unsubSubtopics();
    const q = query(collection(db, "subtopics"), where("topicId", "==", topicId));
    unsubSubtopics = onSnapshot(q, (snapshot) => {
        const docs = [];
        snapshot.forEach(d => docs.push({ id: d.id, ...d.data() }));
        docs.sort((a, b) => b.createdAt - a.createdAt);
        
        subtopicsList.innerHTML = '';
        docs.forEach(sub => {
            const div = document.createElement('div');
            div.className = 'item-card';
            div.innerHTML = `<div><h3>${sub.name}</h3><span class="meta">By ${sub.creatorName}</span></div>`;
            div.onclick = (e) => { if(!e.target.classList.contains('delete-btn')) navigateToSubtopic(sub.id, sub.name); };
            
            if (sub.createdBy === auth.currentUser.uid) {
                const btn = document.createElement('button');
                btn.className = 'delete-btn'; btn.innerText = 'Delete';
                btn.onclick = async () => { if(confirm("Delete this subtopic?")) await deleteDoc(doc(db, "subtopics", sub.id)); };
                div.appendChild(btn);
            }
            subtopicsList.appendChild(div);
        });
    });
}

function loadInfoCards(subtopicId) {
    if(unsubInfocards) unsubInfocards();
    const q = query(collection(db, "infocards"), where("subtopicId", "==", subtopicId));
    unsubInfocards = onSnapshot(q, (snapshot) => {
        const docs = [];
        snapshot.forEach(d => docs.push({ id: d.id, ...d.data() }));
        docs.sort((a, b) => b.createdAt - a.createdAt);
        
        infocardsList.innerHTML = '';
        docs.forEach(card => {
            const div = document.createElement('div');
            div.className = 'info-card';
            div.innerHTML = `<p>${card.content}</p><span class="meta">— ${card.creatorName}</span><br>`;
            
            if (card.createdBy === auth.currentUser.uid) {
                const btn = document.createElement('button');
                btn.className = 'delete-btn'; btn.innerText = 'Delete Card';
                btn.onclick = async () => { if(confirm("Delete this Info-Card?")) await deleteDoc(doc(db, "infocards", card.id)); };
                div.appendChild(btn);
            }
            infocardsList.appendChild(div);
        });
    });
}
