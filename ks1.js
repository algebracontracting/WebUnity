// smashkarts-turbo-core.js
// Version: 3.0.0-rebel-console
// Description: Speed boost + interactive console controller for SmashKarts.io

(function(global) {
    'use strict';

    // ---------- CONFIG ----------
    const CONFIG = {
        speedMultiplier: 1.8,          // Default boost multiplier
        boostDuration: 1500,           // How long boost stays active (ms)
        cooldown: 200,                 // Anti-spam cooldown (ms)
        debug: true,                   // Console logging
        minMultiplier: 0.3,            // Minimum allowed multiplier
        maxMultiplier: 5.0,            // Maximum allowed multiplier (insane mode)
        stepSize: 0.1,                 // How much to change per click
    };

    // ---------- STATE ----------
    let boostActive = false;
    let boostTimer = null;
    let lastPressTime = 0;
    let originalPlayerSpeed = null;
    let currentMultiplier = CONFIG.speedMultiplier;
    let gameContext = null;
    let playerFound = false;

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
                // Check for speed property
                if (p.speed !== undefined && typeof p.speed === 'number') {
                    return p;
                }
                // Sometimes it's nested
                if (p.body && p.body.speed !== undefined) {
                    return p.body;
                }
                if (p.velocity && typeof p.velocity === 'number') {
                    // Some games use velocity instead of speed
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

    // ---------- CORE BOOST LOGIC ----------
    function activateBoost() {
        const now = Date.now();
        if (now - lastPressTime < CONFIG.cooldown) {
            if (CONFIG.debug) console.log('[Turbo] Cooldown active');
            return false;
        }
        lastPressTime = now;

        // Find player if we don't have it
        if (!gameContext) {
            gameContext = findPlayerObject();
            if (!gameContext) {
                console.warn('[Turbo] No player object found!');
                return false;
            }
            playerFound = true;
            // Save original speed
            if (originalPlayerSpeed === null) {
                originalPlayerSpeed = gameContext.speed || gameContext.velocity || 0.6;
                if (CONFIG.debug) console.log(`[Turbo] Original speed: ${originalPlayerSpeed}`);
            }
        }

        // Re-check if original speed is still null
        if (originalPlayerSpeed === null) {
            originalPlayerSpeed = gameContext.speed || gameContext.velocity || 0.6;
        }

        // Apply boost using current multiplier
        const boostedSpeed = originalPlayerSpeed * currentMultiplier;
        
        // Handle different property names
        if (gameContext.speed !== undefined) {
            gameContext.speed = boostedSpeed;
        }
        if (gameContext.velocity !== undefined) {
            gameContext.velocity = boostedSpeed;
        }
        
        boostActive = true;

        if (CONFIG.debug) console.log(`[Turbo] BOOST ON! Speed: ${boostedSpeed.toFixed(3)} (${currentMultiplier.toFixed(1)}x)`);

        // Clear previous timer
        if (boostTimer) clearTimeout(boostTimer);

        // Auto-deactivate after duration
        boostTimer = setTimeout(() => {
            deactivateBoost();
        }, CONFIG.boostDuration);

        // Update UI if console exists
        if (global.SmashTurbo && global.SmashTurbo.updateUI) {
            global.SmashTurbo.updateUI();
        }

        return true;
    }

    function deactivateBoost() {
        if (!boostActive && !boostTimer) return;
        
        if (gameContext && originalPlayerSpeed !== null) {
            if (gameContext.speed !== undefined) {
                gameContext.speed = originalPlayerSpeed;
            }
            if (gameContext.velocity !== undefined) {
                gameContext.velocity = originalPlayerSpeed;
            }
        }
        
        boostActive = false;
        if (boostTimer) {
            clearTimeout(boostTimer);
            boostTimer = null;
        }
        
        if (CONFIG.debug) console.log('[Turbo] BOOST OFF');
        
        // Update UI if console exists
        if (global.SmashTurbo && global.SmashTurbo.updateUI) {
            global.SmashTurbo.updateUI();
        }
    }

    // ---------- MULTIPLIER CONTROL ----------
    function setMultiplier(value) {
        if (typeof value !== 'number' || isNaN(value)) return false;
        
        // Clamp to limits
        value = Math.max(CONFIG.minMultiplier, Math.min(CONFIG.maxMultiplier, value));
        currentMultiplier = Math.round(value * 10) / 10; // Round to 1 decimal
        
        // If boost is active, re-apply with new multiplier
        if (boostActive) {
            // Temporarily deactivate and reactivate
            const wasActive = boostActive;
            if (wasActive) {
                // Store old boost state, deactivate, then reactivate
                const oldOriginal = originalPlayerSpeed;
                deactivateBoost();
                // Restore original speed reference
                originalPlayerSpeed = oldOriginal;
                activateBoost();
            }
        }
        
        if (CONFIG.debug) console.log(`[Turbo] Multiplier set to ${currentMultiplier.toFixed(1)}x`);
        
        // Update UI
        if (global.SmashTurbo && global.SmashTurbo.updateUI) {
            global.SmashTurbo.updateUI();
        }
        
        return true;
    }

    function increaseMultiplier(step) {
        step = step || CONFIG.stepSize;
        return setMultiplier(currentMultiplier + step);
    }

    function decreaseMultiplier(step) {
        step = step || CONFIG.stepSize;
        return setMultiplier(currentMultiplier - step);
    }

    // ---------- RESCAN ----------
    function rescan() {
        gameContext = null;
        originalPlayerSpeed = null;
        playerFound = false;
        const newPlayer = findPlayerObject();
        if (newPlayer) {
            gameContext = newPlayer;
            originalPlayerSpeed = gameContext.speed || gameContext.velocity || 0.6;
            playerFound = true;
            console.log('[Turbo] Rescan successful – player found');
            return true;
        } else {
            console.warn('[Turbo] Rescan failed – no player object');
            return false;
        }
    }

    // ---------- CONSOLE UI (FLOATING CONTROLS) ----------
    let consoleElement = null;
    let isConsoleVisible = true;

    function createConsole() {
        if (consoleElement) {
            consoleElement.style.display = isConsoleVisible ? 'block' : 'none';
            return consoleElement;
        }

        // Create the console container
        const div = document.createElement('div');
        div.id = 'turbo-console';
        div.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 99999;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(8px);
            border: 2px solid #00ffcc;
            border-radius: 12px;
            padding: 16px 20px;
            font-family: 'Courier New', monospace;
            color: #00ffcc;
            min-width: 240px;
            box-shadow: 0 8px 32px rgba(0, 255, 204, 0.3);
            user-select: none;
            cursor: move;
            transition: all 0.2s ease;
        `;

        // Header with title and close button
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            border-bottom: 1px solid rgba(0, 255, 204, 0.3);
            padding-bottom: 6px;
        `;
        header.innerHTML = `
            <span style="font-weight: bold; font-size: 14px; letter-spacing: 1px;">
                ⚡ TURBO CONSOLE
            </span>
            <button id="turbo-console-close" style="
                background: none;
                border: none;
                color: #ff6b6b;
                font-size: 18px;
                cursor: pointer;
                padding: 0 6px;
                font-weight: bold;
            ">✕</button>
        `;
        div.appendChild(header);

        // Status display
        const status = document.createElement('div');
        status.id = 'turbo-status';
        status.style.cssText = `
            font-size: 13px;
            margin-bottom: 10px;
            padding: 6px 10px;
            background: rgba(0, 255, 204, 0.1);
            border-radius: 6px;
            border-left: 3px solid #00ffcc;
        `;
        status.textContent = `Status: ${boostActive ? '🚀 BOOST ACTIVE' : '⏸️  IDLE'}`;
        div.appendChild(status);

        // Speed info
        const speedInfo = document.createElement('div');
        speedInfo.id = 'turbo-speed-info';
        speedInfo.style.cssText = `
            font-size: 12px;
            margin-bottom: 12px;
            color: #88ffcc;
        `;
        speedInfo.textContent = `Multiplier: ${currentMultiplier.toFixed(1)}x | Speed: ${originalPlayerSpeed ? (originalPlayerSpeed * currentMultiplier).toFixed(2) : '???'}`;
        div.appendChild(speedInfo);

        // Control buttons row
        const controls = document.createElement('div');
        controls.style.cssText = `
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        `;

        const buttonStyle = `
            background: rgba(0, 255, 204, 0.15);
            border: 1px solid #00ffcc;
            color: #00ffcc;
            padding: 6px 14px;
            border-radius: 6px;
            cursor: pointer;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            font-weight: bold;
            transition: all 0.15s ease;
            flex: 1;
            min-width: 50px;
        `;

        const buttonHover = `
            background: rgba(0, 255, 204, 0.3);
            transform: scale(1.02);
        `;

        // Decrease button
        const btnDec = document.createElement('button');
        btnDec.textContent = '−';
        btnDec.style.cssText = buttonStyle;
        btnDec.onmouseover = () => btnDec.style.cssText += buttonHover;
        btnDec.onmouseout = () => btnDec.style.cssText = buttonStyle;
        btnDec.onclick = () => {
            decreaseMultiplier();
            updateConsole();
        };
        controls.appendChild(btnDec);

        // Reset button
        const btnReset = document.createElement('button');
        btnReset.textContent = '1.0×';
        btnReset.style.cssText = buttonStyle + 'background: rgba(255, 200, 0, 0.15); border-color: #ffcc00; color: #ffcc00;';
        btnReset.onmouseover = () => btnReset.style.cssText += buttonHover;
        btnReset.onmouseout = () => btnReset.style.cssText = buttonStyle + 'background: rgba(255, 200, 0, 0.15); border-color: #ffcc00; color: #ffcc00;';
        btnReset.onclick = () => {
            setMultiplier(1.0);
            updateConsole();
        };
        controls.appendChild(btnReset);

        // Increase button
        const btnInc = document.createElement('button');
        btnInc.textContent = '+';
        btnInc.style.cssText = buttonStyle;
        btnInc.onmouseover = () => btnInc.style.cssText += buttonHover;
        btnInc.onmouseout = () => btnInc.style.cssText = buttonStyle;
        btnInc.onclick = () => {
            increaseMultiplier();
            updateConsole();
        };
        controls.appendChild(btnInc);

        // Boost button (manual trigger)
        const btnBoost = document.createElement('button');
        btnBoost.textContent = '🔥 BOOST';
        btnBoost.style.cssText = `
            ${buttonStyle}
            background: rgba(255, 0, 100, 0.25);
            border-color: #ff0066;
            color: #ff0066;
            flex: 2;
        `;
        btnBoost.onmouseover = () => btnBoost.style.cssText += buttonHover;
        btnBoost.onmouseout = () => btnBoost.style.cssText = `
            ${buttonStyle}
            background: rgba(255, 0, 100, 0.25);
            border-color: #ff0066;
            color: #ff0066;
            flex: 2;
        `;
        btnBoost.onclick = () => {
            activateBoost();
            updateConsole();
        };
        controls.appendChild(btnBoost);

        div.appendChild(controls);

        // Rescan button (small, subtle)
        const bottomRow = document.createElement('div');
        bottomRow.style.cssText = `
            margin-top: 10px;
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        `;

        const smallBtnStyle = `
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #888;
            padding: 3px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 10px;
            font-family: 'Courier New', monospace;
            transition: all 0.15s ease;
        `;

        const btnRescan = document.createElement('button');
        btnRescan.textContent = '⟳ Rescan Player';
        btnRescan.style.cssText = smallBtnStyle;
        btnRescan.onclick = () => {
            rescan();
            updateConsole();
        };
        bottomRow.appendChild(btnRescan);

        const btnToggle = document.createElement('button');
        btnToggle.textContent = '⊟ Hide';
        btnToggle.style.cssText = smallBtnStyle;
        btnToggle.onclick = () => {
            isConsoleVisible = false;
            div.style.display = 'none';
        };
        bottomRow.appendChild(btnToggle);

        div.appendChild(bottomRow);

        // Close button functionality
        div.querySelector('#turbo-console-close').onclick = () => {
            isConsoleVisible = false;
            div.style.display = 'none';
        };

        // Make draggable
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        div.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            const rect = div.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
            div.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let x = e.clientX - dragOffsetX;
            let y = e.clientY - dragOffsetY;
            // Keep within viewport
            x = Math.max(0, Math.min(window.innerWidth - div.offsetWidth, x));
            y = Math.max(0, Math.min(window.innerHeight - div.offsetHeight, y));
            div.style.left = x + 'px';
            div.style.bottom = 'auto';
            div.style.top = y + 'px';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            div.style.cursor = 'move';
        });

        document.body.appendChild(div);
        consoleElement = div;
        return div;
    }

    function updateConsole() {
        if (!consoleElement) return;
        
        const statusEl = document.getElementById('turbo-status');
        const speedInfoEl = document.getElementById('turbo-speed-info');
        
        if (statusEl) {
            statusEl.textContent = `Status: ${boostActive ? '🚀 BOOST ACTIVE' : '⏸️  IDLE'}`;
            statusEl.style.borderLeftColor = boostActive ? '#ff0066' : '#00ffcc';
        }
        
        if (speedInfoEl) {
            const currentSpeed = originalPlayerSpeed ? (originalPlayerSpeed * currentMultiplier).toFixed(2) : '???';
            speedInfoEl.textContent = `Multiplier: ${currentMultiplier.toFixed(1)}x | Speed: ${currentSpeed}`;
        }
    }

    // ---------- PUBLIC API ----------
    const TurboAPI = {
        // Core functions
        boost: activateBoost,
        unboost: deactivateBoost,
        toggle: function() {
            if (boostActive) {
                deactivateBoost();
            } else {
                activateBoost();
            }
            updateConsole();
        },
        isActive: function() { return boostActive; },
        
        // Multiplier control
        setMultiplier: setMultiplier,
        increaseMultiplier: increaseMultiplier,
        decreaseMultiplier: decreaseMultiplier,
        getMultiplier: function() { return currentMultiplier; },
        
        // Player management
        rescan: rescan,
        getPlayerSpeed: function() { return originalPlayerSpeed; },
        
        // Console UI
        showConsole: function() {
            isConsoleVisible = true;
            if (consoleElement) {
                consoleElement.style.display = 'block';
            } else {
                createConsole();
            }
            updateConsole();
        },
        hideConsole: function() {
            isConsoleVisible = false;
            if (consoleElement) {
                consoleElement.style.display = 'none';
            }
        },
        toggleConsole: function() {
            if (isConsoleVisible) {
                this.hideConsole();
            } else {
                this.showConsole();
            }
        },
        updateUI: updateConsole,
        
        // Config
        config: CONFIG,
    };

    // Expose globally
    global.SmashTurbo = TurboAPI;

    // Auto-create console on load
    setTimeout(() => {
        createConsole();
        updateConsole();
        console.log('[SmashTurbo] 🚀 Core loaded with console! Left Shift to boost, use console to adjust speed.');
        console.log('[SmashTurbo] Controls: Left Shift = Boost | Console buttons = adjust multiplier');
    }, 500);

})(window);