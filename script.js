let currentAudio = null;
let currentAudioName = null;
document.addEventListener('DOMContentLoaded', function() {
document.body.addEventListener('click', function(e) {
    if (e.target.classList.contains('play-audio')) {
    const audioName = e.target.getAttribute('data-audio');
    if (!audioName) return;
    if (currentAudio && currentAudioName === audioName && !currentAudio.paused) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
        currentAudioName = null;
    } else {
        if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        }
        currentAudio = new Audio('audio/' + audioName + '.mp3');
        currentAudioName = audioName;
        currentAudio.play();
    }
    }
  });
});