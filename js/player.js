import { CONFIG, DB } from "./config.js";
import { UI } from "./ui.js";
import { AudioMgr } from "./audio.js";

export const Player = {
    currentUser: null,
    currentFile: null, // On stocke le fichier brut pour l'upload

    init: async () => {
        Player.setupUpload();
        Player.setupProfile();
        // Check lock & Timer loop
        setInterval(() => {
            Player.checkLock();
            Player.updateDeadlineDisplay();
        }, 2000);
    },

    login: async (name) => {
        // Fetch all users
        const users = await DB.get('users');
        let user = users.find(u => u.name === name);
        
        if (!user) {
            // Create New User
            user = { 
                id: Date.now(), name, elo: 0, avatar: CONFIG.defaultAvatar,
                unlockedBadges: [], equippedBadges: [], streak: 0 
            };
            await DB.set('users', user.id, user);
        } else {
            // Migration check
            if(!user.unlockedBadges) user.unlockedBadges = [];
            if(!user.equippedBadges) user.equippedBadges = [];
            if(user.streak === undefined) user.streak = 0;
        }

        Player.currentUser = user;
        await Player.updateUI();
        Player.checkLock();
        Player.updateDeadlineDisplay(); 
        await Player.checkSubmissionStatus(); 
        UI.showView('view-user');
    },

    updateUI: async () => {
        if(!Player.currentUser) return;
        const user = Player.currentUser;
        
        document.getElementById('user-welcome').innerText = `Yo, ${user.name}!`;
        document.getElementById('user-elo').innerText = user.elo;
        document.getElementById('user-avatar-display').src = user.avatar;

        const badgeContainer = document.getElementById('user-equipped-badges-display');
        if(badgeContainer) {
            badgeContainer.innerHTML = UI.getBadgeHTML(user.equippedBadges);
        }

        const rank = UI.getRankObj(user.elo);
        document.getElementById('user-rank-badge').innerText = rank.name;

        // Calcul barre XP (approximatif pour affichage)
        const nextRankIdx = CONFIG.ranks.indexOf(rank) + 1;
        const nextRank = CONFIG.ranks[nextRankIdx] || null;
        let pct = 100;
        if (nextRank) pct = ((user.elo - rank.min) / (nextRank.min - rank.min)) * 100;
        document.getElementById('user-elo-bar').style.width = `${pct}%`;

        // Challenge Info
        const ch = await DB.getObj("challenge");
        if(ch) {
            document.getElementById('display-challenge-title').innerText = ch.title;
            document.getElementById('display-challenge-desc').innerText = ch.desc;
        }
    },

    updateDeadlineDisplay: async () => {
        const dlObj = await DB.getObj("deadline");
        const display = document.getElementById('deadline-info');
        
        if(!dlObj || !dlObj.timestamp) {
            display.classList.add('hidden');
            return;
        }

        const target = parseInt(dlObj.timestamp);
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
                ⏳ Jusqu'au <b>${dateStr} à ${timeStr}</b><br>
                Reste : <b>${d}j ${h}h ${m}m ${s}s</b>
            `;
        }
    },

    unlockBadge: async (badgeId) => {
        if(!Player.currentUser) return;
        // Re-fetch user to be sure
        const users = await DB.get('users');
        const user = users.find(u => u.id === Player.currentUser.id);
        
        if(user && !user.unlockedBadges.includes(badgeId)) {
            user.unlockedBadges.push(badgeId);
            await DB.set('users', user.id, user); // Save online
            Player.currentUser = user; // Update local
            
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

        dropZone.addEventListener('click', async () => { 
            const dlObj = await DB.getObj("deadline");
            if (dlObj && dlObj.timestamp && Date.now() > parseInt(dlObj.timestamp)) return alert("Trop tard, c'est fini !");
            fileIn.value = ''; fileIn.click(); 
        });

        fileIn.addEventListener('change', (e) => {
            if(e.target.files[0]) {
                Player.currentFile = e.target.files[0];
                const r = new FileReader();
                r.onload = (evt) => {
                    // Preview local uniquement
                    document.getElementById('upload-preview').innerHTML = `<img src="${evt.target.result}">`;
                    document.getElementById('submit-art').disabled = false;
                };
                r.readAsDataURL(e.target.files[0]);
            }
        });

        document.getElementById('submit-art').addEventListener('click', () => {
            if(!Player.currentUser || !Player.currentFile) return;
            modal.classList.remove('hidden'); 
            AudioMgr.playSound('sfx-clic');
        });

        modalCancel.addEventListener('click', () => {
            modal.classList.add('hidden');
            AudioMgr.playSound('sfx-clic');
        });

        modalConfirm.addEventListener('click', async () => {
            // UI Loading state
            const btn = document.getElementById('submit-art');
            btn.innerText = "ENVOI EN COURS...";
            btn.disabled = true;

            try {
                // 1. Check Badges
                const subs = await DB.get('subs');
                if(subs.length === 0) await Player.unlockBadge('first');

                const userSubs = subs.filter(s => s.userId === Player.currentUser.id);
                if(userSubs.length + 1 >= 5) await Player.unlockBadge('veteran');

                const currentCh = await DB.getObj("challenge");
                const chId = currentCh ? currentCh.id : 'legacy';

                // 2. Upload Image to Storage
                const fileName = `submissions/${chId}_${Player.currentUser.id}_${Date.now()}.png`;
                const imageUrl = await DB.uploadImage(Player.currentFile, fileName);

                // 3. Save Submission to Firestore
                const newSub = { 
                    id: Date.now(), 
                    userId: Player.currentUser.id, 
                    userName: Player.currentUser.name, 
                    imageSrc: imageUrl, // URL Firebase
                    status: 'pending', 
                    score: 0,
                    challengeId: chId
                };
                
                await DB.set('subs', newSub.id, newSub);
                
                modal.classList.add('hidden');
                AudioMgr.playSound('sfx-yeah');
                alert("Envoyé avec succès !");
                
                document.getElementById('upload-preview').innerHTML = '';
                Player.currentFile = null;
                await Player.checkSubmissionStatus();

            } catch (err) {
                console.error(err);
                alert("Erreur upload: " + err.message);
            } finally {
                btn.innerText = "ENVOYER 📨";
            }
        });
    },

    checkSubmissionStatus: async () => {
        const subs = await DB.get('subs');
        const currentCh = await DB.getObj("challenge");
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
                Player.currentFile = e.target.files[0]; // Store for upload
                const reader = new FileReader();
                reader.onload = (evt) => {
                    document.getElementById('profile-preview-img').src = evt.target.result;
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });

        document.getElementById('btn-goto-profile').addEventListener('click', async () => {
            document.getElementById('profile-name-input').value = Player.currentUser.name;
            document.getElementById('profile-preview-img').src = Player.currentUser.avatar;
            await Player.renderProfileBadges();
            UI.showView('view-profile');
        });

        document.getElementById('back-from-profile').addEventListener('click', async () => {
            await Player.updateUI(); 
            UI.showView('view-user');
        });

        const saveProfileBtn = document.getElementById('save-profile-btn');
        // Clone to remove old listeners
        const newSaveBtn = saveProfileBtn.cloneNode(true);
        saveProfileBtn.parentNode.replaceChild(newSaveBtn, saveProfileBtn);

        newSaveBtn.addEventListener('click', async () => {
            newSaveBtn.disabled = true;
            newSaveBtn.innerText = "SAUVEGARDE...";

            try {
                const newName = document.getElementById('profile-name-input').value;
                if (!newName) throw new Error("Pseudo vide !");

                Player.currentUser.name = newName;
                
                // Upload Avatar if changed
                if (Player.currentFile) {
                    const fileName = `avatars/${Player.currentUser.id}_${Date.now()}.png`;
                    const url = await DB.uploadImage(Player.currentFile, fileName);
                    Player.currentUser.avatar = url;
                    await Player.unlockBadge('star');
                    Player.currentFile = null; // Reset
                }

                await DB.set('users', Player.currentUser.id, Player.currentUser);

                AudioMgr.playSound('sfx-yeah');
                alert("Profil mis à jour !");
                await Player.updateUI();
                UI.showView('view-user');

            } catch (err) {
                alert("Erreur: " + err.message);
            } finally {
                newSaveBtn.disabled = false;
                newSaveBtn.innerText = "SAUVEGARDER 💾";
            }
        });
    },

    renderProfileBadges: async () => {
        const grid = document.getElementById('badge-selection-grid');
        grid.innerHTML = '';
        
        // Ensure user data is fresh
        const users = await DB.get('users');
        const user = users.find(u => u.id === Player.currentUser.id);
        Player.currentUser = user;

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

    toggleEquipBadge: async (badgeId) => {
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
        
        await DB.set('users', user.id, user);
        
        Player.currentUser = user;
        AudioMgr.playSound('sfx-clic');
        await Player.renderProfileBadges(); 
        await Player.updateUI();
    },

    checkLock: async () => {
        const rs = await DB.getObj("reviewState");
        const locked = rs ? rs.isReviewing : false;
        
        const dlObj = await DB.getObj("deadline");
        let timeExpired = false;
        if(dlObj && dlObj.timestamp) {
            if(Date.now() > parseInt(dlObj.timestamp)) timeExpired = true;
        }

        const subs = await DB.get('subs');
        const currentCh = await DB.getObj("challenge");
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