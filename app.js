// Import Firebase modules directly from CDN (perfect for GitHub Pages)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    setDoc, 
    getDoc,
    query,
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Your exact Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBq4v6W1igek7oh8cTS0M1mgBGrPXrgsl0",
  authDomain: "kitacat-historyvault.firebaseapp.com",
  projectId: "kitacat-historyvault",
  storageBucket: "kitacat-historyvault.firebasestorage.app",
  messagingSenderId: "1054498101484",
  appId: "1:1054498101484:web:0d18ae7f1b90bf7acbedc9",
  measurementId: "G-3DYP9C03M6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const setupScreen = document.getElementById('setup-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userDisplay = document.getElementById('user-display');
const topicsList = document.getElementById('topics-list');
const createTopicForm = document.getElementById('create-topic-form');
const newTopicName = document.getElementById('new-topic-name');

// Settings Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsSaveBtn = document.getElementById('settings-save-btn');
const settingsCancelBtn = document.getElementById('settings-cancel-btn');
const settingsUsername = document.getElementById('settings-username');
const settingsColor = document.getElementById('settings-color');

// Setup Elements
const setupSaveBtn = document.getElementById('setup-save-btn');
const setupUsername = document.getElementById('setup-username');
const setupColor = document.getElementById('setup-color');

let currentUserData = null;

// Handle Login
loginBtn.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login failed", error);
        alert("Login failed: " + error.message);
    }
});

// Handle Logout
logoutBtn.addEventListener('click', () => signOut(auth));

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        authScreen.classList.add('hidden');
        
        // Check if user exists in Firestore
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            currentUserData = userSnap.data();
            applyUserSettings();
            showMainApp();
        } else {
            // First time login - prompt setup
            setupScreen.classList.remove('hidden');
        }
    } else {
        authScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
        setupScreen.classList.add('hidden');
    }
});

// First Time Setup Save
setupSaveBtn.addEventListener('click', async () => {
    const username = setupUsername.value.trim();
    const color = setupColor.value;
    if (!username) return alert("Please enter a username!");

    const user = auth.currentUser;
    const userData = { username, color, email: user.email };

    await setDoc(doc(db, "users", user.uid), userData);
    currentUserData = userData;
    
    setupScreen.classList.add('hidden');
    applyUserSettings();
    showMainApp();
});

// Show Main App & Load Data
function showMainApp() {
    appScreen.classList.remove('hidden');
    userDisplay.innerText = `Welcome, ${currentUserData.username}`;
    loadTopics();
}

// Apply Theme Settings
function applyUserSettings() {
    document.documentElement.style.setProperty('--theme-color', currentUserData.color);
}

// Create a Topic
createTopicForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = newTopicName.value.trim();
    if (!name) return;

    try {
        await addDoc(collection(db, "topics"), {
            name: name,
            createdBy: auth.currentUser.uid,
            creatorName: currentUserData.username,
            createdAt: new Date()
        });
        newTopicName.value = '';
    } catch (error) {
        console.error("Error creating topic", error);
    }
});

// Load Topics in Real-time
function loadTopics() {
    const q = query(collection(db, "topics"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        topicsList.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const topic = docSnap.data();
            const topicId = docSnap.id;

            const div = document.createElement('div');
            div.className = 'topic-card';
            div.innerHTML = `
                <h3>${topic.name}</h3>
                <p>Created by: ${topic.creatorName}</p>
            `;

            // Only show delete button if the logged-in user created this topic
            if (topic.createdBy === auth.currentUser.uid) {
                const delBtn = document.createElement('button');
                delBtn.className = 'delete-btn';
                delBtn.innerText = 'Delete Topic';
                delBtn.onclick = async () => {
                    if(confirm("Are you sure you want to delete this topic?")) {
                        await deleteDoc(doc(db, "topics", topicId));
                    }
                };
                div.appendChild(delBtn);
            }
            topicsList.appendChild(div);
        });
    });
}

// --- Settings Modal Logic ---
settingsBtn.addEventListener('click', () => {
    settingsUsername.value = currentUserData.username;
    settingsColor.value = currentUserData.color;
    settingsModal.classList.remove('hidden');
});

settingsCancelBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

settingsSaveBtn.addEventListener('click', async () => {
    const newUsername = settingsUsername.value.trim();
    const newColor = settingsColor.value;
    if (!newUsername) return;

    const user = auth.currentUser;
    currentUserData.username = newUsername;
    currentUserData.color = newColor;

    await setDoc(doc(db, "users", user.uid), currentUserData, { merge: true });
    
    applyUserSettings();
    userDisplay.innerText = `Welcome, ${currentUserData.username}`;
    settingsModal.classList.add('hidden');
});
