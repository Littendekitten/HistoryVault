import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, setDoc, getDoc, query, where, onSnapshot as rawOnSnapshot } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

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

// Wrapper that shows Firestore errors on screen instead of failing silently
function onSnapshot(q, cb) {
    return rawOnSnapshot(q, cb, (err) => {
        console.error(err);
        let box = document.getElementById('db-error');
        if (!box) {
            box = document.createElement('div');
            box.id = 'db-error';
            box.className = 'guest-notice';
            box.style.cssText = 'margin-bottom:20px;color:#b91c1c;';
            document.querySelector('main').prepend(box);
        }
        box.textContent = 'Could not load data: ' + err.message + ' (check your Firestore rules are published)';
    });
}


// DOM Elements
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


// --- THEMES ---
const THEMES = ['light', 'dark', 'vip'];
function applyTheme(t) {
    if (!THEMES.includes(t)) t = 'light';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('hv-theme', t); } catch (e) {}
    return t;
}
try { applyTheme(localStorage.getItem('hv-theme')); } catch (e) { applyTheme('light'); }

function markSelected(containerId, theme) {
    document.querySelectorAll(`#${containerId} .theme-option`).forEach(b =>
        b.classList.toggle('selected', b.dataset.theme === theme));
}
function getSelected(containerId) {
    const b = document.querySelector(`#${containerId} .theme-option.selected`);
    return b ? b.dataset.theme : 'light';
}
// clicking an option previews it live
['setup-themes', 'settings-themes'].forEach(id => {
    document.querySelectorAll(`#${id} .theme-option`).forEach(btn =>
        btn.addEventListener('click', () => { markSelected(id, btn.dataset.theme); applyTheme(btn.dataset.theme); }));
});
markSelected('setup-themes', document.documentElement.dataset.theme);

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

let appStarted = false;

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function refreshCurrentView() {
    if (currentSubtopicId) loadInfoCards(currentSubtopicId);
    else if (currentTopicId) loadSubtopics(currentTopicId);
    else loadTopics();
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
            currentUserData = userSnap.data();
            applyUserSettings();
            userDisplay.innerText = currentUserData.username;
            document.body.classList.add('logged-in');
        } else {
            setupScreen.classList.remove('hidden');
            return; // finish after setup
        }
    } else {
        currentUserData = null;
        document.body.classList.remove('logged-in');
        setupScreen.classList.add('hidden');
        applyTheme('light');
    }
    if (!appStarted) { appStarted = true; navigateToHome(); }
    else refreshCurrentView(); // re-render so delete buttons match the user
});

// --- SETTINGS & SETUP ---
document.getElementById('setup-save-btn').addEventListener('click', async () => {
    const username = document.getElementById('setup-username').value.trim();
    const theme = getSelected('setup-themes');
    if (!username) return alert("Please enter a username!");
    currentUserData = { username, theme, email: auth.currentUser.email };
    await setDoc(doc(db, "users", auth.currentUser.uid), currentUserData);
    setupScreen.classList.add('hidden');
    applyUserSettings();
    userDisplay.innerText = currentUserData.username;
    document.body.classList.add('logged-in');
    if (!appStarted) { appStarted = true; navigateToHome(); } else refreshCurrentView();
});

document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-username').value = currentUserData.username;
    markSelected('settings-themes', currentUserData.theme || 'light');
    document.getElementById('settings-modal').classList.remove('hidden');
});
document.getElementById('settings-cancel-btn').addEventListener('click', () => {
    applyTheme(currentUserData.theme || 'light');
    document.getElementById('settings-modal').classList.add('hidden');
});
document.getElementById('settings-save-btn').addEventListener('click', async () => {
    currentUserData.username = document.getElementById('settings-username').value.trim();
    currentUserData.theme = getSelected('settings-themes');
    await setDoc(doc(db, "users", auth.currentUser.uid), currentUserData, { merge: true });
    applyUserSettings();
    userDisplay.innerText = currentUserData.username;
    document.getElementById('settings-modal').classList.add('hidden');
});

function applyUserSettings() {
    applyTheme(currentUserData.theme || 'light');
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
    if (!auth.currentUser || !input.value.trim()) return;
    await addDoc(collection(db, "topics"), {
        name: input.value.trim(), createdBy: auth.currentUser.uid,
        creatorName: currentUserData.username, createdAt: Date.now()
    });
    input.value = '';
});

createSubtopicForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('new-subtopic-name');
    if (!auth.currentUser || !input.value.trim() || !currentTopicId) return;
    await addDoc(collection(db, "subtopics"), {
        name: input.value.trim(), topicId: currentTopicId,
        createdBy: auth.currentUser.uid, creatorName: currentUserData.username, createdAt: Date.now()
    });
    input.value = '';
});

createInfocardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('new-infocard-content');
    if (!auth.currentUser || !input.value.trim() || !currentSubtopicId) return;
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
            div.innerHTML = `<div><h3>${esc(topic.name)}</h3><span class="meta">By ${esc(topic.creatorName)}</span></div>`;
            div.onclick = (e) => { if(!e.target.classList.contains('delete-btn')) navigateToTopic(topic.id, topic.name); };
            
            if (auth.currentUser && topic.createdBy === auth.currentUser.uid) {
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
            div.innerHTML = `<div><h3>${esc(sub.name)}</h3><span class="meta">By ${esc(sub.creatorName)}</span></div>`;
            div.onclick = (e) => { if(!e.target.classList.contains('delete-btn')) navigateToSubtopic(sub.id, sub.name); };
            
            if (auth.currentUser && sub.createdBy === auth.currentUser.uid) {
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
            div.innerHTML = `<p>${esc(card.content)}</p><span class="meta">— ${esc(card.creatorName)}</span><br>`;
            
            if (auth.currentUser && card.createdBy === auth.currentUser.uid) {
                const btn = document.createElement('button');
                btn.className = 'delete-btn'; btn.innerText = 'Delete Card';
                btn.onclick = async () => { if(confirm("Delete this Info-Card?")) await deleteDoc(doc(db, "infocards", card.id)); };
                div.appendChild(btn);
            }
            infocardsList.appendChild(div);
        });
    });
}
