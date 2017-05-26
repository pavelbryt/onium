'use strict';


let SocketIO = require('socket.io');
let base64id = require('base64id');

let Game = require('./Game');
let Player = require('./Player');


let io = new SocketIO();


io.on('connect', (socket) => {
	socket.on('game:create', Game.createGame);
});



module.exports = io;
