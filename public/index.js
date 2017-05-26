'use strict';


const HEXAGON_SIZE = 1;

const HEXAGON_HEIGHT = HEXAGON_SIZE * 2;
const HEXAGON_WIDTH = Math.sqrt(3) / 2 * HEXAGON_HEIGHT;

const HEXAGON_HALF_HEIGHT = HEXAGON_HEIGHT / 2;
const HEXAGON_HALF_WIDTH = HEXAGON_WIDTH / 2;

const HEXAGON_QUARTER_HEIGHT = HEXAGON_HEIGHT / 4;

const PREVIOUS_NEIGHBORS_OFFSETS = [
	[ 0, -1],
	[-1,  0],
	[-1, +1],
];

const NEXT_NEIGHBORS_OFFSETS = [
	[ 0, +1],
	[+1,  0],
	[+1, -1],
];

const NEIGHBORS_OFFSETS = [].concat(
	PREVIOUS_NEIGHBORS_OFFSETS,
	NEXT_NEIGHBORS_OFFSETS,
);



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
		};
	},

	methods: {
		init(data) {
			for (let key in data) this[key] = data[key];
		},

		join() {
			this.socket.emit('game:join', { name: this.playerName });
		},

		leave() {
			this.socket.emit('game:leave');
			this.player = null;
		},

		start() {
			this.socket.emit('game:start');
		},

		insertMessage(name, message)  {
			this.chat = this.chat.slice(-127).concat({ name, message });
		},

		sendMessage() {
			if (!this.currentMessage) return;
			this.socket.emit('game:message', this.currentMessage);
			this.currentMessage = '';
		},
	},

	computed: {
		full() {
			return this.players.length >= this.maxPlayers;
		},

		host() {
			return this.player == this.players[0];
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

				socket
					.on('error', console.error)
					.on('disconnect', () => console.log('disconnect'))
					.on('game:init', this.init)
					.on('game:playerjoin', (player) => this.players.push(player))
					.on('game:playerleave', (index) => this.players.splice(index, 1))
					.on('game:join', (index) => this.player = this.players[index])
					.on('game:start', () => this.started = true)
					.on('game:message', this.insertMessage)
					.on('invalid', console.warn);
			},
		},
	},

	beforeDestroy() {
		let { socket } = this;
		if (socket) socket.close();
	},
});



Vue.component('hex', {
	template: '#template-hex',

	props: ['r', 'q', 'id', 'type', 'grid'],

	computed: {
		x() {
			this.log();
			return HEXAGON_WIDTH * this.q + HEXAGON_HALF_WIDTH * this.r;
		},

		y() {
			return HEXAGON_QUARTER_HEIGHT * 3 * this.r;
		},

		clickable() {
			return this.neighbors.length == 6;
		},

		prevNeighbors() {
			let { r, q, grid } = this;
			let neighbors = [];

			for (let [dr, dq] of PREVIOUS_NEIGHBORS_OFFSETS) {
				let neighbor = this.getHex(r+dr, q+dq);
				neighbor && neighbors.push(neighbor);
			}

			return neighbors;
		},

		nextNeighbors() {
			let { r, q, grid } = this;
			let neighbors = [];

			for (let [dr, dq] of NEXT_NEIGHBORS_OFFSETS) {
				let neighbor = this.getHex(r+dr, q+dq);
				neighbor && neighbors.push(neighbor);
			}

			return neighbors;
		},

		neighbors() {
			return this.prevNeighbors.concat(this.nextNeighbors);
		},

		transform() {
			return `translate(${this.x},${this.y})`;
		}
	},

	methods: {
		getHex(r, q) {
			let { grid } = this;
			return grid[r] && grid[r][q];
		},

		move(direction) {
			console.log(this.neighbors);
			this.rotate();
			// this.$emit('move', this.r, this.q, direction);
		},

		swap(a, b = this.hexData) {
			let { grid } = this;
			let { r: ar, q: aq } = a;
			let { r: br, q: bq } = b;

			a.r = br;
			a.q = bq;
			grid[br][bq] = a;

			b.r = ar;
			b.q = aq;
			grid[ar][aq] = b;
		},

		rotate() {
			let { grid, neighbors } = this;
			if (neighbors.length != 6) return;

			console.log(neighbors.map(({ r, q }) => `${r},${q}`));

			let { r: r0, q: q0 } = neighbors[0];

			for (let i = 1; i < 6; i++) {
				let current = neighbors[i];
				let prev = neighbors[i-1];
				let { r, q } = current;
				prev.r = r;
				prev.q = q;
				grid[r][q] = prev;
			}

			let last = neighbors[5];
			last.r = r0;
			last.q = q0;
			grid[r0][q0] = last;

			console.log(neighbors.map(({ r, q }) => `${r},${q}`));
		},

		log() {
			console.log('!');
		},
	},

	created() {
		// this.grid[this.r][this.q] = this;
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
		isIndex(n) {
			// console.log('isIndex', arguments);
			return n != null && Number.isSafeInteger(+n);
		},

		hexagonX(r, q) {
			// console.log('hexagonX');
			return HEXAGON_WIDTH * q + HEXAGON_HALF_WIDTH * r;
		},

		hexagonY(r) {
			// console.log('hexagonY');
			return HEXAGON_QUARTER_HEIGHT * 3 * r;
		},

		async updateGridTransform() {
			await this.$nextTick();
			let bBox = this.$refs.g.getBBox();
			let scale = 1 / Math.max(bBox.width, bBox.height);
			let translateX = -bBox.x * scale;
			let translateY = -bBox.y * scale;
			let matrix = [scale, 0, 0, scale, translateX, translateY];
			this.gridTransform = `matrix(${matrix.join(',')})`;
		},

		move(r, q, direction) {
			let { grid } = this;
			let mem = grid[r-1][q];

			let offsets = [
				[-1,  0],
				[-1,  1],
				[ 0,  1],
				[ 1,  0],
				[ 1, -1],
				[ 0, -1],
			];

			offsets.reduce((prev, [offsetR, offsetQ]) => {

			});

			grid[r-1][q] = grid[r-1][q+1];
			grid[r-1][q+1] = grid[r][q+1];
			grid[r][q+1] = grid[r+1][q];
			grid[r+1][q] = grid[r+1][q-1];
			grid[r+1][q-1] = grid[r][q-1];
			grid[r][q-1] = mem;

			return this.emit('move', { r, q, direction });
		},

		log: console.log.bind(console),

		createGame() {
			this.socket.emit('create-game')
		}
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
	},

	watch: {
		grid: {
			// immediate: true,
			handler() {
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







