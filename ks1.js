// smashkarts-turbo-core.js
// Version: 4.0.0-keyboard-rebel
// Description: G toggles speed between 0.0 and 0.3, H hides/shows the box.

(function(global) {
    'use strict';

    // ---------- CONFIG ----------
    const CONFIG = {
        boostSpeed: 0.3,              // The speed we set when toggled ON
        normalSpeed: 0.0,             // The speed we set when toggled OFF
        debug: true,                  // Console logging
    };

    // ---------- STATE ----------
    let isBoostActive = false;
    let gameContext = null;
    let originalPlayerSpeed = null;   // Store the game's default speed
    let speedOverridden = false;      // Track if we've manually set speed

    // ---------- UTILITY: Find the player object ----------
    function findPlayerObject() {
        const candidates = [
            window.player,
            window.game?.player,
            window._player,
            window.__player,
            window.game?.physics?.player,
            window.Game?.player,
        ];

        for (let p of candidates) {
            if (p && typeof p === 'object') {
                if (p.speed !== undefined && typeof p.speed === 'number') {
                    return p;
                }
                if (p.body && p.body.speed !== undefined) {
                    return p.body;
                }
                if (p.velocity && typeof p.velocity === 'number') {
                    return p;
                }
            }
        }

        // Brute force search (last resort)
        for (let key in window) {
            try {
                let obj = window[key];
                if (obj && typeof obj === 'object' && obj !== window) {
                    if (obj.speed !== undefined && typeof obj.speed === 'number' && obj.speed > 0) {
                        return obj;
                    }
                    if (obj.velocity !== undefined && typeof obj.velocity === 'number' && obj.velocity > 0) {
                        return obj;
                    }
                }
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    // ---------- CORE TOGGLE LOGIC ----------
    function toggleSpeed() {
        // Find player if we don't have it
        if (!gameContext) {
            gameContext = findPlayerObject();
            if (!gameContext) {
                console.warn('[Turbo] No player object found!');
                return false;
            }
            // Save original speed only once
            if (originalPlayerSpeed === null) {
                originalPlayerSpeed = gameContext.speed || gameContext.velocity || 0.6;
                if (CONFIG.debug) console.log(`[Turbo] Original speed: ${originalPlayerSpeed}`);
            }
        }

        // If we haven't saved original speed yet (edge case), do it now
        if (originalPlayerSpeed === null) {
            originalPlayerSpeed = gameContext.speed || gameContext.velocity || 0.6;
        }

        // Toggle state
        isBoostActive = !isBoostActive;

        if (isBoostActive) {
            // Set to boost speed (0.3)
            const targetSpeed = CONFIG.boostSpeed;
            if (gameContext.speed !== undefined) {
                gameContext.speed = targetSpeed;
            }
            if (gameContext.velocity !== undefined) {
                gameContext.velocity = targetSpeed;
            }
            speedOverridden = true;
            if (CONFIG.debug) console.log(`[Turbo] BOOST ON! Speed set to ${targetSpeed}`);
        } else {
            // Revert to original speed
            if (gameContext.speed !== undefined) {
                gameContext.speed = originalPlayerSpeed;
            }
            if (gameContext.velocity !== undefined) {
                gameContext.velocity = originalPlayerSpeed;
            }
            speedOverridden = false;
            if (CONFIG.debug) console.log(`[Turbo] BOOST OFF! Speed reverted to ${originalPlayerSpeed}`);
        }

        // Update the box display
        updateBoxDisplay();
        return true;
    }

    // ---------- RESCAN (if player object changes) ----------
    function rescan() {
        gameContext = null;
        originalPlayerSpeed = null;
        speedOverridden = false;
        isBoostActive = false;
        const newPlayer = findPlayerObject();
        if (newPlayer) {
            gameContext = newPlayer;
            originalPlayerSpeed = gameContext.speed || gameContext.velocity || 0.6;
            console.log('[Turbo] Rescan successful – player found');
            // Reset the box display
            updateBoxDisplay();
            return true;
        } else {
            console.warn('[Turbo] Rescan failed – no player object');
            return false;
        }
    }

    // ---------- THE BOX (Minimal HUD) ----------
    let boxElement = null;
    let isBoxVisible = true;

    function createBox() {
        if (boxElement) {
            boxElement.style.display = isBoxVisible ? 'block' : 'none';
            return boxElement;
        }

        const div = document.createElement('div');
        div.id = 'turbo-box';
        div.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 99999;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(4px);
            border: 2px solid #00ffcc;
            border-radius: 8px;
            padding: 10px 16px;
            font-family: 'Courier New', monospace;
            color: #00ffcc;
            font-size: 14px;
            font-weight: bold;
            user-select: none;
            pointer-events: none;
            transition: all 0.2s ease;
            box-shadow: 0 4px 20px rgba(0, 255, 204, 0.2);
        `;
        div.textContent = '⚡ SPEED: 0.0';
        document.body.appendChild(div);
        boxElement = div;
        return div;
    }

    function updateBoxDisplay() {
        if (!boxElement) return;
        const currentSpeed = isBoostActive ? CONFIG.boostSpeed : (originalPlayerSpeed || 0);
        boxElement.textContent = `⚡ SPEED: ${currentSpeed.toFixed(1)}`;
        boxElement.style.borderColor = isBoostActive ? '#ff0066' : '#00ffcc';
        boxElement.style.boxShadow = isBoostActive ? '0 0 30px rgba(255, 0, 102, 0.4)' : '0 4px 20px rgba(0, 255, 204, 0.2)';
    }

    function toggleBoxVisibility() {
        isBoxVisible = !isBoxVisible;
        if (boxElement) {
            boxElement.style.display = isBoxVisible ? 'block' : 'none';
        }
        if (CONFIG.debug) console.log(`[Turbo] Box ${isBoxVisible ? 'shown' : 'hidden'}`);
    }

    // ---------- PUBLIC API ----------
    const TurboAPI = {
        // Core toggle (G key)
        toggle: toggleSpeed,
        
        // Box toggle (H key)
        toggleBox: toggleBoxVisibility,
        
        // Utility
        rescan: rescan,
        isActive: function() { return isBoostActive; },
        getSpeed: function() { return isBoostActive ? CONFIG.boostSpeed : (originalPlayerSpeed || 0); },
        
        // Manual control (if you want to bind to other keys later)
        setSpeed: function(value) {
            if (typeof value !== 'number' || isNaN(value)) return false;
            if (!gameContext) {
                gameContext = findPlayerObject();
                if (!gameContext) return false;
            }
            if (originalPlayerSpeed === null) {
                originalPlayerSpeed = gameContext.speed || gameContext.velocity || 0.6;
            }
            // Set the speed directly
            if (gameContext.speed !== undefined) {
                gameContext.speed = value;
            }
            if (gameContext.velocity !== undefined) {
                gameContext.velocity = value;
            }
            isBoostActive = (value === CONFIG.boostSpeed);
            updateBoxDisplay();
            return true;
        },
        
        // Config (so you can change 0.3 to something else)
        config: CONFIG,
    };

    // Expose globally
    global.SmashTurbo = TurboAPI;

    // Auto-create box on load
    setTimeout(() => {
        createBox();
        updateBoxDisplay();
        console.log('[SmashTurbo] 🚀 Core loaded!');
        console.log('[SmashTurbo] Controls: G = toggle speed (0.0 ↔ 0.3) | H = hide/show box');
        console.log('[SmashTurbo] Current speed: 0.0');
    }, 500);

})(window);
