'use strict';


let base64id = require('base64id');


class Player {
	constructor({
		socket,
		name,
	}) {
		let token = base64id.generateId();

		Object.defineProperties(this, {
			token: { value: token },
			socket: { value: socket, writable: true },
		});

		Object.assign(this, {
			name,
			points: 0,
			online: !!this.socket,
		});
	}
}


module.exports = Player;
