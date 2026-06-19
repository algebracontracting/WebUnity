// speed-debug.js - Comprehensive Speed Value Debugger
// This script monitors Unity memory and logs all potential speed values

(function() {
    'use strict';

    console.log('%c🔍 SPEED DEBUGGER LOADED', 'font-size:20px; font-weight:bold; color:#00ff88;');
    console.log('%cPress G to start/stop monitoring', 'font-size:14px; color:#ffaa00;');

    // ---------- STATE ----------
    let isMonitoring = false;
    let monitorInterval = null;
    let speedCandidates = [];
    let memorySnapshots = [];
    let foundAddresses = [];

    // ---------- UI ----------
    function createUI() {
        if (document.getElementById('debug-box')) return;

        const box = document.createElement('div');
        box.id = 'debug-box';
        box.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999999;
            background: rgba(0,0,0,0.95);
            color: #00ff88;
            padding: 15px 20px;
            border-radius: 10px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            border: 3px solid #00ff88;
            min-width: 200px;
            text-align: left;
            pointer-events: auto;
            max-height: 80vh;
            overflow-y: auto;
        `;
        box.innerHTML = `
            <div style="font-weight:bold; margin-bottom:10px;">🔍 SPEED DEBUGGER</div>
            <div id="debug-status" style="color:#ffaa00;">⏹ STOPPED</div>
            <div id="debug-found" style="color:#888; font-size:12px;">Found: 0 addresses</div>
            <div id="debug-values" style="color:#888; font-size:11px; margin-top:5px;"></div>
            <div style="margin-top:10px; font-size:11px; color:#666;">Press G to toggle</div>
        `;
        document.body.appendChild(box);
        return box;
    }

    function updateUI(status, found, values) {
        const statusEl = document.getElementById('debug-status');
        const foundEl = document.getElementById('debug-found');
        const valuesEl = document.getElementById('debug-values');
        if (statusEl) statusEl.textContent = status;
        if (foundEl) foundEl.textContent = `Found: ${found} addresses`;
        if (valuesEl && values) {
            valuesEl.innerHTML = values.slice(0, 5).map(v => 
                `📍 [${v.index}] = ${v.value.toFixed(2)}`
            ).join('<br>');
        }
    }

    // ---------- GET UNITY ----------
    function getUnity() {
        return window.unityGame || window.game || window.Unity || null;
    }

    // ---------- SCAN MEMORY ----------
    function scanMemory() {
        const unity = getUnity();
        if (!unity || !unity.Module) {
            console.warn('[Debug] ⚠️ Unity not found!');
            return [];
        }

        const heap = unity.Module.HEAPF32;
        if (!heap) return [];

        let candidates = [];
        const ranges = [
            { min: 5, max: 25, label: 'Speed range' },
            { min: 1, max: 50, label: 'Broad range' },
            { min: 0.5, max: 30, label: 'Full range' },
        ];

        for (const range of ranges) {
            for (let i = 0; i < Math.min(heap.length, 200000); i++) {
                const val = heap[i];
                if (val > range.min && val < range.max) {
                    // Check if it's a "clean" number (likely a speed value)
                    const rounded = Math.round(val);
                    if (Math.abs(val - rounded) < 0.1 && rounded > 5 && rounded < 25) {
                        candidates.push({
                            index: i,
                            value: val,
                            rounded: rounded,
                            range: range.label
                        });
                    }
                }
            }
            if (candidates.length > 0) break;
        }

        return candidates;
    }

    // ---------- COMPARE SNAPSHOTS ----------
    function compareSnapshots(snapshot1, snapshot2) {
        const changes = [];
        for (let i = 0; i < Math.min(snapshot1.length, snapshot2.length); i++) {
            if (Math.abs(snapshot1[i] - snapshot2[i]) > 0.5) {
                changes.push({
                    index: i,
                    oldValue: snapshot1[i],
                    newValue: snapshot2[i],
                    diff: snapshot2[i] - snapshot1[i]
                });
            }
        }
        return changes;
    }

    // ---------- MONITOR LOOP ----------
    function startMonitoring() {
        if (isMonitoring) return;
        isMonitoring = true;
        console.log('[Debug] 🟢 Monitoring started! Drive your kart.');

        let lastSnapshot = null;
        let changeLog = [];

        monitorInterval = setInterval(() => {
            const unity = getUnity();
            if (!unity || !unity.Module) {
                updateUI('⏹ UNITY NOT FOUND', 0, []);
                return;
            }

            const heap = unity.Module.HEAPF32;
            const snapshot = new Float32Array(heap.slice(0, Math.min(heap.length, 100000)));

            if (lastSnapshot) {
                const changes = compareSnapshots(lastSnapshot, snapshot);
                if (changes.length > 0) {
                    // Filter for speed-like changes (values between 5-25)
                    const speedChanges = changes.filter(c => 
                        c.newValue > 5 && c.newValue < 25 && 
                        Math.abs(c.newValue - Math.round(c.newValue)) < 0.2
                    );

                    if (speedChanges.length > 0) {
                        speedChanges.forEach(c => {
                            // Check if this address was found before
                            const existing = foundAddresses.find(f => f.index === c.index);
                            if (!existing) {
                                foundAddresses.push({
                                    index: c.index,
                                    value: c.newValue,
                                    firstSeen: Date.now()
                                });
                                console.log(`[Debug] 🎯 NEW SPEED ADDRESS: index ${c.index} = ${c.newValue.toFixed(2)}`);
                            } else {
                                existing.value = c.newValue;
                            }
                        });

                        // Update UI
                        const sorted = foundAddresses.sort((a, b) => a.index - b.index);
                        const displayValues = sorted.slice(0, 10).map(f => 
                            `📍 [${f.index}] = ${f.value.toFixed(2)}`
                        );
                        updateUI(
                            `🟢 MONITORING (${foundAddresses.length} found)`,
                            foundAddresses.length,
                            displayValues
                        );
                    }
                }
            }

            lastSnapshot = snapshot;
        }, 200); // Check every 200ms
    }

    function stopMonitoring() {
        if (monitorInterval) {
            clearInterval(monitorInterval);
            monitorInterval = null;
        }
        isMonitoring = false;
        console.log('[Debug] 🔴 Monitoring stopped.');
        console.log('[Debug] 📊 Found addresses:', foundAddresses);
        updateUI('⏹ STOPPED', foundAddresses.length, foundAddresses.slice(0, 10).map(f => 
            `📍 [${f.index}] = ${f.value.toFixed(2)}`
        ));
    }

    // ---------- TOGGLE ----------
    function toggleMonitoring() {
        if (isMonitoring) {
            stopMonitoring();
        } else {
            foundAddresses = []; // Clear previous results
            startMonitoring();
        }
    }

    // ---------- MANUAL TEST ----------
    function testSpeedValue(index, value) {
        const unity = getUnity();
        if (!unity || !unity.Module) {
            console.error('[Debug] ❌ Unity not found!');
            return;
        }

        const heap = unity.Module.HEAPF32;
        const original = heap[index];
        heap[index] = value;
        console.log(`[Debug] 🧪 Test: heap[${index}] = ${value} (was ${original})`);
        console.log('[Debug] 💡 Did your kart speed up? If yes, this is the speed address!');

        // Revert after 3 seconds
        setTimeout(() => {
            heap[index] = original;
            console.log(`[Debug] 🔄 Reverted heap[${index}] to ${original}`);
        }, 3000);
    }

    // ---------- EXPORT TO CONSOLE ----------
    window.SpeedDebug = {
        start: startMonitoring,
        stop: stopMonitoring,
        toggle: toggleMonitoring,
        test: testSpeedValue,
        getAddresses: () => foundAddresses,
        getUnity: getUnity,
        scan: scanMemory,
        // Quick test: try the first found address
        tryFirst: function() {
            if (foundAddresses.length === 0) {
                console.log('[Debug] ❌ No addresses found yet. Run monitoring first!');
                return;
            }
            const first = foundAddresses[0];
            console.log(`[Debug] 🧪 Testing address [${first.index}] = ${first.value}`);
            testSpeedValue(first.index, 20);
        }
    };

    // ---------- KEYBOARD ----------
    document.addEventListener('keydown', function(e) {
        if (e.key === 'g' || e.key === 'G') {
            e.preventDefault();
            toggleMonitoring();
        }
        if (e.key === 't' || e.key === 'T') {
            e.preventDefault();
            window.SpeedDebug.tryFirst();
        }
    });

    // ---------- INIT ----------
    createUI();
    console.log('[Debug] ✅ Debugger ready!');
    console.log('[Debug] 📌 Controls:');
    console.log('[Debug]   G - Start/Stop monitoring');
    console.log('[Debug]   T - Test the first found address');
    console.log('[Debug] 💡 Commands in console:');
    console.log('[Debug]   SpeedDebug.start() - Start monitoring');
    console.log('[Debug]   SpeedDebug.stop() - Stop monitoring');
    console.log('[Debug]   SpeedDebug.tryFirst() - Test the first address');
    console.log('[Debug]   SpeedDebug.getAddresses() - Show all found addresses');
    console.log('[Debug]   SpeedDebug.test(index, value) - Test a specific address');

    // Auto-start after 3 seconds
    setTimeout(() => {
        if (getUnity()) {
            console.log('[Debug] 🚀 Unity detected! Starting monitoring...');
            startMonitoring();
        } else {
            console.log('[Debug] ⏳ Waiting for Unity...');
        }
    }, 3000);

})();
