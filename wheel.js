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

        this.colors = ['#c44800', '#e28c14', '#e4720a'];

        this.loadMovies();
        this.initEventListeners();
        this.draw();
        this.animate();
    }

    // ----- Secure randomness -----
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

    saveMovies() { localStorage.setItem('halloweenMovies', JSON.stringify(this.movies)); }
    loadMovies() {
        const saved = localStorage.getItem('halloweenMovies');
        if (saved) {
            this.movies = JSON.parse(saved);
        } else {
            this.movies = ['The Worst Witch','Winnie the Pooh Blood and Honey 2','Shaun of the Dead','Zombie Land','Scary Movie 1','Vampires suck','Zombeavers','Slotherhouse'];
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
            div.style.background = i % 2 === 0 ? '#c44800' : '#e28c14';
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
            ctx.fillStyle = '#c44800';
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
            const fontSize = Math.min(20, radius / (movie.length * 0.6));
            ctx.font = `bold ${fontSize}px Georgia`;
            ctx.fillStyle = '#000';
            ctx.shadowColor = 'rgba(255,255,255,0.5)';
            ctx.shadowBlur = 2;
            ctx.fillText(movie, radius * 0.65, 0);
            ctx.restore();
        });

        // Thick black border
        ctx.beginPath();
        ctx.arc(cx, cy, radius + border / 2, 0, 2 * Math.PI);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = border;
        ctx.stroke();

        // Orange dots with motion blur
        const numDots = 24;
        const blurTrails = this.spinning ? 8 : 0; // Number of blur trail copies when spinning
        
        for (let i = 0; i < numDots; i++) {
            const baseAngle = (i / numDots) * 2 * Math.PI;
            
            // Draw motion blur trails
            if (blurTrails > 0) {
                for (let t = blurTrails; t > 0; t--) {
                    const trailRotation = this.rotation - (this.rotationVelocity * t * 0.15);
                    const a = baseAngle + trailRotation;
                    const dx = cx + (radius + border / 2) * Math.cos(a);
                    const dy = cy + (radius + border / 2) * Math.sin(a);
                    
                    ctx.beginPath();
                    ctx.arc(dx, dy, 4, 0, 2 * Math.PI);
                    const opacity = 1.0 * (1 - t / blurTrails); // More visible fading trail
                    ctx.fillStyle = `rgba(196, 72, 0, ${opacity})`;
                    ctx.fill();
                }
            }
            
            // Draw main dot
            const a = baseAngle + this.rotation;
            const dx = cx + (radius + border / 2) * Math.cos(a);
            const dy = cy + (radius + border / 2) * Math.sin(a);
            ctx.beginPath();
            ctx.arc(dx, dy, 4, 0, 2 * Math.PI);
            ctx.fillStyle = '#c44800';
            ctx.fill();
        }

        // Thin outer border
        ctx.beginPath();
        ctx.arc(cx, cy, radius + border, 0, 2 * Math.PI);
        ctx.strokeStyle = '#e28c14';
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
        ctx.fillStyle = '#e4720a';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    // ----- Unbiased spin with longer duration & longer slowdown -----
    spin() {
        if (this.spinning || this.movies.length === 0) return;

        this.spinning = true;
        document.getElementById('spinBtn').disabled = true;
        document.getElementById('result').textContent = '';

        const n = this.movies.length;
        const sliceAngle = (2 * Math.PI) / n;

        // Winner first (fair)
        const winnerIndex = this.secureRandomInt(n);
        this.pendingWinnerIndex = winnerIndex;

        // Double the drama: twice the full revolutions (14..20)
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

        // Store easing split so it's easy to tweak
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

            // Track previous rotation for velocity calculation
            this.previousRotation = this.rotation;
            this.rotation = this.startRotation + (this.targetRotation - this.startRotation) * easeProgress;
            
            // Calculate rotation velocity for motion blur
            this.rotationVelocity = this.rotation - this.previousRotation;

            if (progress >= 1) {
                this.rotation = this.targetRotation;
                this.spinning = false;
                this.rotationVelocity = 0;
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

