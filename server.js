const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const sanitizeHtml = require('sanitize-html');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public'));

// Database
const db = new sqlite3.Database('./users.db');
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        verified INTEGER DEFAULT 0,
        verificationCode TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT,
        username TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Email setup (replace with your Gmail credentials or SendGrid)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'yourgmail@gmail.com',
        pass: 'yourapppassword'
    }
});

// Register
app.post('/register', async (req,res)=>{
    const { username, email, password } = req.body;
    const hashed = await bcrypt.hash(password,10);
    const code = crypto.randomBytes(16).toString('hex');

    db.run(`INSERT INTO users (username,email,password,verificationCode) VALUES (?,?,?,?)`,
        [username,email,hashed,code], function(err){
            if(err) return res.json({success:false,msg:err.message});
            const mailOptions = {
                from:'yourgmail@gmail.com',
                to: email,
                subject: 'Verify your account',
                text: `Click to verify: http://localhost:3000/verify?code=${code}`
            };
            transporter.sendMail(mailOptions,(error,info)=>{
                if(error) return res.json({success:false,msg:error.message});
                return res.json({success:true,msg:'Registered! Check your email to verify.'});
            });
        });
});

// Verify
app.get('/verify', (req,res)=>{
    const code = req.query.code;
    db.run(`UPDATE users SET verified=1 WHERE verificationCode=?`, [code], function(err){
        if(err) return res.send("Verification failed");
        res.send("Account verified! You can now log in.");
    });
});

// Login
app.post('/login', (req,res)=>{
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username=?`, [username], async (err,row)=>{
        if(err || !row) return res.json({success:false,msg:'Wrong credentials'});
        if(row.verified===0) return res.json({success:false,msg:'Verify your email first'});
        const match = await bcrypt.compare(password,row.password);
        if(!match) return res.json({success:false,msg:'Wrong credentials'});
        res.json({success:true,username:row.username});
    });
});

// Announcements
app.get('/announcements', (req,res)=>{
    db.all(`SELECT * FROM announcements ORDER BY timestamp DESC LIMIT 10`, [], (err,rows)=>{
        if(err) return res.json([]);
        res.json(rows);
    });
});

app.post('/announcement', (req,res)=>{
    const username = sanitizeHtml(req.body.username);
    const message = sanitizeHtml(req.body.message);
    db.run(`INSERT INTO announcements (message,username) VALUES (?,?)`, [message,username], function(err){
        if(err) return res.json({success:false});
        io.emit('newAnnouncement',{username,message});
        res.json({success:true});
    });
});

// Multiplayer players
let players = {};

io.on('connection', socket=>{
    socket.on('join', username=>{
        players[socket.id]={username,x:Math.random()*400,y:Math.random()*400};
        io.emit('players',players);
    });

    socket.on('move', data=>{
        if(players[socket.id]){
            players[socket.id].x=data.x;
            players[socket.id].y=data.y;
            io.emit('players',players);
        }
    });

    socket.on('disconnect', ()=>{
        delete players[socket.id];
        io.emit('players',players);
    });
});

server.listen(3000,()=>console.log('Server running on http://localhost:3000'));
