'use strict';


let base64id = require('base64id');
let delay = require('delay');

let io;
let Grid = require('./Grid');
let Player = require('./Player');

setImmediate(() => io = require('./io'));


let games = Object.create(null);


const TIMEOUT = 60000;


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


	// static joinGame({
	// 	name,
	// } = {}) {
	// 	let socket = this;
	// 	let game = Game.getById(socket.nsp.name);
	// 	if (!game) return socket.emit('invalid', 'invalid-game');
	// 	let player = new Player({ name, socket });

	// 	game.addPlayer(player);
	// }


	constructor({
		movesCount = 10,
		secondsPerMove = 10,
		maxPlayers = 8,
		minGroupSize = 6,
		isPrivate = false,
	}) {
		let id = '/' + base64id.generateId();
		let namespace = io.of(id);
		let players = [];
		let grid = new Grid();
		let chat = [];
		let started = false;
		let turn = 0;

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
			minGroupSize,
			movesCount,
			players,
			secondsPerMove,
			started,
			turn,
		});

		games[id] = this;

		namespace.on('connect', this.initSocket.bind(this));
	}


	initSocket(socket) {
		socket
			// .emit('game:init', this)
			// .once('game:join', ({ name }) => this.addPlayer(socket, name))
			// .on('disconnect', () => this.timeoutDestroy());
			.on('error', console.warn)
			.on('join', (name) => this.addPlayer(socket, name))
			.on('disconnect', () => this.timeoutDestroy())
			.emit('init', this);

		clearTimeout(this.timeout);
	}


	isFull() {
		return this.players.length >= this.maxPlayers;
	}


	addPlayer(socket, name) {
		if (this.started) return;
		if (this.isFull()) return;
		if (this.players.find(p => p.socket == socket)) return;

		let player = new Player({ socket, name });
		let i = this.players.push(player) - 1;

		this.namespace.emit('playerjoin', player);

		socket
			.emit('join', i)
			.on('start', this.start.bind(this, player))
			.on('message', this.sendMessage.bind(this, player))
			.on('move', this.move.bind(this, player))
			.on('disconnect', this.removePlayer.bind(this, player));
	}


	removePlayer(player) {
		let { players } = this;
		let i = players.indexOf(player);
		if (i == -1) return;


		players.splice(i, 1);

		this.namespace.emit('playerleave', i);

		if (i == this.turn) this.nextTurn();
	}


	nextTurn() {
		this.turn = (this.turn + 1) % this.players.length;
		this.namespace.emit('turn', this.turn);
	}


	sendMessage(player, message) {
		if (!players.includes(player)) return;
		message = message.trim();
		if (!message) return;
		this.chat = this.chat.slice(-127).concat({ name, message });
		this.namespace.emit('message', name, message);
	}


	start(player) {
		let { players } = this;
		if (player != players[0]) return;

		let positions = players
			.map((player, i) => i)
			.sort(() => Math.random() - .5);

		this.players = players.map((_, i) => players[positions[i]]);
		this.started = true;
		this.namespace.emit('shuffle', positions);
		this.namespace.emit('start');
	}


	async move(player, coords, reverse = false) {
		if (this.players[this.turn] != player) return;
		if (!this.grid.rotate(coords, reverse)) return;
		this.namespace.emit('move', coords, reverse);

		for (;;) {
			await delay(500);

			let groups = this.grid
				.findGroups()
				.filter((group) => group.length >= this.minGroupSize);

			if (!groups.length) break;

			let cleared = [].concat(...groups);

			cleared.forEach(this.grid._clear);
			this.namespace.emit('clear', cleared);
			player.points += cleared.length;
			this.namespace.emit('points', this.turn, player.points);

			await delay(500);

			let filled = cleared.map(this.grid._fill);
			this.namespace.emit('fill', filled);
		}

		this.nextTurn();
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
