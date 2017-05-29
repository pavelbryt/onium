'use strict';


let Koa = require('koa');
let KoaStaticCache = require('koa-static-cache');
let Path = require('path');
let SocketIO = require('socket.io');

let io = require('./lib/io');


const PUBLIC_DIR = Path.join(__dirname, 'public');
const VUE_DIR = Path.join(__dirname, 'node_modules', 'vue', 'dist');
const SOCKET_IO_DIR = Path.join(__dirname, 'node_modules', 'socket.io-client', 'dist');
const PORT = process.env.PORT || 9979;


let app = new Koa;
let server = app.listen(PORT, () => console.log(PORT));


io.attach(server);

app.use(KoaStaticCache(PUBLIC_DIR));
app.use(KoaStaticCache(VUE_DIR));
app.use(KoaStaticCache(SOCKET_IO_DIR));
