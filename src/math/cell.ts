import { Vector, Polygon, Point, vector } from "@flatten-js/core";
import { isCornerPoint } from "./point";

export enum CellType {
	EMPTY,
	EDGE,
	CENTER,
}

export interface Cell {
	position: Vector;
	value: number;
	type: CellType;
	face: Vector;
	area: number;
	polygon: Polygon;
	mid?: Point;
}

export interface CellVertex {
	cell: Cell;
	rel: Point;
	abs: Point;
	dynamic: boolean;
}

export function getLeftPoint(cell: Cell, canBeCorner = false) {
	const angles = new WeakMap(
		cell.polygon.vertices.map((a) => [
			a,
			vector(a.x - 0.5, a.y - 0.5).angleTo(cell.face),
		]),
	);
	return cell.polygon.vertices
		.filter((c) => angles.get(c)! < Math.PI)
		.sort((a, b) => angles.get(b)! - angles.get(a)!)
		.find(
			(point) =>
				canBeCorner || cell.type === CellType.CENTER || !isCornerPoint(point),
		)!;
}
export function getRightPoint(cell: Cell, canBeCorner = false) {
	const angles = new WeakMap(
		cell.polygon.vertices.map((a) => [
			a,
			vector(a.x - 0.5, a.y - 0.5).angleTo(cell.face),
		]),
	);
	return cell.polygon.vertices
		.filter((c) => angles.get(c)! > Math.PI)
		.sort((a, b) => angles.get(a)! - angles.get(b)!)
		.find(
			(point) =>
				canBeCorner || cell.type === CellType.CENTER || !isCornerPoint(point),
		)!;
}
export function getClosestPoint(cell: Cell, target: Point) {
	const dists = new WeakMap(
		cell.polygon.vertices.map((a) => [
			a,
			a.translate(cell.position).distanceTo(target)[0],
		]),
	);

	return [...cell.polygon.vertices].sort(
		(a, b) => dists.get(a)! - dists.get(b)!,
	)[0];
}

export const EmptyCell: Cell = {
	position: vector(-1, -1),
	value: 0,
	type: CellType.EMPTY,
	face: vector(1, 0),
	polygon: new Polygon(),
	area: 0,
};
