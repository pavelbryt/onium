'use strict';


const HEXAGON_SIZE = 1;

const HEXAGON_HEIGHT = HEXAGON_SIZE * 2;
const HEXAGON_WIDTH = Math.sqrt(3) / 2 * HEXAGON_HEIGHT;

const HEXAGON_HALF_HEIGHT = HEXAGON_HEIGHT / 2;
const HEXAGON_HALF_WIDTH = HEXAGON_WIDTH / 2;

const HEXAGON_QUARTER_HEIGHT = HEXAGON_HEIGHT / 4;


Vue.component('modal', {
	template: '#template-modal',

	mounted() {
		let { form } = this.$refs;
		if (form[0]) form[0].focus();
	},
});


Vue.component('create-game', {
	template: '#template-create-game',

	props: ['socket'],

	data() {
		return {
			movesPerPlayer: 10,
			secondsPerMove: 10,
			maxPlayers: 8,
			isPrivate: false,
			submitting: false,
		};
	},

	methods: {
		submit() {
			if (this.submitting) return;

			let {
				socket,
				movesPerPlayer,
				secondsPerMove,
				maxPlayers,
				isPrivate,
				submitting
			} = this;

			this.submitting = true;

			socket.emit('game:create', {
				movesPerPlayer,
				secondsPerMove,
				maxPlayers,
				isPrivate,
			});

			socket.once('game:created', (gameId) => {
				this.$emit('gamecreate', gameId);
				this.$emit('close');
			});
		},
	},
});



Vue.component('change-name', {
	template: '#template-change-name',

	props: ['prevName'],

	data() {
		return { name: this.prevName };
	},

	mounted() {
		this.$refs.input.select();
	}
})



Vue.component('game', {
	template: '#template-game',

	props: ['id', 'playerName'],

	data() {
		return {
			players: [],
			player: null,
			grid: null,
			chat: [],
			currentMessage: '',
			isPrivate: null,
			maxPlayers: null,
			movesCount: null,
			secondsPerMove: null,
			started: null,
			socket: null,
			turn: 0,
		};
	},

	methods: {
		initSocket(socket) {
				// socket
				// 	.on('error', console.error)
				// 	.on('disconnect', () => console.log('disconnect'))
				// 	.on('game:init', this.init)
				// 	.on('game:playerjoin', (player) => this.players.push(player))
				// 	.on('game:playerleave', (index) => this.players.splice(index, 1))
				// 	.on('game:join', (index) => this.player = this.players[index])
				// 	.on('game:start', this.onStart)
				// 	.on('game:message', this.insertMessage)
				// 	.on('invalid', console.warn);
			socket
				.on('error', console.error)
				.on('gameerror', console.error)
				.on('init', this.init)
				.on('playerjoin', (player) => this.players.push(player))
				.on('playerleave', (i) => this.players.splice(i, 1))
				.on('join', (i) => this.player = this.players[i])
				.on('message', this.insertMessage)
				.on('shuffle', this.shuffle)
				.on('start', () => this.started = true)
				.on('turn', (i) => this.turn = i)
				.on('move', this.rotate)
				.on('clear', this.clear)
				.on('fill', this.fill)
				.on('points', (i, pts) => this.players[i].points = pts)
				.on('end', this.end);
		},

		init(data) {
			for (let key in data) this[key] = data[key];
		},

		join() {
			this.socket.emit('join', this.playerName);
		},

		insertMessage(name, message)  {
			this.chat = this.chat.slice(-127).concat({ name, message });
		},

		start() {
			this.socket.emit('start');
		},

		shuffle(positions) {
			let { players } = this;
			this.players = players.map((_, i) => players[positions[i]]);
		},

		sendMessage() {
			if (!this.currentMessage) return;
			this.socket.emit('game:message', this.currentMessage);
			this.currentMessage = '';
		},

		hexAt([r, q]) {
			let { grid } = this;
			return grid[r] && grid[r][q];
		},

		setHex([r, q], hex) {
			let { grid } = this;
			this.$set(grid[r] || this.$set(grid, r, Array(q+1)), q, hex);
			// (grid[r] || (grid[r] = Array(q+1)))[q] = hex;
		},

		prevNeighborsCoordsOf([r, q]) {
			return [
				[r  , q-1],
				[r-1, q  ],
				[r-1, q+1],
			].filter(this.hexAt);
		},

		nextNeighborsCoordsOf([r, q]) {
			return [
				[r  , q+1],
				[r+1, q  ],
				[r+1, q-1],
			].filter(this.hexAt);
		},

		neighborsCoordsOf(coords) {
			return this.prevNeighborsCoordsOf(coords)
				.concat(this.nextNeighborsCoordsOf(coords));
		},

		rotate(coords, reverse = false) {
			console.log(arguments);
			let neighborsCoords = this.neighborsCoordsOf(coords);
			if (reverse) neighborsCoords.reverse();
			let neighbors = neighborsCoords.map(this.hexAt);

			for (let i = 0; i < 6; i++) {
				this.setHex(neighborsCoords[i], neighbors[i+1]);
			}

			this.setHex(neighborsCoords[5], neighbors[0]);
		},

		clear(coordsArray) {
			let { grid } = this;
			for (let [r, q] of coordsArray) this[r, q] = null;
		},

		emitMove(coords, reverse) {
			if (!this.canMove) return;
			if (this.neighborsCoordsOf(coords).length != 6) return;
			this.socket.emit('move', coords, reverse);
		},
	},

	computed: {
		full() {
			return this.players.length >= this.maxPlayers;
		},

		host() {
			return !this.started && this.player == this.players[0];
		},

		canMove() {
			return this.started && this.player == this.players[this.turn];
		},
	},

	watch: {
		id: {
			immediate: true,
			handler(id) {
				this.socket = id ? io(id) : null;
			},
		},

		socket: {
			immediate: true,
			handler(socket, oldSocket) {
				console.log(socket, oldSocket);
				if (oldSocket) oldSocket.close();
				if (!socket) return;
				this.initSocket(socket);
			},
		},
	},

	beforeDestroy() {
		let { socket } = this;
		if (socket) socket.close();
	},
});



Vue.component('grid', {
	template: '#template-grid',

	props: ['grid'],

	data() {
		return {
			gridTransform: null,
		};
	},

	methods: {
		async updateGridTransform() {
			await this.$nextTick();
			let bBox = this.$refs.svg.getBBox();
			let scale = 1 / Math.max(bBox.width, bBox.height);
			let translateX = -bBox.x * scale;
			let translateY = -bBox.y * scale;
			let matrix = [scale, 0, 0, scale, translateX, translateY];
			this.gridTransform = `matrix(${matrix.join(',')})`;
		},
	},

	computed: {
		// transform() {
		// 	console.log('transform');
		// 	let minX, maxX, minY, maxY;
		// 	minX = minY = Infinity;
		// 	maxX = maxY = -Infinity;

		// 	let { grid } = this;

		// 	for (let r in grid) {
		// 		let row = grid[r];
		// 		r = +r;
		// 		minY = Math.min(minY, r);
		// 		maxY = Math.max(maxY, r);
		// 		for (let q in row) {
		// 			q = +q;
		// 			let x = q + r / 2;
		// 			maxX = Math.max(maxX, q + r / 2);
		// 		}
		// 	}

		// 	maxX = (maxX + .5) * HEXAGON_WIDTH;
		// 	maxY = (maxY + .5) * HEXAGON_HEIGHT;
		// 	let scale = 1 / Math.max(maxX, maxY);
		// 	if (!Number.isFinite(scale)) scale = 1;
		// 	return `scale(${scale})`;
		// },

		hexagonPoints() {
			return [
				0, -HEXAGON_HALF_HEIGHT,
				-HEXAGON_HALF_WIDTH, -HEXAGON_QUARTER_HEIGHT,
				-HEXAGON_HALF_WIDTH, HEXAGON_QUARTER_HEIGHT,
				0, HEXAGON_HALF_HEIGHT,
				HEXAGON_HALF_WIDTH, HEXAGON_QUARTER_HEIGHT,
				HEXAGON_HALF_WIDTH, -HEXAGON_QUARTER_HEIGHT,
			].join(',');
		},

		flatGrid() {
			let { grid } = this;
			let flatGrid = [];

			if (!grid) return grid;

			for (let r = 0; r < grid.length; r++) {
				let row = grid[r];
				if (!row) continue;
				for (let q = 0; q < row.length; q++) {
					let hex = row[q];
					if (!hex) continue;
					flatGrid.push(Object.assign({ r, q }, hex));
				}
			}

			return flatGrid;
		},

		test() {
			return [1, 2, 3];
		}
	},

	watch: {
		grid: {
			// immediate: true,
			handler(_, old) {
				if (old) return;
				this.updateGridTransform();
			},
		},
	},

	created() {
		// this.socket.addEventListener('message', (event) => {
		// 	try {
		// 		let [...args] = JSON.parse(event.data);
		// 		if (!args.length) return;
		// 		this.$emit(...args);
		// 	} catch (error) {}
		// });

		// let { grid } = this;
		// let i = 0;

		// for (let r in grid) {
		// 	let row = grid[r];
		// 	for (let q in row) {
		// 		Object.assign(row[q], {
		// 			grid,
		// 			r: +r,
		// 			q: +q,
		// 			key: i++,
		// 		});
		// 	}
		// }

		// this.grid = grid;
		// this.updateGridTransform();
	},
});



Vue.component('hex', {
	template: '#template-hex',

	props: ['r', 'q', 'id', 'type'],

	computed: {
		x() {
			return HEXAGON_WIDTH * this.q + HEXAGON_HALF_WIDTH * this.r;
		},

		y() {
			return HEXAGON_QUARTER_HEIGHT * 3 * this.r;
		},

		transform() {
			return `translate(${this.x},${this.y})`;
		},

		style() {
			return {
				transform: `translate(${this.x}px,${this.y}px)`,
			};
		},
	},
});



let app = new Vue({
	el: '#app',

	data: {
		socket: io(),
		modal: null,
		gameId: window.location.hash.slice(1),
		playerName: localStorage.playerName || '',
	},

	methods: {
		// enterGame(gameId) {
		// 	this.leaveGame();
		// 	this.modal = null;
		// 	this.gameSocket = io(gameId);
		// },

		// leaveGame() {
		// 	let { gameSocket } = this;
		// 	if (!gameSocket) return;
		// 	gameSocket.close();
		// 	this.gameSocket = null;
		// },
	},

	watch: {
		gameId(id) {
			window.location.hash = (id == null ? '' : id);
		},

		playerName(name) {
			localStorage.playerName = name;
		},
	},

	created() {
		this.socket.on('invalid', console.warn);

		if (!this.playerName) this.modal = 'change-name';

		window.addEventListener('keydown', ({ keyCode }) => {
			if (keyCode == 27) this.modal = null;
		});
	},
});







