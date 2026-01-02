import { CONFIG, DB } from "./config.js";
import { UI } from "./ui.js";
import { AudioMgr } from "./audio.js";
import { animate } from "https://cdn.jsdelivr.net/npm/motion@10.18.0/+esm";

export const Admin = {
    reviewQueue: [],
    currentReviewIndex: 0,
    participatingUserIds: new Set(),

    init: () => {
        Admin.setupDashboard();
        Admin.setupReview();
        Admin.setupUserMgmt();
    },

    setupDashboard: () => {
        document.getElementById('btn-edit-challenge').addEventListener('click', () => UI.showView('view-edit-challenge'));
        
        document.getElementById('save-challenge').addEventListener('click', () => {
            DB.set(CONFIG.keys.challenge, { 
                id: Date.now(), 
                title: document.getElementById('input-challenge-title').value, 
                desc: document.getElementById('input-challenge-desc').value 
            });
            localStorage.setItem(CONFIG.keys.reviewState, 'false');
            
            const deadlineInput = document.getElementById('input-deadline').value;
            if(deadlineInput) {
                const timestamp = new Date(deadlineInput).getTime();
                localStorage.setItem(CONFIG.keys.deadline, timestamp);
            } else {
                localStorage.removeItem(CONFIG.keys.deadline);
            }

            AudioMgr.playSound('sfx-yeah');
            alert("Nouveau Défi lancé !");
            UI.showView('view-admin-menu');
        });

        document.getElementById('btn-launch-review').addEventListener('click', () => {
            localStorage.setItem(CONFIG.keys.reviewState, 'true');
            Admin.reviewQueue = DB.get(CONFIG.keys.subs).filter(s => s.status === 'pending');
            Admin.participatingUserIds = new Set(Admin.reviewQueue.map(s => s.userId)); 
            Admin.currentReviewIndex = 0;
            document.body.classList.add('review-mode'); 
            UI.showView('view-review');
            Admin.nextReview();
        });
    },

    setupReview: () => {
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', (e) => Admin.triggerVote(btn, e.clientX, e.clientY));
        });

        document.addEventListener('keydown', (e) => {
            if(document.getElementById('view-review').classList.contains('hidden')) return;
            const map = { '1':0, '2':1, '3':2, '4':3, '5':4 };
            if(map.hasOwnProperty(e.key)) {
                const btn = document.querySelectorAll('.vote-btn')[map[e.key]];
                if(btn) {
                    const rect = btn.getBoundingClientRect();
                    Admin.triggerVote(btn, rect.x + rect.width/2, rect.y + rect.height/2);
                    UI.animateButton(btn);
                }
            }
        });

        document.getElementById('btn-finish-session').addEventListener('click', Admin.finishSession);
    },

    triggerVote: (btn, x, y) => {
        if(Admin.currentReviewIndex >= Admin.reviewQueue.length) return;
        const sfxName = btn.dataset.sfx;
        if(sfxName) AudioMgr.playSound(`sfx-${sfxName}`);

        const score = parseInt(btn.dataset.score);
        Admin.resolveVote(score);
        
        let intensity = 1;
        if(Math.abs(score) > 10) intensity = 2;
        if(Math.abs(score) > 30) intensity = 3;
        if(Math.abs(score) >= 50) intensity = 5;
        UI.triggerVFX(intensity, x, y, btn.dataset.anim);
    },

    nextReview: () => {
        if (Admin.currentReviewIndex < Admin.reviewQueue.length) {
            const sub = Admin.reviewQueue[Admin.currentReviewIndex];
            document.getElementById('review-image').src = sub.imageSrc;
            document.getElementById('review-artist').innerText = sub.userName;
            document.getElementById('review-image').classList.remove('hidden');
            document.getElementById('empty-queue').classList.add('hidden');
            document.getElementById('controls-panel').classList.remove('hidden');
            animate("#review-image", { scale: [0.8, 1], rotate: [-2, 0] }, { duration: 0.3 });
        } else {
            document.getElementById('review-image').classList.add('hidden');
            document.getElementById('review-artist').innerText = "";
            document.getElementById('empty-queue').classList.remove('hidden');
            document.getElementById('controls-panel').classList.add('hidden');
        }
    },

    resolveVote: (pts) => {
        const sub = Admin.reviewQueue[Admin.currentReviewIndex];
        const allSubs = DB.get(CONFIG.keys.subs);
        const users = DB.get(CONFIG.keys.users);
        
        const subIdx = allSubs.findIndex(s => s.id === sub.id);
        if(subIdx > -1) { allSubs[subIdx].status = 'reviewed'; allSubs[subIdx].score = pts; }
        DB.set(CONFIG.keys.subs, allSubs);
        
        const uIdx = users.findIndex(u => u.id === sub.userId);
        if(uIdx > -1) { 
            const newElo = Math.max(0, users[uIdx].elo + pts);
            users[uIdx].elo = newElo;

            // --- CHECK BADGES (Prout, Goat, Cool, Meh, Elite, MASTER) ---
            const badges = users[uIdx].unlockedBadges;
            
            if(pts === -20 && !badges.includes('prout')) badges.push('prout');
            if(pts === 60 && !badges.includes('goat')) badges.push('goat');
            if(pts === 25 && !badges.includes('cool')) badges.push('cool');
            if(pts === -5 && !badges.includes('meh')) badges.push('meh');

            // ELITE (500)
            if(newElo >= 500 && !badges.includes('elite')) badges.push('elite');
            
            // MASTER (2000) - NOUVEAU
            if(newElo >= 2000 && !badges.includes('master')) badges.push('master');
        }
        DB.set(CONFIG.keys.users, users);
        
        Admin.currentReviewIndex++;
        setTimeout(Admin.nextReview, 800); 
    },

    finishSession: () => {
        document.body.classList.remove('review-mode');
        const users = DB.get(CONFIG.keys.users);
        let changed = false;
        
        users.forEach(u => {
            // Est-ce que le joueur a participé à CETTE session ?
            if (Admin.participatingUserIds.has(u.id)) {
                // OUI : Augmenter le streak
                u.streak = (u.streak || 0) + 1;
                
                // CHECK NO LIFE (15 de suite)
                if(u.streak >= 15 && !u.unlockedBadges.includes('nolife')) {
                    u.unlockedBadges.push('nolife');
                }
                changed = true;

            } else {
                // NON : Punition + Reset Streak
                if(u.elo > 0) {
                    u.elo = Math.max(0, u.elo - CONFIG.decay);
                }
                u.streak = 0; // Remise à zéro !
                changed = true;
            }
        });

        if(changed) {
            DB.set(CONFIG.keys.users, users);
            AudioMgr.playSound('sfx-meh');
            alert(`Session close ! Punitions appliquées & Streaks mis à jour.`);
        }

        users.sort((a,b) => b.elo - a.elo);
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '';
        users.forEach((u, i) => {
            const div = document.createElement('div');
            div.className = `leaderboard-row rank-${i+1}`;
            const badgesHtml = UI.getBadgeHTML(u.equippedBadges || []);
            div.innerHTML = `
                <div class="leaderboard-user-info">
                    <span>#${i+1} ${u.name}</span>
                    <div class="mini-badges">${badgesHtml}</div>
                </div>
                <span>${u.elo} ELO</span>
            `;
            list.appendChild(div);
        });

        AudioMgr.playSound('sfx-cheer');
        UI.showView('view-leaderboard');
        UI.loadMarquee();
    },

    setupUserMgmt: () => {
        document.getElementById('btn-manage-users').addEventListener('click', () => {
            Admin.renderUserList();
            UI.showView('view-manage-users');
        });
        
        window.deleteUser = (id) => {
            if(confirm("Supprimer ce joueur ?")) {
                let users = DB.get(CONFIG.keys.users);
                users = users.filter(u => u.id !== id);
                DB.set(CONFIG.keys.users, users);
                AudioMgr.playSound('sfx-meh'); 
                Admin.renderUserList();
            }
        };

        window.giveHonor = (id) => {
            let users = DB.get(CONFIG.keys.users);
            const u = users.find(u => u.id === id);
            if(u && !u.unlockedBadges.includes('honor')) {
                if(!u.unlockedBadges) u.unlockedBadges = [];
                u.unlockedBadges.push('honor');
                DB.set(CONFIG.keys.users, users);
                AudioMgr.playSound('sfx-yeah');
                alert(`Badge Honneur donné à ${u.name} !`);
                Admin.renderUserList();
            } else {
                alert("Il l'a déjà ou user introuvable.");
            }
        };
    },

    renderUserList: () => {
        const users = DB.get(CONFIG.keys.users);
        const container = document.getElementById('user-list-container');
        
        if (users.length === 0) {
            container.innerHTML = "<p style='text-align:center'>Aucun joueur inscrit.</p>";
            return;
        }

        container.innerHTML = users.map(u => {
            const rankObj = UI.getRankObj(u.elo); 
            const avatarSrc = u.avatar || CONFIG.defaultAvatar;
            const hasHonor = u.unlockedBadges && u.unlockedBadges.includes('honor');
            
            // Affichage du Streak dans la liste admin (Optionnel mais pratique)
            const streakInfo = u.streak > 1 ? `🔥 ${u.streak}` : '';

            return `
            <div class="user-item">
                <img src="${avatarSrc}" class="avatar-small" alt="avatar">
                <div class="user-item-info">
                    <span>${u.name} ${streakInfo}</span>
                    <span class="user-item-rank">${rankObj.name}</span>
                    <small>${u.elo} ELO</small>
                </div>
                ${!hasHonor ? `<button class="btn-honor" onclick="giveHonor(${u.id})">🏅</button>` : '<span>🏅</span>'}
                <button class="btn-delete" onclick="deleteUser(${u.id})">🗑️</button>
            </div>
            `;
        }).join('');
    }
};