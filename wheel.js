class SpinWheel {
    constructor() {
        this.canvas = document.getElementById('wheelCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.movies = [];
        this.spinning = false;
        this.rotation = 0;
        this.targetRotation = 0;
        this.previousRotation = 0;
        this.rotationVelocity = 0;

        this.pendingWinnerIndex = null;

        // Default colors
        this.defaultColors = {
            sliceColor1: '#c44800',
            sliceColor2: '#e28c14',
            sliceColor3: '#e4720a',
            primaryAccent: '#c44800',
            secondaryAccent: '#e28c14',
            highlightColor: '#f3a61d',
            bgColor: '#000000'
        };

        // Load saved colors or use defaults
        this.customColors = this.loadColors();
        this.colors = [this.customColors.sliceColor1, this.customColors.sliceColor2, this.customColors.sliceColor3];
        
        // Apply colors to CSS variables and elements
        this.applyColors();
        
        // Click sound properties
        this.numDots = 24;
        this.lastDotIndex = -1;
        this.lastClickTime = 0;
        this.minClickInterval = 50; // Minimum milliseconds between clicks
        this.clickDuration = 0.01; // Duration of each click in seconds (0.05 = 50ms)
        this.clickFrequency = 700; // Pitch of the click sound in Hz
        this.clickSound = this.createClickSound();

        this.loadMovies();
        this.initEventListeners();
        this.initColorSettings();
        this.draw();
        this.animate();
    }

    // Create a click sound using Web Audio API
    createClickSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContext();
            
            return () => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                // Short, sharp click sound
                oscillator.frequency.value = this.clickFrequency;
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + this.clickDuration);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + this.clickDuration);
            };
        } catch (e) {
            console.warn('Web Audio API not supported, click sounds disabled');
            return () => {}; // No-op function
        }
    }

    playClickIfNeeded() {
        if (!this.spinning) return;
        
        // Throttle clicks to prevent distortion at high speeds
        const now = Date.now();
        if (now - this.lastClickTime < this.minClickInterval) {
            return;
        }
        
        // Calculate which dot is currently at the top (where the pointer is)
        // The pointer is at angle -Math.PI/2 (top of wheel)
        // Normalize rotation to 0-2π range
        const normalizedRotation = ((this.rotation % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        
        // Calculate which dot is closest to the top
        const dotAngle = (2 * Math.PI) / this.numDots;
        const currentDotIndex = Math.floor((normalizedRotation + dotAngle / 2) / dotAngle) % this.numDots;
        
        // Play click when we cross to a new dot
        if (currentDotIndex !== this.lastDotIndex) {
            this.clickSound();
            this.lastDotIndex = currentDotIndex;
            this.lastClickTime = now;
        }
    }

    // ----- Secure randomness? -----
    secureRandomInt(n) {
        if (n <= 0) return 0;
        const co = (typeof window !== 'undefined') && window.crypto && window.crypto.getRandomValues ? window.crypto : null;
        if (!co) return Math.floor(Math.random() * n);
        const max = 0xFFFFFFFF;
        const limit = Math.floor((max + 1) / n) * n - 1;
        const buf = new Uint32Array(1);
        do { co.getRandomValues(buf); } while (buf[0] > limit);
        return buf[0] % n;
    }
    secureRandomFloat() {
        const co = (typeof window !== 'undefined') && window.crypto && window.crypto.getRandomValues ? window.crypto : null;
        if (!co) return Math.random();
        const x = new Uint32Array(1);
        co.getRandomValues(x);
        return x[0] / 0x100000000;
    }

    initEventListeners() {
        document.getElementById('addMovieBtn').addEventListener('click', () => this.addMovie());
        document.getElementById('movieInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') this.addMovie(); });
        document.getElementById('spinBtn').addEventListener('click', () => this.spin());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearAll());
    }

    // ----- Color Management -----
    loadColors() {
        const saved = localStorage.getItem('wheelColors');
        if (saved) {
            return { ...this.defaultColors, ...JSON.parse(saved) };
        }
        return { ...this.defaultColors };
    }

    saveColors() {
        localStorage.setItem('wheelColors', JSON.stringify(this.customColors));
    }

    applyColors() {
        const root = document.documentElement;
        
        // Set CSS variables for dynamic styling
        root.style.setProperty('--primary-accent', this.customColors.primaryAccent);
        root.style.setProperty('--secondary-accent', this.customColors.secondaryAccent);
        root.style.setProperty('--highlight-color', this.customColors.highlightColor);
        root.style.setProperty('--bg-color', this.customColors.bgColor);
        root.style.setProperty('--slice-color-1', this.customColors.sliceColor1);
        root.style.setProperty('--slice-color-2', this.customColors.sliceColor2);
        root.style.setProperty('--slice-color-3', this.customColors.sliceColor3);

        // Update wheel slice colors array
        this.colors = [this.customColors.sliceColor1, this.customColors.sliceColor2, this.customColors.sliceColor3];

        // Apply to body background
        document.body.style.backgroundColor = this.customColors.bgColor;

        // Apply primary accent color to elements
        const primaryElements = [
            '.main-content',
            '.color-settings-toggle',
            '.color-settings-panel',
            '.movie-item button',
            '.add-movie input',
            '.spin-button',
            '.result',
            '.movie-list::-webkit-scrollbar-thumb'
        ];
        
        // Title and highlight elements
        document.querySelectorAll('.title, .left-panel h2').forEach(el => {
            el.style.color = this.customColors.highlightColor;
        });

        // Main content border
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.borderColor = this.customColors.primaryAccent;
        }

        // Body text color
        document.body.style.color = this.customColors.primaryAccent;

        // Input styling
        const addInput = document.querySelector('.add-movie input');
        if (addInput) {
            addInput.style.borderColor = this.customColors.secondaryAccent;
            addInput.style.color = this.customColors.secondaryAccent;
        }

        // Add button
        const addBtn = document.getElementById('addMovieBtn');
        if (addBtn) {
            addBtn.style.backgroundColor = this.customColors.secondaryAccent;
        }

        // Spin button
        const spinBtn = document.getElementById('spinBtn');
        if (spinBtn) {
            spinBtn.style.backgroundColor = this.customColors.primaryAccent;
        }

        // Clear button
        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            clearBtn.style.backgroundColor = this.customColors.highlightColor;
        }

        // Result box
        const result = document.getElementById('result');
        if (result) {
            result.style.color = this.customColors.primaryAccent;
            result.style.borderColor = this.customColors.primaryAccent;
        }

        // Update movie list colors
        this.updateMovieList();
        
        // Redraw the wheel
        this.draw();
    }

    initColorSettings() {
        const toggle = document.getElementById('colorSettingsToggle');
        const panel = document.getElementById('colorSettingsPanel');
        const arrow = document.getElementById('toggleArrow');
        const resetBtn = document.getElementById('resetColorsBtn');

        // Toggle panel
        toggle?.addEventListener('click', () => {
            panel.classList.toggle('open');
            arrow.classList.toggle('open');
        });

        // Reset colors
        resetBtn?.addEventListener('click', () => {
            if (confirm('Reset all colors to defaults?')) {
                this.customColors = { ...this.defaultColors };
                this.saveColors();
                this.applyColors();
                this.updateColorInputs();
            }
        });

        // Initialize color inputs
        this.updateColorInputs();

        // Add event listeners to all color inputs
        Object.keys(this.defaultColors).forEach(colorKey => {
            const colorPicker = document.getElementById(colorKey);
            const hexInput = document.getElementById(colorKey + 'Hex');
            const rgbInput = document.getElementById(colorKey + 'Rgb');

            // Color picker change
            colorPicker?.addEventListener('input', (e) => {
                this.updateColor(colorKey, e.target.value);
                if (hexInput) hexInput.value = e.target.value;
                if (rgbInput) rgbInput.value = this.hexToRgb(e.target.value);
            });

            // Hex input change
            hexInput?.addEventListener('change', (e) => {
                const hex = this.normalizeHex(e.target.value);
                if (hex) {
                    this.updateColor(colorKey, hex);
                    if (colorPicker) colorPicker.value = hex;
                    if (rgbInput) rgbInput.value = this.hexToRgb(hex);
                    e.target.value = hex;
                }
            });

            // RGB input change
            rgbInput?.addEventListener('change', (e) => {
                const hex = this.rgbToHex(e.target.value);
                if (hex) {
                    this.updateColor(colorKey, hex);
                    if (colorPicker) colorPicker.value = hex;
                    if (hexInput) hexInput.value = hex;
                }
            });
        });
    }

    updateColorInputs() {
        Object.keys(this.customColors).forEach(colorKey => {
            const colorPicker = document.getElementById(colorKey);
            const hexInput = document.getElementById(colorKey + 'Hex');
            const rgbInput = document.getElementById(colorKey + 'Rgb');
            const color = this.customColors[colorKey];

            if (colorPicker) colorPicker.value = color;
            if (hexInput) hexInput.value = color;
            if (rgbInput) rgbInput.value = this.hexToRgb(color);
        });
    }

    updateColor(colorKey, value) {
        this.customColors[colorKey] = value;
        this.saveColors();
        this.applyColors();
    }

    // Color conversion utilities
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `rgb(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)})`;
        }
        return '';
    }

    rgbToHex(rgb) {
        const match = rgb.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
        if (match) {
            const r = parseInt(match[1]).toString(16).padStart(2, '0');
            const g = parseInt(match[2]).toString(16).padStart(2, '0');
            const b = parseInt(match[3]).toString(16).padStart(2, '0');
            return `#${r}${g}${b}`;
        }
        return null;
    }

    normalizeHex(input) {
        let hex = input.trim();
        if (!hex.startsWith('#')) hex = '#' + hex;
        if (/^#[a-f\d]{3}$/i.test(hex)) {
            // Expand shorthand (e.g., #abc -> #aabbcc)
            hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        if (/^#[a-f\d]{6}$/i.test(hex)) {
            return hex.toLowerCase();
        }
        return null;
    }

    saveMovies() { localStorage.setItem('halloweenMovies', JSON.stringify(this.movies)); }
    loadMovies() {
        const saved = localStorage.getItem('halloweenMovies');
        if (saved) {
            this.movies = JSON.parse(saved);
        } else {
            this.movies = ['Peewees Christmas 1988','The Santa Claus','Die Hard','The Grinch','Planes, Trains, and Automobiles'];
            this.saveMovies();
        }
        this.updateMovieList();
    }

    addMovie() {
        const input = document.getElementById('movieInput');
        const name = input.value.trim().toUpperCase();
        if (!name) return;
        this.movies.push(name);
        this.saveMovies();
        this.updateMovieList();
        input.value = '';
        this.draw();
    }

    removeMovie(i) {
        this.movies.splice(i, 1);
        this.saveMovies();
        this.updateMovieList();
        this.draw();
    }

    clearAll() {
        if (!confirm('Are you sure you want to clear all movies?')) return;
        this.movies = [];
        this.saveMovies();
        this.updateMovieList();
        this.draw();
        document.getElementById('result').textContent = '';
    }

    updateMovieList() {
        const el = document.getElementById('movieList');
        el.innerHTML = '';
        this.movies.forEach((m, i) => {
            const div = document.createElement('div');
            div.className = 'movie-item';
            div.style.background = i % 2 === 0 ? this.customColors.sliceColor1 : this.customColors.sliceColor2;
            div.innerHTML = `<span>${m}</span><button onclick="wheel.removeMovie(${i})">Remove</button>`;
            el.appendChild(div);
        });
    }

    draw() {
        const ctx = this.ctx;
        const c = this.canvas;
        const cx = c.width / 2;
        const cy = c.height / 2;
        const border = 25;
        const radius = Math.min(cx, cy) - border - 45;

        ctx.clearRect(0, 0, c.width, c.height);

        if (this.movies.length === 0) {
            ctx.save();
            ctx.font = 'bold 24px Georgia';
            ctx.fillStyle = this.customColors.primaryAccent;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Add movies to spin!', cx, cy);
            ctx.restore();
            return;
        }

        const slice = (2 * Math.PI) / this.movies.length;

        this.movies.forEach((movie, i) => {
            const start = this.rotation + i * slice - Math.PI / 2;
            const end = start + slice;

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, start, end);
            ctx.closePath();
            ctx.fillStyle = this.colors[i % this.colors.length];
            ctx.fill();

            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(start + slice / 2);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Calculate font size and handle long text
            const maxTextRadius = radius * 0.55; // More padding from the edge
            let fontSize = Math.min(20, radius / (movie.length * 0.6));
            ctx.font = `bold ${fontSize}px Georgia`;
            
            // Check if text is too long and needs to wrap
            const textWidth = ctx.measureText(movie).width;
            const maxWidth = maxTextRadius * 1.5; // Maximum width before wrapping
            
            if (textWidth > maxWidth && movie.length > 15) {
                // Split into two lines for long text
                const words = movie.split(' ');
                let line1 = '';
                let line2 = '';
                
                // Simple split: try to split roughly in the middle
                const midPoint = Math.ceil(words.length / 2);
                line1 = words.slice(0, midPoint).join(' ');
                line2 = words.slice(midPoint).join(' ');
                
                // If no spaces, split by character count
                if (words.length === 1) {
                    const mid = Math.ceil(movie.length / 2);
                    line1 = movie.substring(0, mid);
                    line2 = movie.substring(mid);
                }
                
                // Adjust font size if still too wide
                const line1Width = ctx.measureText(line1).width;
                const line2Width = ctx.measureText(line2).width;
                const maxLineWidth = Math.max(line1Width, line2Width);
                if (maxLineWidth > maxWidth) {
                    fontSize = fontSize * (maxWidth / maxLineWidth);
                    ctx.font = `bold ${fontSize}px Georgia`;
                }
                
                ctx.fillStyle = '#000';
                ctx.shadowColor = 'rgba(255,255,255,0.5)';
                ctx.shadowBlur = 2;
                ctx.fillText(line1, maxTextRadius, -fontSize * 0.6);
                ctx.fillText(line2, maxTextRadius, fontSize * 0.6);
            } else {
                // Single line text
                ctx.fillStyle = '#000';
                ctx.shadowColor = 'rgba(255,255,255,0.5)';
                ctx.shadowBlur = 2;
                ctx.fillText(movie, maxTextRadius, 0);
            }
            ctx.restore();
        });

        // Thick black border
        ctx.beginPath();
        ctx.arc(cx, cy, radius + border / 2, 0, 2 * Math.PI);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = border;
        ctx.stroke();

        // Orange dots
        const numDots = this.numDots;
        for (let i = 0; i < numDots; i++) {
            const a = (i / numDots) * 2 * Math.PI + this.rotation; // Add rotation so dots spin with wheel
            const dx = cx + (radius + border / 2) * Math.cos(a);
            const dy = cy + (radius + border / 2) * Math.sin(a);
            ctx.beginPath();
            ctx.arc(dx, dy, 4, 0, 2 * Math.PI);
            ctx.fillStyle = this.customColors.primaryAccent;
            ctx.fill();
        }

        // Thin outer border
        ctx.beginPath();
        ctx.arc(cx, cy, radius + border, 0, 2 * Math.PI);
        ctx.strokeStyle = this.customColors.secondaryAccent;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Center hub
        ctx.beginPath();
        ctx.arc(cx, cy, 25, 0, 2 * Math.PI);
        ctx.fillStyle = '#000';
        ctx.fill();

        // Pointer
        ctx.save();
        ctx.translate(cx, cy);
        ctx.beginPath();
        ctx.moveTo(0, -radius - 10);
        ctx.lineTo(-20, -radius - 40);
        ctx.lineTo(20, -radius - 40);
        ctx.closePath();
        ctx.fillStyle = this.customColors.sliceColor3;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    // Spinner logic
    spin() {
        if (this.spinning || this.movies.length === 0) return;

        this.spinning = true;
        this.lastDotIndex = -1; // Reset dot tracking
        document.getElementById('spinBtn').disabled = true;
        document.getElementById('result').textContent = '';

        const n = this.movies.length;
        const sliceAngle = (2 * Math.PI) / n;

        // Winner first
        const winnerIndex = this.secureRandomInt(n);
        this.pendingWinnerIndex = winnerIndex;

        // Wheel spins
        const fullSpins = (7 + this.secureRandomInt(4)) * 2;

        // Land safely within the winning slice with slight crypto jitter
        const margin = 0.15 * sliceAngle; // keep away from edges
        const jitterSpan = sliceAngle - 2 * margin;
        const jitter = (this.secureRandomFloat() * jitterSpan) - (jitterSpan / 2);

        const centerA = (2 * Math.PI) - (winnerIndex + 0.5) * sliceAngle;
        let aFinal = centerA + jitter;
        const leftEdge = (2 * Math.PI) - (winnerIndex + 1) * sliceAngle + margin;
        const rightEdge = (2 * Math.PI) - (winnerIndex) * sliceAngle - margin;
        if (aFinal < leftEdge) aFinal = leftEdge;
        if (aFinal > rightEdge) aFinal = rightEdge;

        const current = this.rotation;
        const twopi = 2 * Math.PI;

        let k = Math.ceil((current - aFinal + fullSpins * twopi) / twopi);
        if (!Number.isFinite(k)) k = fullSpins;

        this.startRotation = current;
        this.targetRotation = aFinal + k * twopi;

        // >>> Longer total duration: 10s (~2x)
        this.spinStartTime = Date.now();
        this.spinDuration = 10000; // ms

        // Easing
        this.accelFraction = 0.20; // ~2s accel
    }

    animate() {
        if (this.spinning) {
            const elapsed = Date.now() - this.spinStartTime;
            const progress = Math.min(elapsed / this.spinDuration, 1);

            // Ease-in (quad) for first 10%, then a long ease-out (cubic) for 90%
            const a = this.accelFraction ?? 0.10;
            let easeProgress;
            if (progress < a) {
                const t = progress / a; // 0..1
                easeProgress = (t * t) * a;
            } else {
                const t = (progress - a) / (1 - a); // 0..1
                easeProgress = a + (1 - Math.pow(1 - t, 3)) * (1 - a);
            }

            this.rotation = this.startRotation + (this.targetRotation - this.startRotation) * easeProgress;

            // Check for dot clicks during spin
            this.playClickIfNeeded();

            if (progress >= 1) {
                this.rotation = this.targetRotation;
                this.spinning = false;
                document.getElementById('spinBtn').disabled = false;
                this.showResult();
            }

            this.draw();
        }

        requestAnimationFrame(() => this.animate());
    }

    showResult() {
        if (this.pendingWinnerIndex == null || this.movies.length === 0) {
            document.getElementById('result').textContent = '';
            return;
        }
        const winner = this.movies[this.pendingWinnerIndex];
        document.getElementById('result').textContent = `🎃 ${winner} 🎃`;
        this.pendingWinnerIndex = null;
        this.celebrate();
    }

    celebrate() {
        const result = document.getElementById('result');
        result.style.animation = 'none';
        setTimeout(() => { result.style.animation = 'pulse 0.5s ease-in-out 3'; }, 10);
    }
}

// Pulse anim style
const style = document.createElement('style');
style.textContent = `
@keyframes pulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.1);} }
`;
document.head.appendChild(style);

let wheel;
window.addEventListener('DOMContentLoaded', () => { wheel = new SpinWheel(); });

