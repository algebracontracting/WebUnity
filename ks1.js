// ks1.js - SmashKarts Speed Hack
// Upload this to GitHub and use the raw URL in Tampermonkey

(function() {
    'use strict';

    console.log('[Speed] Core script loaded from GitHub!');

    let speedOn = false;
    let speedMultiplier = 1.8;
    let scanInterval = null;
    let originalSpeed = null;

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

    // ---------- SPEED LOGIC ----------
    function getUnity() {
        return window.unityGame || window.game || null;
    }

    function hookSendMessage() {
        const unity = getUnity();
        if (!unity || !unity.SendMessage) return false;

        const originalSend = unity.SendMessage;

        unity.SendMessage = function(gameObject, method, value) {
            const methodLower = (method || '').toLowerCase();
            if (methodLower.includes('speed') ||
                methodLower.includes('velocity') ||
                methodLower.includes('move') ||
                methodLower.includes('set')) {

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

    function scanMemory() {
        const unity = getUnity();
        if (!unity || !unity.Module) return false;

        const heap = unity.Module.HEAPF32;
        if (!heap) return false;

        const targetSpeed = speedOn ? 18 : (originalSpeed || 10);
        let modified = 0;

        for (let i = 0; i < Math.min(heap.length, 100000); i++) {
            const val = heap[i];
            if (val > 8 && val < 16 && Math.abs(val - Math.round(val)) < 0.1) {
                if (originalSpeed === null && !speedOn) {
                    originalSpeed = val;
                    console.log('[Speed] 📍 Found original speed:', val);
                }
                heap[i] = targetSpeed;
                modified++;
                if (modified > 5) break;
            }
        }

        if (modified > 0 && speedOn) {
            console.log('[Speed] ⚡ Modified', modified, 'values to', targetSpeed);
        }
        return modified > 0;
    }

    function toggleSpeed() {
        speedOn = !speedOn;
        updateUI();
        console.log('[Speed] 🚦 Speed:', speedOn ? 'ON' : 'OFF');

        if (speedOn) {
            hookSendMessage();
            if (!scanInterval) {
                scanInterval = setInterval(scanMemory, 100);
            }
        } else {
            if (scanInterval) {
                clearInterval(scanInterval);
                scanInterval = null;
            }
            if (originalSpeed !== null) {
                const unity = getUnity();
                if (unity?.Module?.HEAPF32) {
                    const heap = unity.Module.HEAPF32;
                    for (let i = 0; i < Math.min(heap.length, 100000); i++) {
                        if (heap[i] > 8 && heap[i] < 16) {
                            heap[i] = originalSpeed;
                        }
                    }
                    console.log('[Speed] 🔄 Reset speed to original');
                }
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
            scanMemory();
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
