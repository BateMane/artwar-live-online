import { CONFIG, DB } from "./config.js";
import { UI } from "./ui.js";
import { AudioMgr } from "./audio.js";
import { Player } from "./player.js";
import { Admin } from "./admin.js";

// Init App
DB.init();
AudioMgr.init();
UI.loadMarquee();
Player.init();
Admin.init();

// Global Event Listeners (Navigation & Login)
document.querySelectorAll('.back-btn').forEach(b => b.addEventListener('click', () => {
    UI.showView('view-hub');
    UI.loadMarquee();
}));
document.querySelectorAll('.back-nav-admin').forEach(b => b.addEventListener('click', () => UI.showView('view-admin-menu')));

// Login Navigation
document.getElementById('btn-role-player').addEventListener('click', () => UI.showView('view-login-player'));
document.getElementById('btn-role-admin').addEventListener('click', () => UI.showView('view-login-admin'));

// Login Logic
document.getElementById('login-form-player').addEventListener('submit', (e) => {
    e.preventDefault();
    if (document.getElementById('player-pwd').value === CONFIG.passwords.player) {
        Player.login(document.getElementById('player-username').value);
        AudioMgr.playSound('sfx-yeah');
    } else {
        UI.shake(e.target);
        AudioMgr.playSound('sfx-meh');
    }
});

document.getElementById('login-form-admin').addEventListener('submit', (e) => {
    e.preventDefault();
    if (document.getElementById('admin-pwd').value === CONFIG.passwords.admin) {
        UI.showView('view-admin-menu');
        AudioMgr.playSound('sfx-yeah');
    } else {
        UI.shake(e.target);
        AudioMgr.playSound('sfx-meh');
    }
});

// Sound Global Click
document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
        UI.animateButton(btn);
        if (!btn.dataset.sfx) AudioMgr.playSound('sfx-clic');
    });
    btn.addEventListener('mouseenter', () => {
        // No hover sound as requested
    });
});

// Music Controls
document.getElementById('volume-slider').addEventListener('input', (e) => AudioMgr.setVolume(e.target.value));
document.getElementById('music-toggle').addEventListener('click', (e) => AudioMgr.toggleMusic(e.target));