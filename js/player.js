import { CONFIG, DB } from "./config.js";
import { UI } from "./ui.js";
import { AudioMgr } from "./audio.js";

export const Player = {
    currentUser: null,
    newAvatarBase64: null,

    init: () => {
        Player.setupUpload();
        Player.setupProfile();
        // Check lock & Timer every second
        setInterval(() => {
            Player.checkLock();
            Player.updateDeadlineDisplay();
        }, 1000);
    },

    login: (name) => {
        const users = DB.get(CONFIG.keys.users);
        let user = users.find(u => u.name === name);
        if (!user) {
            user = { 
                id: Date.now(), name, elo: 0, avatar: CONFIG.defaultAvatar,
                unlockedBadges: [], equippedBadges: [], streak: 0 
            };
            users.push(user);
            DB.set(CONFIG.keys.users, users);
        }
        // Ensure arrays exist
        if(!user.unlockedBadges) user.unlockedBadges = [];
        if(!user.equippedBadges) user.equippedBadges = [];
        if(user.streak === undefined) user.streak = 0;

        Player.currentUser = user;
        Player.updateUI();
        Player.checkLock();
        Player.updateDeadlineDisplay(); 
        Player.checkSubmissionStatus(); 
        UI.showView('view-user');
    },

    updateUI: () => {
        if(!Player.currentUser) return;
        const user = Player.currentUser;
        
        document.getElementById('user-welcome').innerText = `Yo, ${user.name}!`;
        document.getElementById('user-elo').innerText = user.elo;
        document.getElementById('user-avatar-display').src = user.avatar;

        // Render Equipped Badges Home
        const badgeContainer = document.getElementById('user-equipped-badges-display');
        if(badgeContainer) {
            badgeContainer.innerHTML = UI.getBadgeHTML(user.equippedBadges);
        }

        const rank = UI.getRankObj(user.elo);
        const nextRankIdx = CONFIG.ranks.indexOf(rank) + 1;
        const nextRank = CONFIG.ranks[nextRankIdx] || null;

        document.getElementById('user-rank-badge').innerText = rank.name;

        let pct = 100;
        if (nextRank) pct = ((user.elo - rank.min) / (nextRank.min - rank.min)) * 100;
        document.getElementById('user-elo-bar').style.width = `${pct}%`;

        const ch = DB.getObj(CONFIG.keys.challenge);
        document.getElementById('display-challenge-title').innerText = ch.title;
        document.getElementById('display-challenge-desc').innerText = ch.desc;
    },

    updateDeadlineDisplay: () => {
        const deadline = localStorage.getItem(CONFIG.keys.deadline);
        const display = document.getElementById('deadline-info');
        
        if(!deadline) {
            display.classList.add('hidden');
            return;
        }

        const target = parseInt(deadline);
        const now = Date.now();
        const diff = target - now;
        
        display.classList.remove('hidden');

        if(diff <= 0) {
            display.innerHTML = "🚫 <b>Participation TERMINÉE !</b> 🚫";
            display.style.color = "red";
            display.style.borderColor = "red";
        } else {
            const dateObj = new Date(target);
            const dateStr = dateObj.toLocaleDateString('fr-FR');
            const timeStr = dateObj.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
            
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            display.style.color = "#ff6b6b";
            display.style.borderColor = "#ff6b6b";
            display.innerHTML = `
                ⏳ Participation jusqu'au <b>${dateStr} à ${timeStr}</b><br>
                Temps restant : <b>${d}j ${h}h ${m}m ${s}s</b>
            `;
        }
    },

    unlockBadge: (badgeId) => {
        if(!Player.currentUser) return;
        const users = DB.get(CONFIG.keys.users);
        const user = users.find(u => u.id === Player.currentUser.id);
        
        if(user && !user.unlockedBadges.includes(badgeId)) {
            user.unlockedBadges.push(badgeId);
            Player.currentUser = user;
            DB.set(CONFIG.keys.users, users);
            AudioMgr.playSound('sfx-cool');
            alert(`🏆 BADGE DÉBLOQUÉ : ${CONFIG.badges[badgeId].name} !`);
            Player.updateUI();
        }
    },

    setupUpload: () => {
        const fileIn = document.getElementById('file-input');
        const dropZone = document.getElementById('drop-zone');
        const modal = document.getElementById('confirm-modal');
        const modalCancel = document.getElementById('modal-cancel');
        const modalConfirm = document.getElementById('modal-confirm');
        let imgData = null;

        dropZone.addEventListener('click', () => { 
            const deadline = localStorage.getItem(CONFIG.keys.deadline);
            if (deadline && Date.now() > parseInt(deadline)) return alert("Trop tard, c'est fini !");
            
            fileIn.value = ''; fileIn.click(); 
        });

        fileIn.addEventListener('change', (e) => {
            if(e.target.files[0]) {
                const r = new FileReader();
                r.onload = (evt) => {
                    imgData = evt.target.result;
                    document.getElementById('upload-preview').innerHTML = `<img src="${imgData}">`;
                    document.getElementById('submit-art').disabled = false;
                };
                r.readAsDataURL(e.target.files[0]);
            }
        });

        document.getElementById('submit-art').addEventListener('click', () => {
            if(!Player.currentUser || !imgData) return;
            modal.classList.remove('hidden'); 
            AudioMgr.playSound('sfx-clic');
        });

        modalCancel.addEventListener('click', () => {
            modal.classList.add('hidden');
            AudioMgr.playSound('sfx-clic');
        });

        modalConfirm.addEventListener('click', () => {
            const subs = DB.get(CONFIG.keys.subs);
            if(subs.length === 0) Player.unlockBadge('first');

            // --- CHECK VETERAN (5 participations) ---
            const userSubs = subs.filter(s => s.userId === Player.currentUser.id);
            if(userSubs.length + 1 >= 5) Player.unlockBadge('veteran');

            const currentCh = DB.getObj(CONFIG.keys.challenge);
            
            subs.push({ 
                id: Date.now(), 
                userId: Player.currentUser.id, 
                userName: Player.currentUser.name, 
                imageSrc: imgData, 
                status: 'pending', 
                score: 0,
                challengeId: currentCh ? currentCh.id : 'legacy'
            });
            DB.set(CONFIG.keys.subs, subs);
            
            modal.classList.add('hidden');
            AudioMgr.playSound('sfx-yeah');
            alert("Envoyé !");
            
            document.getElementById('submit-art').disabled = true;
            document.getElementById('upload-preview').innerHTML = '';
            imgData = null;
            Player.checkSubmissionStatus(); 
        });
    },

    checkSubmissionStatus: () => {
        const subs = DB.get(CONFIG.keys.subs);
        const currentCh = DB.getObj(CONFIG.keys.challenge);
        const currentChId = currentCh ? currentCh.id : 'legacy';

        const hasSubmitted = subs.some(s => s.userId === Player.currentUser.id && s.challengeId === currentChId);
        
        const upDiv = document.getElementById('upload-container');
        const msg = document.getElementById('submitted-message');
        const btn = document.getElementById('submit-art');

        if (hasSubmitted) {
            upDiv.classList.add('hidden');
            btn.classList.add('hidden');
            msg.classList.remove('hidden');
        } else {
            upDiv.classList.remove('hidden');
            btn.classList.remove('hidden');
            msg.classList.add('hidden');
        }
    },

    setupProfile: () => {
        const profileIn = document.getElementById('profile-file-input');
        const clickZone = document.getElementById('avatar-click-zone');

        clickZone.addEventListener('click', () => { profileIn.value = ''; profileIn.click(); });

        profileIn.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    Player.newAvatarBase64 = evt.target.result;
                    document.getElementById('profile-preview-img').src = Player.newAvatarBase64;
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });

        document.getElementById('btn-goto-profile').addEventListener('click', () => {
            document.getElementById('profile-name-input').value = Player.currentUser.name;
            document.getElementById('profile-preview-img').src = Player.currentUser.avatar;
            Player.renderProfileBadges();
            Player.newAvatarBase64 = null; 
            UI.showView('view-profile');
        });

        document.getElementById('back-from-profile').addEventListener('click', () => {
            Player.updateUI(); 
            UI.showView('view-user');
        });

        const saveProfileBtn = document.getElementById('save-profile-btn');
        const newSaveBtn = saveProfileBtn.cloneNode(true);
        saveProfileBtn.parentNode.replaceChild(newSaveBtn, saveProfileBtn);

        newSaveBtn.addEventListener('click', () => {
            const newName = document.getElementById('profile-name-input').value;
            if (!newName) return alert("Pseudo vide !");

            Player.currentUser.name = newName;
            
            // --- CHECK STAR (Custom Avatar) ---
            if (Player.newAvatarBase64 && Player.newAvatarBase64 !== CONFIG.defaultAvatar) {
                Player.currentUser.avatar = Player.newAvatarBase64;
                Player.unlockBadge('star');
            }

            const users = DB.get(CONFIG.keys.users);
            const idx = users.findIndex(u => u.id === Player.currentUser.id);
            if (idx > -1) {
                users[idx] = Player.currentUser;
                DB.set(CONFIG.keys.users, users);
            }

            AudioMgr.playSound('sfx-yeah');
            alert("Profil mis à jour !");
            Player.updateUI();
            UI.showView('view-user');
        });
    },

    renderProfileBadges: () => {
        const grid = document.getElementById('badge-selection-grid');
        grid.innerHTML = '';
        
        Object.keys(CONFIG.badges).forEach(key => {
            const b = CONFIG.badges[key];
            const unlocked = Player.currentUser.unlockedBadges.includes(key);
            const equipped = Player.currentUser.equippedBadges.includes(key);
            
            const div = document.createElement('div');
            div.className = `badge-select-item ${unlocked ? '' : 'locked'} ${equipped ? 'equipped' : ''}`;
            div.innerHTML = `
                <div style="font-size:2rem;">${unlocked ? b.icon : '🔒'}</div>
                <div style="font-weight:bold; font-size:0.7rem; margin-top:5px;">${b.name}</div>
            `;
            
            div.onmouseenter = (e) => window.showTooltip(e, b.name, unlocked ? b.desc + ' (Clique pour équiper)' : '???');
            div.onmouseleave = () => window.hideTooltip();

            if(unlocked) {
                div.addEventListener('click', () => Player.toggleEquipBadge(key));
            }
            grid.appendChild(div);
        });
    },

    toggleEquipBadge: (badgeId) => {
        const user = Player.currentUser;
        if(user.equippedBadges.includes(badgeId)) {
            user.equippedBadges = user.equippedBadges.filter(id => id !== badgeId);
        } else {
            if(user.equippedBadges.length >= 2) {
                UI.shake(document.getElementById('badge-selection-grid'));
                return alert("Maximum 2 badges !");
            }
            user.equippedBadges.push(badgeId);
        }
        
        const users = DB.get(CONFIG.keys.users);
        const idx = users.findIndex(u => u.id === user.id);
        if(idx > -1) { users[idx] = user; DB.set(CONFIG.keys.users, users); }
        
        Player.currentUser = user;
        AudioMgr.playSound('sfx-clic');
        Player.renderProfileBadges(); 
        
        Player.updateUI();
    },

    checkLock: () => {
        const locked = localStorage.getItem(CONFIG.keys.reviewState) === 'true';
        const deadline = localStorage.getItem(CONFIG.keys.deadline);
        let timeExpired = false;
        
        if(deadline) {
            if(Date.now() > parseInt(deadline)) timeExpired = true;
        }

        const subs = DB.get(CONFIG.keys.subs);
        const currentCh = DB.getObj(CONFIG.keys.challenge);
        const currentChId = currentCh ? currentCh.id : 'legacy';

        const hasSubmitted = subs.some(s => s.userId === Player.currentUser?.id && s.challengeId === currentChId);

        const shouldLock = (locked || timeExpired) && !hasSubmitted;

        if(shouldLock) {
            document.getElementById('upload-container').classList.add('hidden');
            const msg = document.getElementById('locked-message');
            msg.classList.remove('hidden');
            if(timeExpired) msg.innerText = "🚫 TROP TARD (TEMPS ÉCOULÉ) ! 🚫";
            else msg.innerText = "🚫 REVIEW EN COURS... TROP TARD ! 🚫";
        } else if (!hasSubmitted) {
            document.getElementById('upload-container').classList.remove('hidden');
            document.getElementById('locked-message').classList.add('hidden');
        }
    }
};