'use strict';


class Grid {
	constructor() {
		let matrix = [
			[    ,     ,     ,    0,    0,    0,    0],
			[    ,     ,    0,    0,    0,    0,    0],
			[    ,    0,    0,    0,    0,    0,    0],
			[   0,    0,    0,    0,    0,    0,    0],
			[   0,    0,    0,    0,    0,    0      ],
			[   0,    0,    0,    0,    0            ],
			[   0,    0,    0,    0                  ],
		];

		let grid = this;
		let key = 0;

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

				grid[r][q] = { type, r, q, key };
				key++;
			}
		}
	}
}


module.exports = Grid;
