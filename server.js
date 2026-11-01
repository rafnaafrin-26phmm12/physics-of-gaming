const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(___dirname));

// ==========================================
// 5.0 DATABASE INITIALIZATION (MongoDB)
// ==========================================
// Connects to local MongoDB installation. Change string if using MongoDB Atlas cloud.
mongoose.connect('mongodb://localhost:27017/billiardsSimulation')
  .then(() => console.log("MongoDB pipeline layer successfully mounted."))
  .catch(err => console.error("Database connection failure: ", err));

// MongoDB Document Schema Definition Structure
const SimulationLogSchema = new mongoose.Schema({
    launchAngle: { type: Number, required: true },
    initialVelocity: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }
});

const SimulationLog = mongoose.model('SimulationLog', SimulationLogSchema);

// ==========================================
// 4.2.3 MATRIX MATHEMATICS & RESOLUTION ENGINE
// ==========================================
app.post('/api/collision/resolve', (req, res) => {
    let { b1, b2 } = req.body;

    let dx = b2.x - b1.x;
    let dy = b2.y - b1.y;
    let distance = Math.sqrt(dx*dx + dy*dy);
    
    if (distance === 0) return res.json({ success: false, msg: "Zero distance division guard." });
    
    let nx = dx / distance;
    let ny = dy / distance;
    let tx = -ny;
    let ty = nx;

    let v1n = nx * b1.vx + ny * b1.vy;
    let v1t = tx * b1.vx + ty * b1.vy;
    let v2n = nx * b2.vx + ny * b2.vy;
    let v2t = tx * b2.vx + ty * b2.vy;

    let v1nPrime = v2n;
    let v2nPrime = v1n;

    b1.vx = v1nPrime * nx + v1t * tx;
    b1.vy = v1nPrime * ny + v1t * ty;
    b2.vx = v2nPrime * nx + v2t * tx;
    b2.vy = v2nPrime * ny + v2t * ty;

    let initialKE = 0.5 * b1.mass * (v1n**2 + v1t**2) + 0.5 * b2.mass * (v2n**2 + v2t**2);
    let finalKE = 0.5 * b1.mass * (b1.vx**2 + b1.vy**2) + 0.5 * b2.mass * (b2.vx**2 + b2.vy**2);
    
    if (Math.abs(finalKE - initialKE) > 0.01) {
         return res.json({ success: false, msg: "Anomalous operation caught: Energy Conservation Breached." });
    }

    res.json({ success: true, b1, b2 });
});

// ==========================================
// DATA PIPELINE PERSISTENCE LOGGING ROUTERS
// ==========================================
app.post('/api/simulation/log', async (req, res) => {
    const { angle, velocity } = req.body;
    
    if(angle < 0 || angle > 360 || velocity < 10 || velocity > 500) {
        return res.status(400).json({ error: "Invalid vector configurations." });
    }

    try {
        const newLog = new SimulationLog({ launchAngle: angle, initialVelocity: velocity });
        await newLog.save();
        res.json({ success: true, logID: newLog._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/simulation/history', async (req, res) => {
    try {
        const logs = await SimulationLog.find().sort({ timestamp: -1 });
        // Format document response attributes so dashboard.html layout keeps working flawlessly
        const formattedLogs = logs.map((log, idx) => ({
            ShotID: idx + 1,
            LaunchAngle: log.launchAngle,
            InitialVelocity: log.initialVelocity,
            Timestamp: log.timestamp.toISOString().replace('T', ' ').substring(0, 19)
        }));
        res.json(formattedLogs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server executing at http://localhost:${PORT}`);
});

