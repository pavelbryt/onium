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
			roundsTotal: 10,
			perMoveTime: 10000,
			maxPlayers: 6,
			isPrivate: false,
		};
	},

	computed: {
		perMoveSeconds: {
			get() {
				return this.perMoveTime / 1e3;
			},
			set(seconds) {
				this.perMoveTime = seconds * 1e3;
			},
		},
	},

	methods: {
		submit() {
			this.socket.emit('gamecreate', this.$data);
			this.$emit('close');
		},
	},
});



Vue.component('change-name', {
	template: '#template-change-name',

	props: ['name'],

	data() {
		return {
			input: this.name,
		};
	},

	mounted() {
		this.$refs.input.select();
	},
});



Vue.component('game', {
	template: '#template-game',

	props: ['id', 'username'],

	data() {
		return {
			socket: null,
			thisPlayer: null,
			turnStartTime: null,

			roundsTotal: null,
			perMoveTime: null,
			maxPlayers: null,
			isPrivate: null,
			grid: null,
			stage: null,
			players: [],
			round: null,
			turn: null,
			chat: [],
			turnRemainingTime: null,
		};
	},

	methods: {
		initSocket() {
			this.socket
				.on('init', this.init)
				.on('playerjoin', this.addPlayer)
				.on('playerleave', this.removePlayer)
				.on('join', (i) => this.thisPlayer = this.players[i])
				.on('chat', this.insertMessage)
				.on('reposition', this.reposition)
				.on('start', () => this.stage = 1)
				.on('turn', this.nextTurn)
				.on('round', (round) => this.round = round)
				.on('move', this.rotate)
				.on('clear', this.clear)
				.on('fill', this.fill)
				.on('points', (i, pts) => this.players[i].points = pts)
				.on('finish', this.finish)
				.on('error', (error) => {
					console.error(error);
					this.$emit('socketerror', error);
				});
		},

		join() {
			this.socket.emit('join', this.username);
		},

		leave() {
			this.socket.emit('leave');
		},

		sendMessage(input) {
			let message = { message: input };
			if (!this.thisPlayer) message.name = this.username;
			this.socket.emit('chat', message);
		},

		start() {
			this.socket.emit('start');
		},

		move(r, q, reverse) {
			if (!this.canMove) return;
			if (this.neighborsOf({ r, q }).length != 6) return;
			this.socket.emit('move', r, q, reverse);
		},

		init(data) {
			this.thisPlayer = null;
			for (let key in data) this[key] = data[key];

			if (this.turnRemainingTime) {
				this.turnStartTime = window.performance.now();
			} else {
				this.turnRemainingTime = this.perMoveTime;
			}
		},

		addPlayer(player) {
			this.players.push(player);
		},

		removePlayer(i) {
			let { players } = this;
			if (players[i] == this.thisPlayer) this.thisPlayer = null;
			players.splice(i, 1);
			if (i <= this.turn) this.turn--;
		},

		insertMessage(message)  {
			this.chat = this.chat.slice(-127).concat(message);
		},

		reposition(positions) {
			let { players } = this;
			this.players = players.map((_, i) => players[positions[i]]);
		},

		nextTurn(i) {
			this.turn = i;
			this.turnStartTime = performance.now();
			this.turnRemainingTime = this.perMoveTime;
		},

		rotate(r, q, reverse = false) {
			this.turnStartTime = null;

			let hex = this.hexAt(r, q);
			if (!hex) return;
			let neighbors = this.neighborsOf(hex);
			if (reverse) neighbors.reverse();

			let { r: nr, q: nq } = neighbors[5];

			for (let i = 5; i; i--) {
				neighbors[i].r = neighbors[i-1].r;
				neighbors[i].q = neighbors[i-1].q;
			}

			neighbors[0].r = nr;
			neighbors[0].q = nq;
		},

		clear(indexes) {
			let { grid } = this;
			for (let i of indexes) grid[i].color = -2;
		},

		fill(filled) {
			let { grid } = this;
			for (let [i, hex] of filled) this.$set(grid, i, hex);
		},

		finish() {
			this.stage = 2;
			this.turnRemainingTime = 0;
		},

		hexAt(r, q) {
			let { grid } = this;
			return grid && grid.find(hex => hex && hex.r == r && hex.q == q);
		},

		neighborsOf({ r, q }) {
			return [
				this.hexAt(r  , q-1),
				this.hexAt(r-1, q  ),
				this.hexAt(r-1, q+1),
				this.hexAt(r  , q+1),
				this.hexAt(r+1, q  ),
				this.hexAt(r+1, q-1),
			].filter(Boolean);
		},
	},

	computed: {
		canJoin() {
			return !this.thisPlayer && this.stage == 0 && !this.full;
		},

		full() {
			return this.players.length >= this.maxPlayers;
		},

		host() {
			return this.stage == 0 && this.thisPlayer == this.players[0];
		},

		canMove() {
			return this.stage == 1 && this.thisPlayer == this.players[this.turn];
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
				if (oldSocket) oldSocket.close();
				if (!socket) return;
				this.initSocket();
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
			viewBox: null,
		};
	},

	methods: {
		updateViewBox() {
			if (!this.grid) {
				this.viewBox = null;
				return;
			}

			let minX = +Infinity;
			let minY = +Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;

			for (let { r, q } of this.grid) {
				let x = q + r / 2;
				let y = r;
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);
			}

			let x = minX * HEXAGON_WIDTH - HEXAGON_HALF_WIDTH;
			let y = minY * HEXAGON_HEIGHT - HEXAGON_HALF_HEIGHT;
			let w = (maxX - minX + 1) * HEXAGON_WIDTH;
			let h = (maxY - minY + 1) * 3 * HEXAGON_QUARTER_HEIGHT + HEXAGON_QUARTER_HEIGHT;

			this.viewBox = `${x} ${y} ${w} ${h}`;
		},
	},

	computed: {
		hexagonPoints() {
			return [
				0, -HEXAGON_HALF_HEIGHT,
				-HEXAGON_HALF_WIDTH, -HEXAGON_QUARTER_HEIGHT,
				-HEXAGON_HALF_WIDTH, HEXAGON_QUARTER_HEIGHT,
				0, HEXAGON_HALF_HEIGHT,
				HEXAGON_HALF_WIDTH, HEXAGON_QUARTER_HEIGHT,
				HEXAGON_HALF_WIDTH, -HEXAGON_QUARTER_HEIGHT,
				// HEXAGON_HALF_WIDTH, 0,
				// HEXAGON_WIDTH, HEXAGON_QUARTER_HEIGHT,
				// HEXAGON_WIDTH, 3 * HEXAGON_QUARTER_HEIGHT,
				// HEXAGON_HALF_WIDTH, HEXAGON_HEIGHT,
				// 0, 3 * HEXAGON_QUARTER_HEIGHT,
				// 0, HEXAGON_QUARTER_HEIGHT,
			].join(',');
		},
	},

	watch: {
		grid(grid, oldGrid) {
			if (grid != oldGrid) this.updateViewBox();
		},
	},
});



Vue.component('hex', {
	template: '#template-hex',

	props: ['hex'],

	data() {
		return {
			scale: 1,
			opacity: 1,
			r: null,
			q: null,
			color: null,
		};
	},

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
				opacity: this.opacity,
				transform: `translate(${this.x}px,${this.y}px) scale(${this.scale})`,
			};
		},
	},

	watch: {
		hex: {
			immediate: true,
			deep: true,
			handler(hex) {
				if (hex == null) return;
				this.r = hex.r;
				this.q = hex.q;
				this.color = hex.color;
			}
		}
	}
});



Vue.component('lobby', {
	template: '#template-lobby',

	props: [
		'stage',
		'round',
		'roundsTotal',
		'turnRemainingTime',
		'turnStartTime',
		// 'latency',
		'maxPlayers',
		'players',
		'thisPlayer',
		'turn',
		'chat',
	],

	data() {
		return {
			input: '',
			remaining: null,
			animationRequest: null,
		};
	},

	methods: {
		formatRemainingTime() {
			let now = window.performance.now();
			let passed = now - this.turnStartTime;
			let remaining = Math.max(this.turnRemainingTime - passed, 0);

			return (remaining / 1e3).toPrecision(3);
		},

		sendMessage() {
			let { input } = this;
			if (!input) return;
			this.$emit('message', input);
			this.input = '';
		},
	},

	// mounted() {
	// 	let animate = () => {
	// 		// console.log('frame');
	// 		this.animationRequest = window.requestAnimationFrame(animate);
	// 		// this.remaining = this.formatRemainingTime();
	// 		this.$forceUpdate();
	// 	};

	// 	animate();
	// },

	// beforeDestroy() {
	// 	window.cancelAnimationFrame(this.animationRequest);
	// },
});



Vue.component('timer', {
	template: '#template-timer',

	props: ['startTime', 'remainingTime'],

	data() {
		return {
			frame: null,
		};
	},

	computed: {
		enabled() {
			return Number.isFinite(this.remainingTime);
		},

		started() {
			return this.enabled && Number.isFinite(this.startTime);
		},
	},

	methods: {
		formatRemainingTime() {
			if (!this.enabled) {
				this.stopAnimation();
				return '--.--';
			}

			let remaining;

			if (this.started) {
				let now = window.performance.now();
				let passed = now - this.startTime;
				remaining = Math.max(this.remainingTime - passed, 0);
				if (!remaining) this.stopAnimation();
			} else {
				remaining = this.remainingTime;
				this.stopAnimation();
			}

			let fixed = (remaining / 1e3).toFixed(2);
			return (fixed.length < 5 ? '0' : '') + fixed;
		},

		startAnimation() {
			this.stopAnimation();
			this.animate();
		},

		stopAnimation() {
			window.cancelAnimationFrame(this.frame);
		},

		animate() {
			this.frame = window.requestAnimationFrame(this.animate);
			// console.log('frame');
			this.$forceUpdate();
		},
	},

	watch: {
		startTime: 'startAnimation',
		remainingTime: 'startAnimation',
	},

	beforeDestroy() {
		this.stopAnimation();
	},
});



let app = new Vue({
	el: '#app',

	data: {
		socket: io(),
		modal: null,
		gameId: window.location.hash.slice(1) || null,
		username: window.localStorage.username || '',
	},

	methods: {
		createGame() {
			this.socket.emit('gamecreate');
		},

		quickGame() {
			this.socket.emit('quickgame');
		},
	},

	watch: {
		gameId(id) {
			window.location.replace('#' + id);
		},

		username(name) {
			window.localStorage.username = name;
		},
	},

	created() {
		this.socket
			.on('error', console.error)
			.on('gameid', (gameId) => this.gameId = gameId);

		if (!this.username) this.modal = 'change-name';

		window.addEventListener('keydown', ({ keyCode }) => {
			if (keyCode == 27) this.modal = null;
		});

		if (!this.gameId) this.quickGame();
	},
});







