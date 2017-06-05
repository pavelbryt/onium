'use strict';


let HTTP = require('http');
let Path = require('path');
let SocketIO = require('socket.io');
let URL = require('url');
let send = require('send');

let io = require('./lib/io');


const PORT = process.env.PORT || 9979;

const FILES = Object.assign(Object.create(null), {
	'/'                : Path.join(__dirname, 'public', 'index.html'),
	'/index.html'      : Path.join(__dirname, 'public', 'index.html'),
	'/index.css'       : Path.join(__dirname, 'public', 'index.css'),
	'/index.js'        : Path.join(__dirname, 'public', 'index.js'),
	'/vue.js'          : Path.join(__dirname, 'node_modules', 'vue', 'dist', 'vue.js'),
	'/vue.min.js'      : Path.join(__dirname, 'node_modules', 'vue', 'dist', 'vue.min.js'),
	'/socket.io.js'    : Path.join(__dirname, 'node_modules', 'socket.io-client', 'dist', 'socket.io.js'),
	'/socket.io.js.map': Path.join(__dirname, 'node_modules', 'socket.io-client', 'dist', 'socket.io.js.map'),
});


let server = HTTP.createServer((req, res) => {
	let { pathname } = URL.parse(req.url);
	let file = FILES[pathname];
	if (file) return send(req, file).pipe(res);
	res.statusCode = 404;
	res.end();
}).listen(PORT, () => console.log(PORT));


io.attach(server);
