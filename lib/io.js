'use strict';


let SocketIO = require('socket.io');

let Game = require('./Game');


let io = new SocketIO();


io.on('connect', (socket) => {
	socket
		.on('gamecreate', Game.create.bind(null, socket))
		.on('quickgame', Game.random.bind(null, socket));
});



module.exports = io;
