// --- IMPORTATION DES SERVICES FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- COLLE TA CONFIG FIREBASE ICI ---
const firebaseConfig = {
  apiKey: "AIzaSyDk9n-VM1jT3EFjPKqELQMV0rAwkqnkAcI",
  authDomain: "artwar-live.firebaseapp.com",
  projectId: "artwar-live",
  storageBucket: "artwar-live.firebasestorage.app",
  messagingSenderId: "348613530404",
  appId: "1:348613530404:web:2762695ef38c39c5ec99b1"
};

// Initialisation
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Connexion anonyme automatique pour accéder à la DB
signInAnonymously(auth).catch((error) => {
    console.error("Erreur Auth Anonyme:", error);
});

export const CONFIG = {
    passwords: { player: "1234", admin: "admin" }, // Reste pour le pseudo-login
    ranks: [
        { name: "NOVICE 🥚", min: 0 },
        { name: "FOUFOU 🤪", min: 100 },
        { name: "RESPECTÉ 🤝", min: 300 },
        { name: "PRO 🎨", min: 600 },
        { name: "ROYAL 👑", min: 1000 },
        { name: "MASTER 👹", min: 2000 }
    ],
    badges: {
        first: { icon: "⚡", name: "Speedrun", desc: "Premier à poster un dessin." },
        prout: { icon: "💩", name: "Stinky", desc: "A reçu un vote PROUT légendaire." },
        goat: { icon: "🐐", name: "G.O.A.T", desc: "Reconnu comme le meilleur." },
        honor: { icon: "🎖️", name: "Honneur", desc: "Badge spécial donné par l'Admin." },
        night: { icon: "🌙", name: "Insomniaque", desc: "Joue tard dans la nuit." },
        elite: { icon: "💎", name: "Elite", desc: "A atteint 500 ELO." },
        veteran: { icon: "⚔️", name: "Vétéran", desc: "A participé 5 fois." },
        cool: { icon: "✨", name: "Cool", desc: "A reçu un vote Cool." },
        meh: { icon: "😐", name: "Bof", desc: "A reçu un vote Bof." },
        star: { icon: "📸", name: "Star", desc: "A personnalisé son avatar." },
        master: { icon: "👹", name: "Master", desc: "L'élite absolue (2000 ELO)." },
        nolife: { icon: "🧟", name: "No Life", desc: "15 semaines de suite. Va toucher de l'herbe." }
    },
    decay: 50,
    defaultAvatar: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=ArtWar"
};

// --- NOUVELLE ABSTRACTION DB (ASYNCHRONE) ---
export const DB = {
    // Récupérer une collection entière (ex: 'users', 'subs')
    get: async (collectionName) => {
        const querySnapshot = await getDocs(collection(db, collectionName));
        let data = [];
        querySnapshot.forEach((doc) => {
            data.push(doc.data());
        });
        return data;
    },

    // Sauvegarder/Remplacer un document spécifique (ex: un user par son ID)
    set: async (collectionName, docId, data) => {
        await setDoc(doc(db, collectionName, String(docId)), data);
    },

    // Récupérer un objet de config unique (Challenge, settings...)
    getObj: async (docName) => {
        const docRef = doc(db, "settings", docName);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return null;
        }
    },

    // Sauvegarder un objet de config
    setObj: async (docName, data) => {
        await setDoc(doc(db, "settings", docName), data);
    },

    // Supprimer un doc
    delete: async (collectionName, docId) => {
        await deleteDoc(doc(db, collectionName, String(docId)));
    },

    // Upload image vers Firebase Storage
    uploadImage: async (file, path) => {
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        return url;
    },

    init: async () => {
        // Vérif Init Challenge
        const ch = await DB.getObj("challenge");
        if (!ch) {
            await DB.setObj("challenge", { id: Date.now(), title: "EN ATTENTE", desc: "Attente du juge..." });
        }
        // Vérif Init Review State
        const rs = await DB.getObj("reviewState");
        if (!rs) {
            await DB.setObj("reviewState", { isReviewing: false });
        }
    }
};