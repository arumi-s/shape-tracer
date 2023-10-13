import { type Cell, EmptyCell } from "./cell";

export interface Grid {
	width: number;
	height: number;

	cells: Cell[];
}

export function cellAt(grid: Grid, x: number, y: number) {
	if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return EmptyCell;
	return grid.cells[y * grid.width + x];
}

export function eachCell(grid: Grid, callback: (cell: Cell) => void) {
	grid.cells.map(callback);
}
export function eachNeighbour(
	grid: Grid,
	center: Cell,
	callback: (cell: Cell, x: number, y: number) => void,
) {
	const x = center.position.x;
	const y = center.position.y;
	for (let kernelY = -1; kernelY <= 1; kernelY++) {
		for (let kernelX = -1; kernelX <= 1; kernelX++) {
			if (kernelY === 0 && kernelX === 0) continue;
			callback(cellAt(grid, x + kernelX, y + kernelY), kernelX, kernelY);
		}
	}
}
