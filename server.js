const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let peers = [];

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('A peer connected');
    peers.push(socket);

    socket.emit('peerId', socket.id);
    socket.broadcast.emit('newPeer', socket.id);

    socket.on('bandwidthReport', (data) => {
        socket.broadcast.emit('bandwidthUpdate', { peerId: socket.id, bandwidth: data.bandwidth });
    });

    socket.on('disconnect', () => {
        console.log('A peer disconnected');
        peers = peers.filter((peer) => peer.id !== socket.id);
        socket.broadcast.emit('peerDisconnected', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
