'use strict';


let base64id = require('base64id');

let io;
let Grid = require('./Grid');
let Player = require('./Player');

setImmediate(() => io = require('./io'));


let games = Object.create(null);


const TIMEOUT = 1000;


class Game {
	static getById(id) {
		return games[id];
	}


	static createGame({
		movesCount,
		secondsPerMove,
		maxPlayers,
		isPrivate,
	} = {}) {
		let socket = this;

		let game = new Game({
			movesCount,
			secondsPerMove,
			maxPlayers,
			isPrivate,
		});

		socket.emit('game:created', game.id);
	}


	static joinGame({
		name,
	} = {}) {
		let socket = this;
		let game = Game.getById(socket.nsp.name);
		if (!game) return socket.emit('invalid', 'invalid-game');
		let player = new Player({ name, socket });

		game.addPlayer(player);
	}


	constructor({
		movesCount = 10,
		secondsPerMove = 10,
		maxPlayers = 8,
		isPrivate = false,
	}) {
		let id = '/' + base64id.generateId();
		let namespace = io.of(id);
		let players = [];
		let grid = new Grid();
		let chat = [];
		let started = false;

		Object.defineProperties(this, {
			namespace: { value: namespace },
			timeout: { writable: true },
		});

		Object.assign(this, {
			chat,
			grid,
			id,
			isPrivate,
			maxPlayers,
			movesCount,
			players,
			secondsPerMove,
			started,
		});

		games[id] = this;

		namespace.on('connect', this.initSocket.bind(this));
	}


	initSocket(socket) {
		socket
			.emit('game:init', this)
			.once('game:join', Game.joinGame)
			.on('disconnect', () => this.timeoutDestroy());

		clearTimeout(this.timeout);
	}


	isFull() {
		return this.players.length >= this.maxPlayers;
	}


	addPlayer(player) {
		let { socket } = player;

		if (this.started) return socket.emit('invalid', 'game-started');
		if (this.isFull()) return socket.emit('invalid', 'game-full');

		let index = this.players.push(player) - 1;

		this.namespace.emit('game:playerjoin', player);

		socket
			.emit('game:join', index)
			.on('game:start', () => this.start(player))
			.on('game:message', (message) => this.sendMessage(player, message))
			.on('disconnect', () => this.removePlayer(player));
	}


	sendMessage({ name }, message) {
		if (!message.trim()) return;
		this.chat = this.chat.slice(-127).concat({ name, message });
		this.namespace.emit('game:message', name, message);
	}


	removePlayer(player) {
		let { players } = this;
		let playerIndex = players.indexOf(player);

		players.splice(playerIndex, 1);

		this.namespace.emit('game:playerleave', playerIndex);
	}


	start(player) {
		if (player != this.players[0]) return;

		this.started = true;

		this.namespace.emit('game:start');
	}


	destroy() {
		let { namespace } = this;
		let { connected } = namespace;
		for (let id in connected) connected[id].disconnect();
		namespace.removeAllListeners();
		delete io.nsps[this.id];
		delete games[this.id];
	}


	timeoutDestroy(socket) {
		for (let key in this.namespace.connected) return;
		this.timeout = setTimeout(() => this.destroy(), TIMEOUT);
	}
}



module.exports = Game;
