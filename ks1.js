// smashkarts-turbo-core.js
// Version: 7.0.0-direct-plugin
// Uses UnityWebModkit with your exact plugin config.

(function(global) {
    'use strict';

    // ---------- CONFIG ----------
    const CONFIG = {
        boostSpeed: 0.3,
        normalSpeed: 0.0,
        targetClass: 'PlayerController',   // CHANGE THIS
        targetMethod: 'UpdateMovement',    // CHANGE THIS
        debug: true,
    };

    // ---------- STATE ----------
    let boostActive = false;
    let plugin = null;
    let hook = null;
    let hudElement = null;

    // ---------- CREATE PLUGIN (YOUR EXACT CODE) ----------
    function createPlugin(runtime) {
        if (plugin) return plugin;

        plugin = runtime.createPlugin({
            name: "Hax",
            version: "1.0.0",
            referencedAssemblies: [
                'ACTk.Runtime.dll',
                'GameAssembly.dll',
                'System.Runtime.InteropServices.dll',
                'mscorlib.dll',
                "PhotonRealtime.dll",
                'PhotonUnityNetworking.dll',
                'PhotonUnityNetworking.Utilities.dll',
                'Assembly-CSharp.dll',
                'UnityEngine.CoreModule.dll',
                'UnityEngine.PhysicsModule.dll',
                'StompyRobot.SRDebugger.dll',
                "UnityEngine.IMGUIModule.dll",
                "Photon3Unity3D.dll",
                'Unity.TextMeshPro.dll',
                'FishNet.Runtime.dll',
            ]
        });

        if (CONFIG.debug) console.log('[Turbo] Plugin created with', plugin.referencedAssemblies.length, 'assemblies');
        return plugin;
    }

    // ---------- INSTALL HOOK ----------
    function installHook(runtime) {
        if (hook) return;

        const plugin = createPlugin(runtime);

        try {
            hook = plugin.hookPrefix({
                typeName: CONFIG.targetClass,
                methodName: CONFIG.targetMethod,
                params: ['f32'],    // Speed parameter is a float
                returnType: 'void'
            }, function(args) {
                if (boostActive && args.length > 0) {
                    args[0].set(CONFIG.boostSpeed);
                    if (CONFIG.debug) console.log('[Turbo] Speed set to', CONFIG.boostSpeed);
                }
            });

            if (CONFIG.debug) console.log(`[Turbo] Hooked ${CONFIG.targetClass}.${CONFIG.targetMethod}`);
        } catch (e) {
            console.error('[Turbo] Hook failed:', e);
            // Try to find the method dynamically
            autoDiscoverMethod(runtime);
        }
    }

    // ---------- AUTO-DISCOVER METHOD (FALLBACK) ----------
    function autoDiscoverMethod(runtime) {
        try {
            const scriptData = runtime.il2CppContext?.scriptData;
            if (!scriptData) return;

            // Common class/method patterns for kart games
            const classPatterns = ['Player', 'Kart', 'Vehicle', 'Car', 'Controller', 'Movement'];
            const methodPatterns = ['Speed', 'Move', 'Update', 'FixedUpdate', 'Apply', 'Set'];

            for (const className of Object.keys(scriptData)) {
                if (!classPatterns.some(p => className.includes(p))) continue;
                const methods = scriptData[className];
                for (const methodName of Object.keys(methods)) {
                    if (methodPatterns.some(p => methodName.includes(p))) {
                        CONFIG.targetClass = className;
                        CONFIG.targetMethod = methodName;
                        if (CONFIG.debug) console.log('[Turbo] Auto-found:', className, methodName);
                        installHook(runtime);
                        return;
                    }
                }
            }
        } catch (e) {
            console.error('[Turbo] Auto-discovery failed:', e);
        }
    }

    // ---------- TOGGLE SPEED ----------
    function toggleSpeed() {
        boostActive = !boostActive;
        if (CONFIG.debug) console.log(`[Turbo] Speed ${boostActive ? 'ON' : 'OFF'}`);
        updateHUD();
        return boostActive;
    }

    // ---------- HUD ----------
    function createHUD() {
        if (hudElement) return;
        const div = document.createElement('div');
        div.id = 'turbo-hud';
        div.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 99999;
            background: rgba(0,0,0,0.85); color: #0ff;
            padding: 8px 16px; border-radius: 6px;
            font: 14px 'Courier New', monospace;
            border: 2px solid #0ff; pointer-events: none;
            transition: all 0.2s ease;
        `;
        div.textContent = '⚡ SPEED: OFF';
        document.body.appendChild(div);
        hudElement = div;
    }

    function updateHUD() {
        if (!hudElement) return;
        hudElement.textContent = `⚡ SPEED: ${boostActive ? 'ON (0.3)' : 'OFF'}`;
        hudElement.style.borderColor = boostActive ? '#ff0066' : '#0ff';
        hudElement.style.color = boostActive ? '#ff0066' : '#0ff';
    }

    // ---------- PUBLIC API ----------
    const TurboAPI = {
        toggle: toggleSpeed,
        install: installHook,
        isActive: () => boostActive,
        config: CONFIG,
        plugin: () => plugin,
    };

    global.SmashTurbo = TurboAPI;

    // ---------- WAIT FOR UWM AND INSTALL ----------
    function waitForUWM() {
        const runtime = window.UnityWebModkit?.Runtime;
        if (runtime) {
            if (CONFIG.debug) console.log('[Turbo] UWM Runtime found!');
            createHUD();
            installHook(runtime);
            updateHUD();
        } else {
            setTimeout(waitForUWM, 300);
        }
    }

    waitForUWM();

    // ---------- KEYBOARD CONTROLS ----------
    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT') return;
        if (e.key === 'g' || e.key === 'G') {
            e.preventDefault();
            TurboAPI.toggle();
        }
        if (e.key === 'h' || e.key === 'H') {
            e.preventDefault();
            if (hudElement) {
                hudElement.style.display = hudElement.style.display === 'none' ? 'block' : 'none';
            }
        }
    });

    console.log('[SmashTurbo] 🚀 Core loaded with your plugin config!');
    console.log('[SmashTurbo] Controls: G = toggle speed, H = hide/show HUD');

})(window);
