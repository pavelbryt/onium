'use strict';


let Koa = require('koa');
let KoaStaticCache = require('koa-static-cache');
let Path = require('path');
// let WebSocket = require('ws');
let SocketIO = require('socket.io');

let io = require('./lib/io');


const PUBLIC_DIR = Path.join(__dirname, 'public');
const VUE_DIR = Path.join(__dirname, 'node_modules', 'vue', 'dist');
const SOCKET_IO_DIR = Path.join(__dirname, 'node_modules', 'socket.io-client', 'dist');
const PORT = process.env.PORT || 9979;


let app = new Koa;
let server = app.listen(PORT, () => console.log(PORT));
// let wss = new WebSocket.Server({ server });
// let io = new SocketIO;


io.attach(server);

app.use(KoaStaticCache(PUBLIC_DIR));
app.use(KoaStaticCache(VUE_DIR));
app.use(KoaStaticCache(SOCKET_IO_DIR));


// let grid = [
// 	[    ,     ,     ,    0,    0,    0,    0],
// 	[    ,     ,    0,    0,    0,    0,    0],
// 	[    ,    0,    0,    0,    0,    0,    0],
// 	[   0,    0,    0,    0,    0,    0,    0],
// 	[   0,    0,    0,    0,    0,    0      ],
// 	[   0,    0,    0,    0,    0            ],
// 	[   0,    0,    0,    0                  ],
// ].reduce(function toObject(obj, val, i) {
// 	if (Array.isArray(val)) obj[i] = val.reduce(toObject, {});
// 	else {
// 		let prev = [obj[]]
// 		obj[i] = { type: Math.random() * 6 | 0 };
// 	}
// 	return obj;
// }, {});

let matrix = [
	[    ,     ,     ,    0,    0,    0,    0],
	[    ,     ,    0,    0,    0,    0,    0],
	[    ,    0,    0,    0,    0,    0,    0],
	[   0,    0,    0,    0,    0,    0,    0],
	[   0,    0,    0,    0,    0,    0      ],
	[   0,    0,    0,    0,    0            ],
	[   0,    0,    0,    0                  ],
];

let grid = {};

for (let r = 0; r < matrix.length; r++) {
	grid[r] = {};
	for (let q = 0; q < matrix[r].length; q++) {
		if (matrix[r][q] == null) continue;

		let near = [
			grid[r-1] && grid[r-1][q] && grid[r-1][q].type,
			grid[r-1] && grid[r-1][q+1] && grid[r-1][q+1].type,
			grid[r][q-1] && grid[r][q-1].type,
		];

		let type;
		do {
			type = Math.random() * 6 | 0;
		} while (near.includes(type));

		grid[r][q] = { type };
	}
}


// wss.on('connection', (socket) => {
// 	socket.send(JSON.stringify(['grid-init', grid]));
// });

// io.on('connect', (socket) => {
// 	console.log(`connect: ${socket.id}`);
// 	socket.emit('grid-init', grid);
// 	socket.on('test', function(...args) {
// 		let ctx = this;
// 		console.log({ ctx, args });
// 	});
// });
