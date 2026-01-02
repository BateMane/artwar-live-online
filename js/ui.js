import { animate, spring } from "https://cdn.jsdelivr.net/npm/motion@10.18.0/+esm";
import { DB, CONFIG } from "./config.js";

export const UI = {
    showView: (id) => {
        document.querySelectorAll('section').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(id);
        if(target) {
            target.classList.remove('hidden');
            animate(target, { opacity: [0, 1], scale: [0.98, 1] }, { duration: 0.3, easing: spring() });
        }
    },

    shake: (el) => animate(el, { x: [-10, 10, -10, 10, 0] }, { duration: 0.4 }),

    animateButton: (btn) => animate(btn, { scale: [0.9, 1.05, 1] }, { duration: 0.3 }),

    triggerVFX: (intensity, x, y, char) => {
        const container = document.getElementById('particles-container');
        if (intensity > 2) animate("body", { x: [-5, 5, -5, 5, 0] }, { duration: 0.2 });
        if (intensity >= 4) {
            const flash = document.getElementById('flash-overlay');
            flash.style.opacity = 0.5;
            setTimeout(() => flash.style.opacity = 0, 100);
        }
        for (let i = 0; i < intensity * 5; i++) {
            const p = document.createElement('div');
            p.classList.add('particle'); p.innerText = char;
            p.style.left = x+'px'; p.style.top = y+'px';
            container.appendChild(p);
            const angle = Math.random() * Math.PI * 2;
            const velocity = 50 + Math.random() * (intensity * 80);
            animate(p, { 
                x: Math.cos(angle) * velocity, y: Math.sin(angle) * velocity, 
                opacity: [1, 0], rotate: Math.random()*360 
            }, { duration: 0.8 }).finished.then(() => p.remove());
        }
    },

    loadMarquee: () => {
        const subs = DB.get(CONFIG.keys.subs).filter(s => s.status === 'reviewed');
        const track = document.getElementById('marquee-track');
        if(subs.length > 0) {
            const imgs = [...subs, ...subs, ...subs].map(s => `<img src="${s.imageSrc}">`).join('');
            track.innerHTML = imgs;
        } else {
            track.innerHTML = `
                <img src="https://picsum.photos/300/400?random=1">
                <img src="https://picsum.photos/300/400?random=2">
                <img src="https://picsum.photos/300/400?random=3">
            `;
        }
    },

    getRankObj: (elo) => {
        let rank = CONFIG.ranks[0];
        for (let i = 0; i < CONFIG.ranks.length; i++) {
            if (elo >= CONFIG.ranks[i].min) rank = CONFIG.ranks[i];
        }
        return rank;
    },

    // --- CORRECTION BUG INFOBULLE ---
    getBadgeHTML: (badgeIds) => {
        if(!badgeIds || badgeIds.length === 0) return '';
        return badgeIds.map(id => {
            const b = CONFIG.badges[id];
            if(!b) return '';
            
            // IMPORTANT : On échappe les apostrophes (') pour ne pas casser le HTML
            const safeName = b.name.replace(/'/g, "\\'");
            const safeDesc = b.desc.replace(/'/g, "\\'");

            return `<span class="badge-icon" 
                        onmouseenter="window.showTooltip(event, '${safeName}', '${safeDesc}')" 
                        onmouseleave="window.hideTooltip()">
                        ${b.icon}
                    </span>`;
        }).join('');
    },
};

// Fonctions globales pour l'infobulle
window.showTooltip = (e, title, desc) => {
    const tooltip = document.getElementById('custom-tooltip');
    if(tooltip) {
        tooltip.innerHTML = `<strong>${title}</strong><br><span style="font-size:0.8em; opacity:0.8">${desc}</span>`;
        tooltip.classList.remove('hidden');
        moveTooltip(e);
        document.addEventListener('mousemove', moveTooltip);
    }
};

window.hideTooltip = () => {
    const tooltip = document.getElementById('custom-tooltip');
    if(tooltip) {
        tooltip.classList.add('hidden');
        document.removeEventListener('mousemove', moveTooltip);
    }
};

const moveTooltip = (e) => {
    const tooltip = document.getElementById('custom-tooltip');
    if(tooltip) {
        // Décalage pour ne pas être sous le curseur
        tooltip.style.left = (e.clientX + 15) + 'px';
        tooltip.style.top = (e.clientY + 15) + 'px';
    }
};