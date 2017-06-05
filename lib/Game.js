'use strict';


let base64id = require('base64id');
let delay = require('delay');

let io;
let Grid = require('./Grid');
let Player = require('./Player');

setImmediate(() => io = require('./io'));


let games = [];


const NOT_STARTED = 0;
const STARTED     = 1;
const FINISHED    = 2;

const GAME_TIMEOUT = 60000;


class Game {
	static create(socket, options) {
		let game = new Game(options);
		socket.emit('gameid', game.namespace.name);
	}


	static random(socket) {
		let publicGames = games.filter((game) => {
			return !game.isPrivate && game.stage == NOT_STARTED && !game.isFull();
		});

		let { length } = publicGames;
		let game = length ? publicGames[Math.random() * length | 0] : new Game();
		socket.emit('gameid', game.namespace.name);
	}


	constructor({
		roundsTotal = 10,
		perMoveTime = 10000,
		maxPlayers = 7,
		isPrivate = false,
	} = {}) {
		roundsTotal = Math.min(Math.max(Math.floor(roundsTotal), 1), 20) || 10;
		perMoveTime = Math.min(Math.max(perMoveTime, 2000), 99994) || 10000;
		maxPlayers = Math.min(Math.max(maxPlayers, 1), 6) || 7;
		isPrivate = Boolean(isPrivate);

		let id = '/' + base64id.generateId();

		Object.defineProperties(this, {
			namespace: { value: io.of(id) },
			processing: { writable: true, value: false },
			gameTimeout: { writable: true },
			turnTimeout: { writable: true },
			hrTurnStartTime: { writable: true, value: null },
			turnRemainingTime: {
				enumerable: true,
				get() {
					let { hrTurnStartTime } = this;
					if (!hrTurnStartTime) return null;
					let [s, ns] = process.hrtime(hrTurnStartTime);
					let ms = s * 1e3 + ns / 1e6;
					return Math.max(this.perMoveTime - ms, 0);
				},
			},
		});

		Object.assign(this, {
			roundsTotal,
			perMoveTime,
			maxPlayers,
			isPrivate,
			grid: Grid.create(),
			stage: NOT_STARTED,
			players: [],
			round: 0,
			turn: -1,
			chat: [],
		});

		games.push(this);

		this.namespace.on('connect', this.initSocket.bind(this));
	}


	initSocket(socket) {
		clearTimeout(this.gameTimeout);

		socket
			.on('error', console.warn)
			.on('chat', this.sendMessage.bind(this, socket))
			.on('join', (name) => this.addPlayer(socket, name))
			.on('echo', (...args) => args.pop()(...args))
			.on('disconnect', () => this.timeoutDestroy())
			.emit('init', this);
	}


	isFull() {
		return this.players.length >= this.maxPlayers;
	}


	addPlayer(socket, name) {
		if (this.stage != NOT_STARTED) return;
		if (this.isFull()) return;
		let { players } = this;
		if (players.find(p => p.socket == socket)) return;
		name = name.trim().slice(0, 20);
		if (!name) return;

		let availableColors = [1, 2, 3, 4, 5, 6].filter((color) => {
			return players.every((player) => player.color != color);
		});

		let color = availableColors[Math.random() * availableColors.length | 0];
		let player = new Player({ socket, name, color });
		let i = this.players.push(player) - 1;

		this.namespace.emit('playerjoin', player);

		socket
			.emit('join', i)
			.on('leave', this.removePlayer.bind(this, player))
			.on('start', this.start.bind(this, player))
			// .on('chat', this.sendMessage.bind(this, player))
			.on('move', this.move.bind(this, player))
			.on('disconnect', this.removePlayer.bind(this, player));
	}


	removePlayer(player) {
		if (this.stage == 2) return;
		let { players } = this;
		let i = players.indexOf(player);
		if (i == -1) return;

		players.splice(i, 1);
		this.namespace.emit('playerleave', i);

		if (this.stage == STARTED && !players.length) return this.finish();
		if (i <= this.turn) this.turn--;
		if (i == this.turn) this.nextTurn();
	}


	// sendMessage(player, message) {
	// 	if (!this.players.includes(player)) return;
	// 	message = message.trim().slice(0, 256);
	// 	if (!message) return;
	// 	let { name, color } = player;
	// 	this.chat = this.chat.slice(-127).concat({ name, color, message });
	// 	this.namespace.emit('chat', { name, color, message });
	// }


	sendMessage(socket, { name, message }) {
		if (typeof message != 'string') return;
		message = message.trim().slice(0, 256);
		if (!message) return;

		let player = this.players.find((p) => p.socket == socket);
		let color;

		if (player) {
			({ name, color } = player);
		} else {
			if (typeof name != 'string') return;
			name = name.trim().slice(0, 20);
			if (!name) return;
			color = -1;
		}

		this.chat = this.chat.slice(-127).concat({ name, color, message });
		this.namespace.emit('chat', { name, color, message });
	}


	start(player) {
		let { players } = this;
		if (this.stage != NOT_STARTED) return;
		if (player != players[0]) return;

		let positions = players
			.map((player, i) => i)
			.sort(() => Math.random() - .5);

		this.players = players.map((_, i) => players[positions[i]]);
		this.namespace.emit('reposition', positions);

		this.namespace.emit('round', this.round = 1);

		this.stage = STARTED;
		this.namespace.emit('start');
		this.nextTurn();
	}


	async move(player, r, q, reverse = false) {
		let { turn, grid, namespace } = this;
		if (this.processing) return;
		if (this.players[turn] != player) return;
		if (!this.turnRemainingTime) return;
		if (!grid.rotate(r, q, reverse)) return;

		clearTimeout(this.turnTimeout);
		this.hrTurnStartTime = null;
		this.processing = true;

		namespace.emit('move', r, q, !!reverse);

		await delay(500);

		let groups = grid
			.allGroups()
			.filter((group) => group.size >= 3);

		if (groups.length) {
			let cleared = groups.reduce((cleared, group) => {
				return cleared.concat(...group);
			}, []);

			let indexes = cleared.map((hex) => grid.indexOf(hex));

			for (let hex of cleared) {
				let double = hex.color == 0 || hex.color == player.color;
				player.points += double ? 2 : 1;
				hex.color = -2;
			}

			namespace.emit('clear', indexes);
			namespace.emit('points', turn, player.points);

			await delay(500);

			let filled = cleared.map((hex, i) => {
				grid.fill(hex);
				return [indexes[i], hex];
			});

			namespace.emit('fill', filled);
		}

		this.processing = false;
		this.nextTurn();
	}


	nextTurn() {
		clearTimeout(this.turnTimeout);

		if (++this.turn >= this.players.length) {
			this.turn = 0;
			if (this.round >= this.roundsTotal) return this.finish();
			this.namespace.emit('round', ++this.round);
		}

		this.namespace.emit('turn', this.turn);
		this.turnTimeout = setTimeout(() => this.nextTurn(), this.perMoveTime);
		this.hrTurnStartTime = process.hrtime();
	}


	finish() {
		clearTimeout(this.turnTimeout);
		this.hrTurnStartTime = null;
		this.stage = FINISHED;
		this.namespace.emit('finish');
	}


	destroy() {
		let { namespace } = this;
		let { connected } = namespace;
		for (let id in connected) connected[id].disconnect();
		namespace.removeAllListeners();
		delete io.nsps[this.namespace.name];
		games.splice(games.indexOf(this), 1);
		clearTimeout(this.gameTimeout);
		clearTimeout(this.turnTimeout);
	}


	timeoutDestroy(socket) {
		for (let key in this.namespace.connected) return;
		this.gameTimeout = setTimeout(() => this.destroy(), GAME_TIMEOUT);
	}
}



module.exports = Game;
