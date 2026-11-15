const scriptElement = document.currentScript;
const audioBase = scriptElement.dataset.audioBase.replace(/\/$/, '');

const startButton = document.getElementById('startButton');
const statusText = document.getElementById('status');

const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');

const vscode = acquireVsCodeApi();

let audioContext;
let buffers = {};
let idleSource = null;
let idleGain = null;
let audioReady = false;

// Master volume: 100% by default.
let masterVolume = 1;

// Remembers the last sample played for every sound group.
const lastPlayed = {
    punctuation: null,
    enter: null
};

const audioFiles = {
    typechar: 'typing/typechar.wav',

    punctuation1: 'punctuation/punctuation_1.wav',
    punctuation2: 'punctuation/punctuation_2.wav',
    punctuation3: 'punctuation/punctuation_3.wav',
    punctuation4: 'punctuation/punctuation_4.wav',
    punctuation5: 'punctuation/punctuation_5.wav',

    enter1: 'enter/enterSound_1.wav',
    enter2: 'enter/enterSound_2.wav',
    enter3: 'enter/enterSound_3.wav',
    enter4: 'enter/enterSound_4.wav',
    enter5: 'enter/enterSound_5.wav',

    spacebar: 'actions/spacebar.wav',
    delete: 'actions/delete.wav',
    startup: 'actions/startup.wav',
    terminalOpen: 'actions/terminal_open.wav',

    idle: 'idle/idle.wav'
};

// =========================================
// STATUS INDICATOR
// =========================================

function setStatus(state, text) {
    statusText.textContent = text;

    statusText.classList.remove(
        'status-offline',
        'status-online',
        'status-loading'
    );

    statusText.classList.add(`status-${state}`);
}

// =========================================
// AUDIO LOADING
// =========================================

async function loadAudio() {
    for (const [name, file] of Object.entries(audioFiles)) {
        const response = await fetch(`${audioBase}/${file}`);

        if (!response.ok) {
            throw new Error(`Unable to load ${file}: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        buffers[name] = await audioContext.decodeAudioData(arrayBuffer);
    }
}

// =========================================
// SOUND PLAYBACK
// =========================================

// Default sound volume is now 100%.
// The master volume slider controls the final output level.
function playSample(name, volume = 1.0) {
    if (
        !audioReady ||
        !audioContext ||
        audioContext.state !== 'running' ||
        !buffers[name]
    ) {
        return;
    }

    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();

    source.buffer = buffers[name];

    gain.gain.value = volume * masterVolume;

    source.connect(gain);
    gain.connect(audioContext.destination);

    source.start();
}

// =========================================
// RANDOM WITHOUT CONSECUTIVE REPEATS
// =========================================

const soundGroups = {
    punctuation: [
        'punctuation1',
        'punctuation2',
        'punctuation3',
        'punctuation4',
        'punctuation5'
    ],

    enter: [
        'enter1',
        'enter2',
        'enter3',
        'enter3',
        'enter4'
    ]
};

function getRandomSound(groupName) {
    const group = soundGroups[groupName];

    if (!group || group.length === 0) {
        return null;
    }

    // If there is only one possible sample, return that one.
    if (group.length === 1) {
        lastPlayed[groupName] = group[0];
        return group[0];
    }

    // Exclude the previously played sample to avoid repetitions.
    const availableSounds = group.filter(
        sound => sound !== lastPlayed[groupName]
    );

    const selectedSound =
        availableSounds[
            Math.floor(Math.random() * availableSounds.length)
        ];

    lastPlayed[groupName] = selectedSound;

    return selectedSound;
}

// =========================================
// IDLE AUDIO
// =========================================

function startIdle() {
    if (idleSource || !buffers.idle || !audioContext) {
        return;
    }

    idleSource = audioContext.createBufferSource();
    idleGain = audioContext.createGain();

    idleSource.buffer = buffers.idle;
    idleSource.loop = true;

    // Idle remains quieter than the other sound effects.
    idleGain.gain.value = 0.6 * masterVolume;

    idleSource.connect(idleGain);
    idleGain.connect(audioContext.destination);

    idleSource.onended = () => {
        idleSource = null;
        idleGain = null;
    };

    idleSource.start();
}

function stopIdle() {
    if (!idleSource) {
        return;
    }

    const source = idleSource;

    idleSource = null;
    idleGain = null;

    source.stop();
}

// =========================================
// MASTER VOLUME
// =========================================

function updateVolume(value) {
    masterVolume = Number(value) / 100;

    volumeValue.textContent = `${value}%`;

    // Update the idle volume immediately when the slider changes.
    if (idleGain && audioContext) {
        idleGain.gain.setTargetAtTime(
            0.6 * masterVolume,
            audioContext.currentTime,
            0.02
        );
    }
}

// Listen for changes to the master volume slider.
volumeSlider.addEventListener('input', () => {
    updateVolume(volumeSlider.value);
});

// Set the default master volume to 100%.
volumeSlider.value = 100;
updateVolume(volumeSlider.value);

// =========================================
// INITIALIZE AUDIO
// =========================================

async function initializeAudio() {
    try {
        startButton.disabled = true;

        setStatus('loading', 'INITIALIZING AUDIO...');

        if (!audioContext || audioContext.state === 'closed') {
            const AudioContextClass =
                window.AudioContext || window.webkitAudioContext;

            audioContext = new AudioContextClass();
            audioReady = false;
        }

        await audioContext.resume();

        if (!audioReady) {
            await loadAudio();
            audioReady = true;
        }

        startIdle();
        playSample('startup');

        startButton.textContent = 'STOP AUDIO';

        setStatus('online', 'SYSTEM ONLINE');

        vscode.postMessage({
            type: 'audioState',
            enabled: true
        });

    } catch (error) {
        console.error('[CyberType] Audio error:', error);

        startButton.textContent = 'PLAY AUDIO';

        setStatus('offline', 'AUDIO ERROR — CHECK CONSOLE');

        vscode.postMessage({
            type: 'audioState',
            enabled: false
        });

    } finally {
        startButton.disabled = false;
    }
}

// =========================================
// STOP AUDIO
// =========================================

async function stopAudio() {
    stopIdle();

    if (audioContext && audioContext.state !== 'closed') {
        await audioContext.close();
    }

    audioContext = undefined;
    buffers = {};
    audioReady = false;

    startButton.textContent = 'PLAY AUDIO';

    setStatus('offline', 'SYSTEM OFFLINE');

    vscode.postMessage({
        type: 'audioState',
        enabled: false
    });
}

// =========================================
// MAIN BUTTON
// =========================================

startButton.addEventListener('click', async () => {
    if (audioReady && audioContext?.state === 'running') {
        await stopAudio();
    } else {
        await initializeAudio();
    }
});

// =========================================
// MESSAGE HANDLER
// =========================================

window.addEventListener('message', async event => {
    const message = event.data;

    if (!message || typeof message.type !== 'string') {
        return;
    }

    if (message.type === 'stop') {
        await stopAudio();
        return;
    }

    if (message.type !== 'play') {
        return;
    }

    let sound = message.sound;

    // If the sound belongs to a group,
    // select a sample without consecutive repetitions.
    if (soundGroups[sound]) {
        sound = getRandomSound(sound);
    }

    if (sound) {
        playSample(sound);
    }
});

// =========================================
// WEBVIEW READY
// =========================================

vscode.postMessage({
    type: 'ready'
});
