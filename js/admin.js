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
        
        document.getElementById('save-challenge').addEventListener('click', async () => {
            const newCh = { 
                id: Date.now(), 
                title: document.getElementById('input-challenge-title').value, 
                desc: document.getElementById('input-challenge-desc').value 
            };
            await DB.setObj("challenge", newCh);
            await DB.setObj("reviewState", { isReviewing: false });
            
            const deadlineInput = document.getElementById('input-deadline').value;
            if(deadlineInput) {
                const timestamp = new Date(deadlineInput).getTime();
                await DB.setObj("deadline", { timestamp: timestamp });
            } else {
                await DB.setObj("deadline", { timestamp: null });
            }

            AudioMgr.playSound('sfx-yeah');
            alert("Nouveau Défi lancé !");
            UI.showView('view-admin-menu');
        });

        document.getElementById('btn-launch-review').addEventListener('click', async () => {
            await DB.setObj("reviewState", { isReviewing: true });
            
            const subs = await DB.get('subs');
            // Filtrer pending
            Admin.reviewQueue = subs.filter(s => s.status === 'pending');
            Admin.participatingUserIds = new Set(Admin.reviewQueue.map(s => s.userId)); 
            Admin.currentReviewIndex = 0;
            
            document.body.classList.add('review-mode'); 
            UI.showView('view-review');
            Admin.nextReview();
        });

        document.getElementById('btn-reset-season').addEventListener('click', async () => {
            if(confirm("⚠️ ATTENTION : RESET DE SAISON ?")) {
                if(confirm("⛔ C'est irréversible (Reset ELO). Sûr ?")) {
                    const users = await DB.get('users');
                    for (const u of users) {
                        u.elo = 0;
                        await DB.set('users', u.id, u);
                    }
                    AudioMgr.playSound('sfx-fart'); 
                    alert("💀 SAISON RÉINITIALISÉE !");
                }
            }
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

    resolveVote: async (pts) => {
        const sub = Admin.reviewQueue[Admin.currentReviewIndex];
        
        // Update Sub
        sub.status = 'reviewed';
        sub.score = pts;
        await DB.set('subs', sub.id, sub);
        
        // Update User
        const users = await DB.get('users');
        const uIdx = users.findIndex(u => u.id === sub.userId);
        
        if(uIdx > -1) { 
            const user = users[uIdx];
            const newElo = Math.max(0, user.elo + pts);
            user.elo = newElo;

            // Badges logic
            if(!user.unlockedBadges) user.unlockedBadges = [];
            
            if(pts === -20 && !user.unlockedBadges.includes('prout')) user.unlockedBadges.push('prout');
            if(pts === 60 && !user.unlockedBadges.includes('goat')) user.unlockedBadges.push('goat');
            if(pts === 25 && !user.unlockedBadges.includes('cool')) user.unlockedBadges.push('cool');
            if(pts === -5 && !user.unlockedBadges.includes('meh')) user.unlockedBadges.push('meh');
            if(newElo >= 500 && !user.unlockedBadges.includes('elite')) user.unlockedBadges.push('elite');
            if(newElo >= 2000 && !user.unlockedBadges.includes('master')) user.unlockedBadges.push('master');

            await DB.set('users', user.id, user);
        }
        
        Admin.currentReviewIndex++;
        setTimeout(Admin.nextReview, 800); 
    },

    finishSession: async () => {
        document.body.classList.remove('review-mode');
        const users = await DB.get('users');
        let changed = false;
        
        for (const u of users) {
            if (Admin.participatingUserIds.has(u.id)) {
                u.streak = (u.streak || 0) + 1;
                if(u.streak >= 15 && !u.unlockedBadges.includes('nolife')) {
                    u.unlockedBadges.push('nolife');
                }
                await DB.set('users', u.id, u);
            } else {
                if(u.elo > 0) {
                    u.elo = Math.max(0, u.elo - CONFIG.decay);
                }
                u.streak = 0; 
                await DB.set('users', u.id, u);
            }
        }

        AudioMgr.playSound('sfx-meh');
        alert(`Session close !`);

        // Refresh List for Leaderboard
        const updatedUsers = await DB.get('users');
        updatedUsers.sort((a,b) => {
            if (b.elo !== a.elo) return b.elo - a.elo;
            const badgesA = a.unlockedBadges ? a.unlockedBadges.length : 0;
            const badgesB = b.unlockedBadges ? b.unlockedBadges.length : 0;
            return badgesB - badgesA;
        });

        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '';
        updatedUsers.forEach((u, i) => {
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
        document.getElementById('btn-manage-users').addEventListener('click', async () => {
            await Admin.renderUserList();
            UI.showView('view-manage-users');
        });
        
        window.deleteUser = async (id) => {
            if(confirm("Supprimer ce joueur ?")) {
                await DB.delete('users', id);
                AudioMgr.playSound('sfx-meh'); 
                await Admin.renderUserList();
            }
        };

        window.giveHonor = async (id) => {
            const users = await DB.get('users');
            const u = users.find(u => u.id === id);
            if(u && !u.unlockedBadges.includes('honor')) {
                if(!u.unlockedBadges) u.unlockedBadges = [];
                u.unlockedBadges.push('honor');
                await DB.set('users', u.id, u);
                AudioMgr.playSound('sfx-yeah');
                alert(`Badge Honneur donné à ${u.name} !`);
                await Admin.renderUserList();
            }
        };
    },

    renderUserList: async () => {
        const users = await DB.get('users');
        const container = document.getElementById('user-list-container');
        
        if (users.length === 0) {
            container.innerHTML = "<p style='text-align:center'>Aucun joueur inscrit.</p>";
            return;
        }

        container.innerHTML = users.map(u => {
            const rankObj = UI.getRankObj(u.elo); 
            const avatarSrc = u.avatar || CONFIG.defaultAvatar;
            const hasHonor = u.unlockedBadges && u.unlockedBadges.includes('honor');
            const streakInfo = u.streak > 1 ? `🔥 ${u.streak}` : '';
            const smallBadges = (u.unlockedBadges || []).map(bId => {
                const b = CONFIG.badges[bId];
                return b ? b.icon : '';
            }).join(' ');

            return `
            <div class="user-item">
                <img src="${avatarSrc}" class="avatar-small" alt="avatar">
                <div class="user-item-info">
                    <span>${u.name}</span>
                    <span class="user-item-rank">${rankObj.name}</span>
                    <small>${u.elo} ELO <span style="font-size:0.8rem; margin-left:5px;">${streakInfo}</span></small>
                    <div style="font-size:0.8rem; margin-top:2px;">${smallBadges}</div>
                </div>
                ${!hasHonor ? `<button class="btn-honor" onclick="giveHonor(${u.id})">🏅</button>` : '<span>🏅</span>'}
                <button class="btn-delete" onclick="deleteUser(${u.id})">🗑️</button>
            </div>
            `;
        }).join('');
    }
};