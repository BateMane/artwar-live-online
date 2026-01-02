export const CONFIG = {
    passwords: { player: "1234", admin: "admin" },
    ranks: [
        { name: "NOVICE 🥚", min: 0 },
        { name: "FOUFOU 🤪", min: 100 },
        { name: "RESPECTÉ 🤝", min: 300 },
        { name: "PRO 🎨", min: 600 },
        { name: "ROYAL 👑", min: 1000 },
        { name: "MASTER 👹", min: 2000 }
    ],
    // BADGES
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

        // --- NOUVEAUX BADGES ---
        master: { icon: "👹", name: "Master", desc: "L'élite absolue (2000 ELO)." },
        nolife: { icon: "🧟", name: "No Life", desc: "15 semaines de suite. Va toucher de l'herbe." }
    },
    keys: { 
        users: 'artwar_users', 
        subs: 'artwar_subs', 
        challenge: 'artwar_challenge', 
        reviewState: 'artwar_is_reviewing',
        deadline: 'artwar_deadline'
    },
    decay: 50,
    defaultAvatar: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=ArtWar"
};

export const DB = {
    get: (k) => JSON.parse(localStorage.getItem(k)) || [],
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
    getObj: (k) => JSON.parse(localStorage.getItem(k)) || null,
    
    init: () => {
        if (!DB.getObj(CONFIG.keys.challenge)) {
            DB.set(CONFIG.keys.challenge, { id: Date.now(), title: "EN ATTENTE", desc: "Attente du juge..." });
        }
        if (localStorage.getItem(CONFIG.keys.reviewState) === null) {
            localStorage.setItem(CONFIG.keys.reviewState, 'false');
        }
        
        // Migration données users
        const users = DB.get(CONFIG.keys.users);
        let updated = false;
        users.forEach(u => {
            if(!u.unlockedBadges) { u.unlockedBadges = []; updated = true; }
            if(!u.equippedBadges) { u.equippedBadges = []; updated = true; }
            // Init streak pour les anciens users
            if(u.streak === undefined) { u.streak = 0; updated = true; }
        });
        if(updated) DB.set(CONFIG.keys.users, users);
    }
};