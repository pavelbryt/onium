'use strict';


let map = [
	[ , , ,0,0,0,0],
	 [ , ,0,0,0,0,0],
	  [ ,0,0,0,0,0,0],
	   [0,0,0,0,0,0,0],
	    [0,0,0,0,0,0  ],
	     [0,0,0,0,0    ],
	      [0,0,0,0      ],
].reduce((map, row, r) => {
	for (let q = 0; q < row.length; q++) {
		if (row[q] == null) continue;
		map.push({ r, q });
	}
	return map;
}, []);



class Grid extends Array {
	static create() {
		let grid = new this(map.length);

		for (let i = 0; i < map.length; i++) {
			grid[i] = Object.assign({ color: -2 }, map[i]);
		}

		grid
			.sort(() => Math.random() - .5)
			.forEach(hex => grid.fill(hex));

		return grid;
	}


	hexAt(r, q) {
		return this.find(hex => hex.r == r && hex.q == q);
	}


	neighborsOf({ r, q }) {
		return [
			this.hexAt(r  , q-1),
			this.hexAt(r-1, q  ),
			this.hexAt(r-1, q+1),
			this.hexAt(r  , q+1),
			this.hexAt(r+1, q  ),
			this.hexAt(r+1, q-1),
		].filter(Boolean);
	}


	rotate(r, q, reverse = false) {
		let hex = this.hexAt(r, q);
		if (!hex) return false;
		let neighbors = this.neighborsOf(hex);
		if (neighbors.length != 6) return false;
		if (reverse) neighbors.reverse();

		let { r: nr, q: nq } = neighbors[5];

		for (let i = 5; i; i--) {
			neighbors[i].r = neighbors[i-1].r;
			neighbors[i].q = neighbors[i-1].q;
		}

		neighbors[0].r = nr;
		neighbors[0].q = nq;

		return true;
	}


	groupOf(hex) {
		let { color } = hex;
		if (color < 0) return null;

		let group = new Set();

		let search = (hex) => {
			if (hex.color && color != hex.color) return;
			if (group.has(hex)) return;
			group.add(hex);
			let neighbors = this.neighborsOf(hex);
			neighbors.forEach(search);
		};

		search(hex);

		return group;
	}


	allGroups() {
		return this.reduce((groups, hex) => {
			if (groups.some((group) => group.has(hex))) return groups;
			let group = this.groupOf(hex);
			if (group) groups.push(group);
			return groups;
		}, []);
	}


	fill(hex) {
		let colors = [0, 1, 2, 3, 4, 5, 6];
		for (;;) {
			let { length } = colors;
			if (length) {
				let i = Math.random() * length | 0;
				hex.color = colors.splice(i, 1)[0];
			} else {
				hex.color = -1;
				break;
			}
			if (hex.color == 0) {
				if (this.some((h) => h != hex && h.color == 0)) {
					continue;
				}
				let groups = this.allGroups();
				if (groups.every((g) => g.size < 3)) break;
			} else {
				if (this.groupOf(hex).size < 3) break;
			}
		}
	}
}


module.exports = Grid;
