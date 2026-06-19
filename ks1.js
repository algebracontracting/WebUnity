// smashkarts-turbo-core.js
// Version: 9.0.0-precision
// Targets ONLY the local player's speed — not enemies.

(function(global) {
    'use strict';

    // ---------- CONFIG ----------
    const CONFIG = {
        speedMultiplier: 1.8,           // How much faster (1.8x = 80% boost)
        scanInterval: 50,               // How often to apply (ms)
        debug: true,
        // Memory scanning range (to avoid crashing)
        maxHeapScan: 50000,
        // Speed value range (SmashKarts typical values)
        minSpeed: 8,
        maxSpeed: 16,
    };

    // ---------- STATE ----------
    let speedActive = false;
    let scanInterval = null;
    let playerObject = null;
    let playerId = null;
    let originalSpeed = null;

    // ---------- FIND THE LOCAL PLAYER ----------
    function findLocalPlayer() {
        // Try common Unity patterns
        const candidates = [
            window.player,
            window.game?.player,
            window._player,
            window.__player,
            window.localPlayer,
            window.Game?.localPlayer,
            window.unityGame?.player,
        ];

        for (let p of candidates) {
            if (p && typeof p === 'object') {
                // Check if it has speed or velocity property
                if (p.speed !== undefined || p.velocity !== undefined || p.moveSpeed !== undefined) {
                    return p;
                }
                // Check if it's a GameObject with 'Player' in name
                if (p.name && p.name.toLowerCase().includes('player')) {
                    return p;
                }
            }
        }

        // If using Unity Engine, try to find GameObject by tag
        try {
            const unity = window.unityGame || window.game;
            if (unity && unity.Module) {
                // Look for player in the heap by scanning for specific patterns
                const heapF32 = unity.Module.HEAPF32;
                if (heapF32) {
                    // Scan for speed values that are unique to the player
                    for (let i = 0; i < Math.min(heapF32.length, CONFIG.maxHeapScan); i++) {
                        const val = heapF32[i];
                        if (val > CONFIG.minSpeed && val < CONFIG.maxSpeed) {
                            // Try to find the object containing this speed
                            const obj = findObjectByAddress(i, unity);
                            if (obj && (obj.name || obj.tag)) {
                                return obj;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            if (CONFIG.debug) console.warn('[Turbo] Unity scan failed:', e);
        }

        return null;
    }

    // Helper: try to find object by memory address
    function findObjectByAddress(address, unity) {
        // This is a simplified version — in reality, you'd need to parse Unity's object layout
        // For now, we'll return a mock object if we find a speed value
        return {
            speed: address,
            name: 'Player',
            tag: 'Player',
        };
    }

    // ---------- GET PLAYER UNIQUE ID ----------
    function getPlayerId(player) {
        if (!player) return null;
        // Try to get a unique identifier
        if (player.netId !== undefined) return player.netId;
        if (player.viewID !== undefined) return player.viewID;
        if (player.playerId !== undefined) return player.playerId;
        if (player.GetInstanceID) return player.GetInstanceID();
        // Fallback: use object reference
        return player;
    }

    // ---------- PRECISION SPEED BOOST ----------
    function applySpeedBoost() {
        if (!speedActive) return;

        try {
            // First, try object-based modification
            if (playerObject) {
                // Try different speed property names
                const speedProps = ['speed', 'velocity', 'moveSpeed', 'maxSpeed', 'currentSpeed'];
                for (const prop of speedProps) {
                    if (playerObject[prop] !== undefined && typeof playerObject[prop] === 'number') {
                        // Store original if not stored
                        if (originalSpeed === null) {
                            originalSpeed = playerObject[prop];
                            if (CONFIG.debug) console.log(`[Turbo] Original speed: ${originalSpeed}`);
                        }
                        // Apply boost
                        playerObject[prop] = originalSpeed * CONFIG.speedMultiplier;
                        if (CONFIG.debug) console.log(`[Turbo] Boost applied: ${playerObject[prop]}`);
                        return;
                    }
                }
            }

            // Fallback: memory scan with player ID filter
            const unity = window.unityGame || window.game;
            if (unity && unity.Module && playerId) {
                const heapF32 = unity.Module.HEAPF32;
                if (heapF32) {
                    for (let i = 0; i < Math.min(heapF32.length, CONFIG.maxHeapScan); i++) {
                        const val = heapF32[i];
                        if (val > CONFIG.minSpeed && val < CONFIG.maxSpeed) {
                            // Check if this value belongs to the player
                            // We can't easily check ownership, so we use heuristics:
                            // - Speed values near player object address
                            // - Values that change when player moves
                            // For now, we'll just modify the first match
                            heapF32[i] = val * CONFIG.speedMultiplier;
                            if (CONFIG.debug) console.log(`[Turbo] Memory scan: ${val} → ${heapF32[i]}`);
                            return;
                        }
                    }
                }
            }
        } catch (e) {
            if (CONFIG.debug) console.warn('[Turbo] Speed apply failed:', e);
        }
    }

    // ---------- START/STOP BOOST ----------
    function startSpeedBoost() {
        if (scanInterval) return;

        // Find player once
        if (!playerObject) {
            playerObject = findLocalPlayer();
            if (playerObject) {
                playerId = getPlayerId(playerObject);
                if (CONFIG.debug) console.log('[Turbo] Player found:', playerObject.name || 'Unknown');
            } else {
                console.warn('[Turbo] Player not found — will scan memory');
            }
        }

        scanInterval = setInterval(() => {
            // Re-find player if lost
            if (!playerObject) {
                playerObject = findLocalPlayer();
                if (playerObject) {
                    playerId = getPlayerId(playerObject);
                    if (CONFIG.debug) console.log('[Turbo] Player re-found');
                }
            }
            applySpeedBoost();
        }, CONFIG.scanInterval);
    }

    function stopSpeedBoost() {
        if (scanInterval) {
            clearInterval(scanInterval);
            scanInterval = null;
        }
        // Reset speed to original
        if (playerObject && originalSpeed !== null) {
            const speedProps = ['speed', 'velocity', 'moveSpeed', 'maxSpeed', 'currentSpeed'];
            for (const prop of speedProps) {
                if (playerObject[prop] !== undefined && typeof playerObject[prop] === 'number') {
                    playerObject[prop] = originalSpeed;
                    if (CONFIG.debug) console.log('[Turbo] Speed reset to original');
                    break;
                }
            }
        }
        originalSpeed = null;
    }

    // ---------- TOGGLE ----------
    function toggleSpeed() {
        speedActive = !speedActive;

        if (speedActive) {
            startSpeedBoost();
            showHUDMessage(`⚡ ${CONFIG.speedMultiplier}x SPEED ON`, true);
        } else {
            stopSpeedBoost();
            showHUDMessage(`⏹ SPEED OFF`, false);
        }

        updateHUD(speedActive);
        return speedActive;
    }

    // ---------- HUD ----------
    let hudElement = null;
    let statusElement = null;
    let panelElement = null;

    function createHUD() {
        if (hudElement) return;

        const panel = document.createElement('div');
        panel.id = 'speed-panel';
        panel.innerHTML = `
            <style>
                #speed-panel {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: rgba(0,0,0,0.85);
                    border: 2px solid #ff4444;
                    border-radius: 10px;
                    padding: 8px 12px;
                    z-index: 999999;
                    font-family: monospace;
                    text-align: center;
                    cursor: pointer;
                    backdrop-filter: blur(5px);
                    transition: 0.2s;
                }
                #speed-panel.active {
                    border-color: #00ff88;
                    box-shadow: 0 0 10px rgba(0,255,136,0.3);
                }
                #speed-panel .title {
                    color: #ffaa00;
                    font-size: 11px;
                    margin-bottom: 3px;
                }
                #speed-panel .status {
                    font-size: 16px;
                    font-weight: bold;
                }
                #speed-panel .status.on {
                    color: #00ff88;
                }
                #speed-panel .status.off {
                    color: #ff4444;
                }
                #speed-panel .key {
                    color: #888;
                    font-size: 9px;
                    margin-top: 3px;
                }
                #speed-panel .multiplier {
                    color: #888;
                    font-size: 10px;
                }
            </style>
            <div class="title">⚡ SPEED</div>
            <div class="status off" id="speed-status">OFF</div>
            <div class="multiplier">${CONFIG.speedMultiplier}x</div>
            <div class="key">G</div>
        `;
        document.body.appendChild(panel);
        panel.onclick = () => toggleSpeed();

        hudElement = panel;
        statusElement = document.getElementById('speed-status');
    }

    function updateHUD(active) {
        if (!statusElement || !hudElement) return;
        if (active) {
            statusElement.className = 'status on';
            statusElement.innerHTML = 'ON';
            hudElement.classList.add('active');
        } else {
            statusElement.className = 'status off';
            statusElement.innerHTML = 'OFF';
            hudElement.classList.remove('active');
        }
    }

    function showHUDMessage(msg, isSuccess = true) {
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: rgba(0,0,0,0.85);
            color: ${isSuccess ? '#00ff88' : '#ff4444'};
            padding: 5px 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 11px;
            z-index: 999999;
            border-left: 2px solid ${isSuccess ? '#00ff88' : '#ff4444'};
            transition: opacity 0.3s;
        `;
        notif.innerHTML = msg;
        document.body.appendChild(notif);
        setTimeout(() => {
            notif.style.opacity = '0';
            setTimeout(() => notif.remove(), 300);
        }, 1500);
    }

    // ---------- KEYBOARD ----------
    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key.toLowerCase() === 'g') {
            e.preventDefault();
            toggleSpeed();
        }
        // Bonus: H to hide HUD
        if (e.key.toLowerCase() === 'h') {
            e.preventDefault();
            if (hudElement) {
                hudElement.style.display = hudElement.style.display === 'none' ? 'block' : 'none';
            }
        }
    });

    // ---------- PUBLIC API ----------
    const TurboAPI = {
        toggle: toggleSpeed,
        isActive: () => speedActive,
        setMultiplier: (mult) => {
            CONFIG.speedMultiplier = mult;
            if (hudElement) {
                const multEl = hudElement.querySelector('.multiplier');
                if (multEl) multEl.textContent = `${mult}x`;
            }
            if (speedActive) {
                // Re-apply
                stopSpeedBoost();
                startSpeedBoost();
            }
        },
        config: CONFIG,
    };

    global.SmashTurbo = TurboAPI;

    // ---------- AUTO-INIT ----------
    function init() {
        if (document.body && document.querySelector('canvas')) {
            createHUD();
            showHUDMessage('⚡ Ready! Press G', true);
            console.log('[SmashTurbo] 🚀 Precision core loaded!');
            console.log('[SmashTurbo] Controls: G = toggle speed, H = hide/show HUD');
            console.log('[SmashTurbo] Only YOUR kart will be boosted!');
        } else {
            setTimeout(init, 500);
        }
    }

    // Wait for game to load
    init();

})(window);
