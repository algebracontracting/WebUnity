// ==UserScript==
// @name         SmashKarts Turbo Loader
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Loads the turbo core from GitHub and binds Left Shift to speed boost.
// @author       YourGitHubUsername
// @match        https://smashkarts.io/*
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_xmlhttpRequest
// @require      https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME/main/smashkarts-turbo-core.js
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ---------- WAIT FOR CORE TO LOAD ----------
    // The @require above loads the core, but we'll ensure it's ready.
    function waitForTurbo(callback, attempts) {
        attempts = attempts || 0;
        if (window.SmashTurbo) {
            callback();
        } else if (attempts < 20) {
            setTimeout(() => waitForTurbo(callback, attempts + 1), 200);
        } else {
            console.error('[Turbo Loader] Core not loaded after 4 seconds – check your @require URL.');
        }
    }

    waitForTurbo(() => {
        console.log('[Turbo Loader] Core ready. Binding Left Shift...');

        // ---------- BIND LEFT SHIFT ----------
        document.addEventListener('keydown', function(e) {
            // Left shift key code = 16, but we check the key property for safety
            if (e.key === 'Shift' && e.location === 1) { // Location 1 = Left Shift
                e.preventDefault(); // Prevent default browser behavior (like opening search)
                window.SmashTurbo.boost();
            }
        });

        // ---------- ADD A TINY HUD INDICATOR ----------
        GM_addStyle(`
            #turbo-hud {
                position: fixed;
                top: 12px;
                right: 12px;
                background: rgba(0,0,0,0.75);
                color: #0ff;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                padding: 8px 14px;
                border-radius: 20px;
                border: 1px solid #0ff;
                z-index: 9999;
                pointer-events: none;
                user-select: none;
                transition: 0.2s ease;
                box-shadow: 0 0 15px rgba(0,255,255,0.3);
            }
            #turbo-hud.active {
                color: #f0f;
                border-color: #f0f;
                box-shadow: 0 0 25px rgba(255,0,255,0.6);
                transform: scale(1.05);
            }
        `);

        const hud = document.createElement('div');
        hud.id = 'turbo-hud';
        hud.textContent = '⚡ TURBO: OFF';
        document.body.appendChild(hud);

        // Monitor boost state via a small interval (cheap and reliable)
        setInterval(() => {
            if (window.SmashTurbo && window.SmashTurbo.isActive()) {
                hud.textContent = '⚡ TURBO: ON';
                hud.classList.add('active');
            } else {
                hud.textContent = '⚡ TURBO: OFF';
                hud.classList.remove('active');
            }
        }, 150);

        // ---------- KEY COMBO TO CHANGE MULTIPLIER (BONUS) ----------
        document.addEventListener('keydown', function(e) {
            // Right Shift + Number to set multiplier
            if (e.key === 'Shift' && e.location === 2) { // Right Shift
                const num = parseInt(e.key, 10);
                if (num >= 1 && num <= 9) {
                    const mult = num * 0.3 + 0.5; // maps 1→0.8, 9→3.2
                    window.SmashTurbo.setMultiplier(mult);
                    console.log(`[Turbo] Multiplier set to ${mult.toFixed(2)}x`);
                    // Quick visual feedback
                    hud.textContent = `⚡ ${mult.toFixed(1)}x`;
                    setTimeout(() => {
                        hud.textContent = window.SmashTurbo.isActive() ? '⚡ TURBO: ON' : '⚡ TURBO: OFF';
                    }, 800);
                }
            }
        });

        console.log('[Turbo Loader] Left Shift = boost, Right Shift + 1‑9 = set multiplier.');
    });

})();