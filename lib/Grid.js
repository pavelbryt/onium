'use strict';


let maps = [
	[
		[ , , ,0,0,0,0],
		 [ , ,0,0,0,0,0],
		  [ ,0,0,0,0,0,0],
		   [0,0,0,0,0,0,0],
		    [0,0,0,0,0,0  ],
		     [0,0,0,0,0    ],
		      [0,0,0,0      ],
	],
	[
		[ , , ,0,0,0,0],
		 [ , ,0,0,0,0,0],
		  [ ,0,0,0,0,0,0],
		   [0,0,0, ,0,0,0],
		    [0,0,0,0,0,0  ],
		     [0,0,0,0,0    ],
		      [0,0,0,0      ],
	],
	[
		[ , , , , , , ,0],
		 [ , , , , , ,0,0],
		  [ , , , , ,0,0,0],
		   [ , , , ,0,0,0,0],
		    [ , , ,0,0,0,0,0],
		     [ , ,0,0,0,0,0,0],
		      [ ,0,0,0,0,0,0,0],
		       [0,0,0,0,0,0,0,0],
	],
	[
		[ , , , , , , ,0],
		 [ , , , , , ,0,0],
		  [ , , , , ,0,0,0],
		   [ , , , ,0,0,0,0],
		    [ , , ,0,0, ,0,0],
		     [ , ,0,0,0,0,0,0],
		      [ ,0,0,0,0,0,0,0],
		       [0,0,0,0,0,0,0,0],
	],
	// [
	// 	[0,0,0, , , ,0,0],
	// 	 [0,0,0, , ,0,0,0],
	// 	  [0,0,0, ,0,0,0,0],
	// 	   [0,0,0,0,0,0,0,0],
	// 	    [0,0,0,0,0,0,0,0],
	// 	     [0,0,0,0, ,0,0,0],
	// 	      [0,0,0, , ,0,0,0],
	// ],
	// [
	// 	[ , , , ,0,0,0,0,0],
	// 	 [ , , ,0,0,0,0,0,0],
	// 	  [ , ,0,0,0,0,0,0,0],
	// 	   [ ,0,0,0, , ,0,0,0],
	// 	    [0,0,0, , , ,0,0,0],
	// 	     [0,0,0, , ,0,0,0  ],
	// 	      [0,0,0,0,0,0,0    ],
	// 	       [0,0,0,0,0,0      ],
	// 	        [0,0,0,0,0        ],
	// ],
];



class Grid extends Array {
	constructor() {
		let map = maps[Math.random() * maps.length | 0];

		super(map.length);

		this._hexAt = this.hexAt.bind(this);
		this._clear = this.clear.bind(this);
		this._fill  = this.fill .bind(this);

		let i = 0;
		let coords = Array(2);

		for (let r = 0; r < map.length; r++) {
			let mapRow = map[r];
			if (!mapRow) continue;
			coords[0] = r;
			let row = this[r] = Array(mapRow.length);
			for (let q = 0; q < mapRow.length; q++) {
				if (mapRow[q] == null) continue;
				coords[1] = q;
				let type;
				let prev = this.prevNeighborsCoordsOf(coords).map(this._hexAt);
				do {
					type = Math.random() * 6 | 0;
				} while (prev.some(h => h.type == type));
				row[q] = { type, key: i++ };
			}
		}
	}


	hexAt([r, q]) {
		return this[r] && this[r][q];
	}


	setHex([r, q], hex) {
		return (this[r] || (this[r] = Array(q+1)))[q] = hex;
	}


	prevNeighborsCoordsOf([r, q]) {
		return [
			[r  , q-1],
			[r-1, q  ],
			[r-1, q+1],
		].filter(this._hexAt);
	}


	nextNeighborsCoordsOf([r, q]) {
		return [
			[r  , q+1],
			[r+1, q  ],
			[r+1, q-1],
		].filter(this._hexAt);
	}


	neighborsCoordsOf(coords) {
		return this.prevNeighborsCoordsOf(coords)
			.concat(this.nextNeighborsCoordsOf(coords));
	}


	// prevNeighborsOf(r, q) {
	// 	return [
	// 		this.hexAt(r  , q-1),
	// 		this.hexAt(r-1, q  ),
	// 		this.hexAt(r-1, q+1),
	// 	].filter(Boolean);
	// }


	// nextNeighborsOf(r, q) {
	// 	return [
	// 		this.hexAt(r  , q+1),
	// 		this.hexAt(r+1, q  ),
	// 		this.hexAt(r+1, q-1),
	// 	].filter(Boolean);
	// }


	// neighborsOf(r, q) {
	// 	return this.getPrevNeighbors(r, q).concat(this.getNextNeighbors(r, q));
	// }


	rotate(coords, reverse = false) {
		if (!this.hexAt(coords)) return false;
		let neighborsCoords = this.neighborsCoordsOf(coords);
		if (neighborsCoords.length != 6) return false;
		if (reverse) neighborsCoords.reverse();
		let neighbors = neighborsCoords.map(this._hexAt);

		for (let i = 0; i < 6; i++) {
			this.setHex(neighborsCoords[i], neighbors[i+1]);
		}

		this.setHex(neighborsCoords[5], neighbors[0]);

		return true;
	}


	findGroups() {
		let checked = new Set();
		let groups = [];

		let search = (coords, type) => {
			let hex = this.hexAt(coords);
			if (!hex || type != hex.type) return [];
			if (checked.has(hex)) return [];
			checked.add(hex);
			let neighborsCoords = this.neighborsCoordsOf(coords);
			let neighborsResults = neighborsCoords.map((c) => search(c, type));
			return [hex].concat(...neighborsResults);
		};

		for (let coords = Array(2), r = 0; r < this.length; r++) {
			coords[0] = r;
			let row = this[r];
			for (let q = 0; q < row.length; q++) {
				coords[1] = q;
				let hex = this.hexAt(coords);
				if (!hex) continue;
				let group = search(coords, hex.type);
				if (group.length) groups.push(group);
			}
		}

		return groups;
	}


	clear(coords) {
		this.setHex(coords, null);
	}


	fill(coords) {
		return this.setHex(coords, { type: Math.random() * 6 | 0 });
	}
}


module.exports = Grid;
