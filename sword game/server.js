// server.js - 13강 축하 메시지 추가
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = process.env.PORT || 3000;

app.use(express.static('public'));

const users = {};

io.on('connection', (socket) => {
    console.log('접속:', socket.id);

    socket.on('login', (nickname) => {
        const newUser = {
            id: socket.id,
            nickname: nickname,
            level: 0,
            money: 1000, 
        };
        users[socket.id] = newUser;

        socket.emit('init_users', users);
        socket.broadcast.emit('user_joined', newUser);
        io.emit('news', `[시스템] '${nickname}'님이 입장하셨습니다.`);
    });

    socket.on('mine_gold', () => {
        const user = users[socket.id];
        if(!user) return;
        user.money += 10;
        socket.emit('update_stats', user);
    });

    socket.on('sell_weapon', () => {
        const user = users[socket.id];
        if(!user) return;
        if(user.level === 0) {
            socket.emit('news_personal', "0강은 팔 수 없습니다!");
            return;
        }
        const reward = user.level * user.level * 100;
        user.money += reward;
        user.level = 0;
        socket.emit('update_stats', user);
        io.emit('update_visual', { id: socket.id, level: 0, outcome: 'reset' });
        io.emit('news', `'${user.nickname}'님이 검을 판매하여 ${reward}G를 벌었습니다!`);
    });

    socket.on('request_enhance', () => {
        const user = users[socket.id];
        if (!user) return;

        const cost = (user.level + 1) * 10;
        if (user.money < cost) {
            socket.emit('news_personal', `강화 비용 부족! (필요: ${cost}G)`);
            return;
        }
        user.money -= cost;

        let failChance = 0.1 + (user.level * 0.02);
        if(failChance > 0.4) failChance = 0.4;

        let successChance = 0.3 - (user.level * 0.01);
        if(successChance < 0.1) successChance = 0.1;

        const maintainChance = 1 - (failChance + successChance);
        const rand = Math.random();
        let outcome = '';

        if (rand < successChance) {
            user.level++;
            outcome = 'success';
            
            // ★ [수정됨] 13강 달성 시 특별 공지
            if (user.level === 13) {
                io.emit('news', `🎉 [축] '${user.nickname}'님이 전설의 13강(Black) 검을 탄생시켰습니다!!! 🎉`);
            } else {
                io.emit('news', `'${user.nickname}'님 +${user.level}강 성공!`);
            }

        } else if (rand < successChance + maintainChance) {
            outcome = 'maintain';
            socket.emit('news_personal', "강화 유지! (등급 보존)");
        } else {
            user.level = 0;
            outcome = 'fail';
            io.emit('news', `'${user.nickname}'님 강화 실패... 초기화되었습니다.`);
        }

        socket.emit('update_stats', user);
        io.emit('update_visual', { id: socket.id, level: user.level, outcome: outcome });
    });

    socket.on('disconnect', () => {
        if (users[socket.id]) {
            io.emit('user_left', socket.id);
            delete users[socket.id];
        }
    });
});

server.listen(port, () => {
    console.log(`RPG 서버 실행 중: http://localhost:${port}`);
});