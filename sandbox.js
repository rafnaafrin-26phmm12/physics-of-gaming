const canvas = document.getElementById('billiardsCanvas');
const ctx = canvas.getContext('2d');

// Simulation Properties
const friction = 0.99; // Kinetic friction dissipation coefficient
let animationFrameId;

// Physics Object Class
class Ball {
    constructor(x, y, radius, color, mass) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.mass = mass;
        this.vx = 0;
        this.vy = 0;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }

    update() {
        // Apply velocity vectors
        this.x += this.vx * 0.016; // Normalized to ~60fps step
        this.y += this.vy * 0.016;

        // Apply friction
        this.vx *= friction;
        this.vy *= friction;

        // Stop if movement is infinitesimal
        if (Math.abs(this.vx) < 0.1) this.vx = 0;
        if (Math.abs(this.vy) < 0.1) this.vy = 0;

        // Boundary Wall Collisions (Elastic reflection)
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.vx *= -1;
        } else if (this.x + this.radius > canvas.width) {
            this.x = canvas.width - this.radius;
            this.vx *= -1;
        }

        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.vy *= -1;
        } else if (this.y + this.radius > canvas.height) {
            this.y = canvas.height - this.radius;
            this.vy *= -1;
        }
    }
}

// Instantiate Balls
const cueBall = new Ball(150, 200, 15, '#ffffff', 1);
const targetBall = new Ball(550, 200, 15, '#cc2020', 1);

function checkBallCollision(b1, b2) {
    let dx = b2.x - b1.x;
    let dy = b2.y - b1.y;
    let distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < b1.radius + b2.radius) {
        // Send collision state to Module 2 Server Engine for matrix resolution
        fetch('/api/collision/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                b1: { x: b1.x, y: b1.y, vx: b1.vx, vy: b1.vy, mass: b1.mass },
                b2: { x: b2.x, y: b2.y, vx: b2.vx, vy: b2.vy, mass: b2.mass }
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Update physics states with server verified vectors
                b1.vx = data.b1.vx; b1.vy = data.b1.vy;
                b2.vx = data.b2.vx; b2.vy = data.b2.vy;
                
                // Displace overlap to prevent locking
                let overlap = (b1.radius + b2.radius) - distance;
                let nx = dx / distance;
                let ny = dy / distance;
                b1.x -= nx * overlap / 2; b1.y -= ny * overlap / 2;
                b2.x += nx * overlap / 2; b2.y += ny * overlap / 2;
            }
        });
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update Objects
    cueBall.update();
    targetBall.update();
    checkBallCollision(cueBall, targetBall);

    // Render Canvas Layers
    cueBall.draw();
    targetBall.draw();

    // Update Live Telemetry Dom
    document.getElementById('telX').innerText = cueBall.x.toFixed(2);
    document.getElementById('telY').innerText = cueBall.y.toFixed(2);
    document.getElementById('telTargetX').innerText = targetBall.x.toFixed(2);
    document.getElementById('telTargetY').innerText = targetBall.y.toFixed(2);
    
    let systemKE = 0.5 * cueBall.mass * (cueBall.vx**2 + cueBall.vy**2) + 0.5 * targetBall.mass * (targetBall.vx**2 + targetBall.vy**2);
    document.getElementById('telKE').innerText = systemKE.toFixed(2);

    animationFrameId = requestAnimationFrame(gameLoop);
}

// User Actions & Vector Inputs Validation
document.getElementById('launchBtn').addEventListener('click', () => {
    const angleInput = document.getElementById('launchAngle').value;
    const velocityInput = document.getElementById('initialVelocity').value;

    // Client side bounds validation
    if (angleInput < 0 || angleInput > 360) {
        document.getElementById('angleError').innerText = "Out of spatial range (0-360).";
        return;
    }
    if (velocityInput < 10 || velocityInput > 500) {
        document.getElementById('velocityError').innerText = "Velocity thresholds exceeded.";
        return;
    }

    document.getElementById('angleError').innerText = "";
    document.getElementById('velocityError').innerText = "";

    // Math Transformation: Degrees to Radians
    let rad = angleInput * Math.PI / 128;
    cueBall.vx = velocityInput * Math.cos(rad);
    cueBall.vy = velocityInput * Math.sin(rad);

    // Persist launch metadata to Database Pipeline via server endpoint
    fetch('/api/simulation/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ angle: angleInput, velocity: velocityInput })
    });
});

document.getElementById('resetBtn').addEventListener('click', () => {
    cancelAnimationFrame(animationFrameId);
    cueBall.x = 150; cueBall.y = 200; cueBall.vx = 0; cueBall.vy = 0;
    targetBall.x = 550; targetBall.y = 200; targetBall.vx = 0; targetBall.vy = 0;
    gameLoop();
}
// Run Application Execution Lifecycle
gameLoop();
