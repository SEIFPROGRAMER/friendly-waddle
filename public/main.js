const socket = io();
let currentUser=null;
let players={};

function login(){
    const username=document.getElementById('username').value;
    const password=document.getElementById('password').value;
    fetch('/login',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({username,password})
    }).then(res=>res.json()).then(data=>{
        if(data.success){
            currentUser = data.username;
            document.getElementById('auth').style.display='none';
            document.getElementById('game').style.display='block';
            document.getElementById('userDisplay').innerText=currentUser;
            loadAnnouncements();
            joinGame();
        }else alert(data.msg);
    });
}

function register(){
    const username=document.getElementById('rusername').value;
    const email=document.getElementById('remail').value;
    const password=document.getElementById('rpassword').value;
    fetch('/register',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({username,email,password})
    }).then(res=>res.json()).then(data=>{
        alert(data.msg);
    });
}

function sendAnnouncement(){
    const message=document.getElementById('announcement').value;
    fetch('/announcement',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({username:currentUser,message})
    }).then(res=>res.json()).then(data=>{
        if(data.success){document.getElementById('announcement').value='';loadAnnouncements();}
    });
}

function loadAnnouncements(){
    fetch('/announcements').then(res=>res.json()).then(data=>{
        const div=document.getElementById('announcements');
        div.innerHTML='';
        data.forEach(a=>{
            const p=document.createElement('p');
            p.innerHTML=`<span style="color:red">${a.username}</span><span style="color:black"> :: </span><span style="color:blue">${a.message}</span>`;
            div.appendChild(p);
        });
    });
}

socket.on('newAnnouncement', a=>{
    const div=document.getElementById('announcements');
    const p=document.createElement('p');
    p.innerHTML=`<span style="color:red">${a.username}</span><span style="color:black"> :: </span><span style="color:blue">${a.message}</span>`;
    div.prepend(p);
});

// Multiplayer game
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
const keys={};

function joinGame(){
    socket.emit('join',currentUser);
}

document.addEventListener('keydown', e=>keys[e.key]=true);
document.addEventListener('keyup', e=>keys[e.key]=false);

function gameLoop(){
    if(players[socket.id]){
        let p = players[socket.id];
        if(keys['ArrowUp']) p.y-=2;
        if(keys['ArrowDown']) p.y+=2;
        if(keys['ArrowLeft']) p.x-=2;
        if(keys['ArrowRight']) p.x+=2;
        socket.emit('move',{x:p.x,y:p.y});
    }

    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(let id in players){
        let pl=players[id];
        ctx.fillStyle='green';
        ctx.fillRect(pl.x,pl.y,20,20);
        ctx.fillStyle='black';
        ctx.fillText(pl.username,pl.x,pl.y-5);
    }

    requestAnimationFrame(gameLoop);
}

socket.on('players',data=>{players=data;});
requestAnimationFrame(gameLoop);
