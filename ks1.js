// ks1.js - SmashKarts Speed Hack (Expanded)
// Upload this to GitHub

(function() {
    'use strict';

    console.log('[Speed] Core script loaded from GitHub!');

    let speedOn = false;
    let speedMultiplier = 1.8;
    let scanInterval = null;
    let originalSpeed = null;
    let foundSpeedAddresses = [];

    // ---------- CREATE UI ----------
    function createUI() {
        if (document.getElementById('speed-box')) return;

        const box = document.createElement('div');
        box.id = 'speed-box';
        box.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999999;
            background: rgba(0,0,0,0.95);
            color: #00ff88;
            padding: 12px 20px;
            border-radius: 10px;
            font-family: 'Courier New', monospace;
            font-size: 16px;
            border: 3px solid #00ff88;
            text-align: center;
            cursor: pointer;
            user-select: none;
            box-shadow: 0 0 20px rgba(0,255,136,0.3);
            pointer-events: auto;
        `;
        box.innerHTML = '⚡ SPEED: <span id="speed-status">OFF</span>';
        document.body.appendChild(box);
        box.onclick = toggleSpeed;
        console.log('[Speed] ✅ UI created!');
        return box;
    }

    function updateUI() {
        const status = document.getElementById('speed-status');
        const box = document.getElementById('speed-box');
        if (status) {
            status.textContent = speedOn ? 'ON' : 'OFF';
            status.style.color = speedOn ? '#ff8800' : '#00ff88';
        }
        if (box) {
            box.style.borderColor = speedOn ? '#ff8800' : '#00ff88';
        }
    }

    // ---------- FIND UNITY ----------
    function getUnity() {
        return window.unityGame || window.game || window.Unity || null;
    }

    // ---------- HOOK SENDMESSAGE ----------
    function hookSendMessage() {
        const unity = getUnity();
        if (!unity || !unity.SendMessage) return false;

        const originalSend = unity.SendMessage;

        unity.SendMessage = function(gameObject, method, value) {
            const methodLower = (method || '').toLowerCase();
            // Watch for ANY method that might affect speed
            if (methodLower.includes('speed') ||
                methodLower.includes('velocity') ||
                methodLower.includes('move') ||
                methodLower.includes('set') ||
                methodLower.includes('apply') ||
                methodLower.includes('thrust')) {

                if (speedOn && value !== undefined && !isNaN(parseFloat(value))) {
                    const newValue = parseFloat(value) * speedMultiplier;
                    console.log('[Speed] 🎯 Intercepted:', method, value, '→', newValue);
                    value = newValue.toString();
                }
            }
            return originalSend.call(this, gameObject, method, value);
        };

        console.log('[Speed] ✅ SendMessage hooked!');
        return true;
    }

    // ---------- SCAN MEMORY (MULTIPLE RANGES) ----------
    function scanMemory() {
        const unity = getUnity();
        if (!unity || !unity.Module) return false;

        const heap = unity.Module.HEAPF32;
        if (!heap) return false;

        const targetSpeed = speedOn ? 18 : (originalSpeed || 10);
        let modified = 0;

        // Scan multiple ranges
        const ranges = [
            { min: 5, max: 25, step: 0.5 },    // Broad range
            { min: 8, max: 16, step: 0.1 },    // Narrow range
            { min: 1, max: 30, step: 1.0 },    // Full range
        ];

        for (const range of ranges) {
            for (let i = 0; i < Math.min(heap.length, 200000); i++) {
                const val = heap[i];
                if (val > range.min && val < range.max && Math.abs(val - Math.round(val)) < range.step) {
                    if (originalSpeed === null && !speedOn) {
                        originalSpeed = val;
                        console.log('[Speed] 📍 Found original speed:', val, 'at index', i);
                    }
                    // Only modify if it's close to a whole number (likely a speed value)
                    if (Math.abs(val - Math.round(val)) < 0.1) {
                        heap[i] = targetSpeed;
                        modified++;
                        if (modified > 10) break;
                    }
                }
            }
            if (modified > 0) break;
        }

        if (modified > 0 && speedOn) {
            console.log('[Speed] ⚡ Modified', modified, 'values to', targetSpeed);
        }
        return modified > 0;
    }

    // ---------- DIRECT PLAYER OVERRIDE ----------
    function overridePlayerSpeed() {
        const player = window.player || window.localPlayer || window._player || window.game?.player;
        if (!player) return false;

        let modified = false;
        const speedProps = ['speed', 'velocity', 'moveSpeed', 'maxSpeed', 'currentSpeed', 'baseSpeed', 'thrust'];

        for (const prop of speedProps) {
            if (player[prop] !== undefined && typeof player[prop] === 'number') {
                if (originalSpeed === null && !speedOn) {
                    originalSpeed = player[prop];
                    console.log('[Speed] 📍 Found player speed:', prop, '=', originalSpeed);
                }
                player[prop] = speedOn ? originalSpeed * speedMultiplier : originalSpeed;
                modified = true;
            }
        }
        return modified;
    }

    // ---------- TOGGLE ----------
    function toggleSpeed() {
        speedOn = !speedOn;
        updateUI();
        console.log('[Speed] 🚦 Speed:', speedOn ? 'ON' : 'OFF');

        if (speedOn) {
            hookSendMessage();
            // Try direct player override first
            overridePlayerSpeed();
            if (!scanInterval) {
                scanInterval = setInterval(() => {
                    scanMemory();
                    overridePlayerSpeed();
                }, 100);
            }
        } else {
            if (scanInterval) {
                clearInterval(scanInterval);
                scanInterval = null;
            }
            // Reset everything
            if (originalSpeed !== null) {
                // Reset player
                const player = window.player || window.localPlayer || window._player || window.game?.player;
                if (player) {
                    const speedProps = ['speed', 'velocity', 'moveSpeed', 'maxSpeed', 'currentSpeed', 'baseSpeed', 'thrust'];
                    for (const prop of speedProps) {
                        if (player[prop] !== undefined && typeof player[prop] === 'number') {
                            player[prop] = originalSpeed;
                        }
                    }
                }
                // Reset heap
                const unity = getUnity();
                if (unity?.Module?.HEAPF32) {
                    const heap = unity.Module.HEAPF32;
                    for (let i = 0; i < Math.min(heap.length, 200000); i++) {
                        if (heap[i] > 5 && heap[i] < 25) {
                            heap[i] = originalSpeed;
                        }
                    }
                }
                console.log('[Speed] 🔄 Reset speed to original');
            }
        }
    }

    // ---------- KEYBOARD ----------
    document.addEventListener('keydown', function(e) {
        if (e.key === 'g' || e.key === 'G') {
            e.preventDefault();
            toggleSpeed();
        }
        if (e.key === 'h' || e.key === 'H') {
            e.preventDefault();
            const box = document.getElementById('speed-box');
            if (box) {
                box.style.display = box.style.display === 'none' ? 'block' : 'none';
            }
        }
    });

    // ---------- INIT ----------
    function init() {
        createUI();

        if (window.unityGame) {
            console.log('[Speed] ✅ unityGame found!');
            hookSendMessage();
            // Do an initial scan
            setTimeout(() => {
                scanMemory();
                overridePlayerSpeed();
            }, 1000);
        } else {
            console.log('[Speed] ⏳ Waiting for unityGame...');
            setTimeout(init, 500);
        }
    }

    // Start
    setTimeout(init, 1000);

    // Watch for unityGame
    const observer = new MutationObserver(() => {
        if (window.unityGame) {
            console.log('[Speed] ✅ unityGame detected via observer!');
            hookSendMessage();
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    console.log('[Speed] 🎮 Ready! Press G to toggle.');
})();
