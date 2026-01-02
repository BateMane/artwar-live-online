export const AudioMgr = {
    player: null,
    
    init: () => {
        // Ajouter le script YouTube
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);

        window.onYouTubeIframeAPIReady = function() {
            AudioMgr.player = new YT.Player('youtube-player', {
                height: '0', width: '0', videoId: 'wsTRey-ajJQ',
                playerVars: { 'autoplay': 1, 'loop': 1, 'playlist': 'wsTRey-ajJQ' },
                events: { 'onReady': (e) => { e.target.setVolume(30); e.target.playVideo(); } }
            });
        };
    },

    playSound: (sfxId) => {
        const el = document.getElementById(sfxId);
        if (el) {
            el.volume = 0.3;
            el.currentTime = 0;
            el.play().catch(e => console.log("Audio play error", e));
        }
    },

    toggleMusic: (btn) => {
        if(!AudioMgr.player) return;
        const state = AudioMgr.player.getPlayerState();
        if(state === 1) { // Playing
            AudioMgr.player.pauseVideo();
            btn.innerText = "PLAY 💿";
        } else {
            AudioMgr.player.playVideo();
            btn.innerText = "PAUSE ⏸️";
        }
    },

    setVolume: (val) => {
        if(AudioMgr.player && AudioMgr.player.setVolume) AudioMgr.player.setVolume(val);
    }
};