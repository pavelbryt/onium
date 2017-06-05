'use strict';


class Player {
	constructor({
		socket,
		name,
		color,
	}) {
		Object.defineProperties(this, {
			socket: { value: socket, writable: true },
		});

		Object.assign(this, {
			name,
			color,
			points: 0,
		});
	}
}


module.exports = Player;
