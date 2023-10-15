import {
	point,
	Polygon,
	BooleanOperations,
	Edge,
	Face,
	Segment,
	Utils,
	Vector,
	Point,
} from "@flatten-js/core";
import simplify from "simplify-js";
import { fitCurve } from "@odiak/fit-curve";

export const boundPolygon = new Polygon([
	point(0, 0),
	point(1, 0),
	point(1, 1),
	point(0, 1),
]);

export function createOuterPolygon(
	dir: number,
	rate: number,
	keepMidPoint = true,
) {
	const p0 = point(0.5 - rate * Math.cos(dir), 0.5 - rate * Math.sin(dir));
	const p1 = point(
		p0.x + Math.cos(dir - Math.PI / 2),
		p0.y + Math.sin(dir - Math.PI / 2),
	);
	const p2 = point(p1.x + 2 * Math.cos(dir), p1.y + 2 * Math.sin(dir));
	const p3 = point(
		p2.x + 2 * Math.cos(dir + Math.PI / 2),
		p2.y + 2 * Math.sin(dir + Math.PI / 2),
	);
	const p4 = point(
		p3.x + 2 * Math.cos(dir + Math.PI),
		p3.y + 2 * Math.sin(dir + Math.PI),
	);

	return [
		keepMidPoint
			? new Polygon([p0, p1, p2, p3, p4])
			: new Polygon([p1, p2, p3, p4]),
		p0,
	] as const;
}

export function clipPolygon(polygon: Polygon) {
	return BooleanOperations.intersect(boundPolygon, polygon);
}

export function clipPolygonAt(polygon: Polygon, translate: Vector) {
	return BooleanOperations.intersect(
		boundPolygon.translate(translate),
		polygon,
	);
}

export function printPolygon(polygon: Polygon) {
	let path = "";
	for (const face of polygon.faces) {
		path += face.svg();
	}
	return path;
}

export function smoothPolygon(polygon: Polygon, threshold = 1) {
	polygon = polygon.clone();
	const edgeAreaMap = new WeakMap<Edge, number>();

	let smallestArea: number;
	let smallestEdges: Edge[] = [];

	while (true) {
		smallestArea = Infinity;
		smallestEdges = [];

		for (const face of polygon.faces) {
			if (face instanceof Face) {
				let edge = face.first;
				while (edge !== face.last) {
					if (
						edge.shape instanceof Segment &&
						edge.prev.shape instanceof Segment
					) {
						let area = edgeAreaMap.get(edge);
						if (area == null) {
							area = new Polygon([
								edge.prev.shape.ps,
								edge.shape.ps,
								edge.shape.pe,
							]).area();
							edgeAreaMap.set(edge, area);
						}

						if (Utils.EQ(area, smallestArea)) {
							smallestEdges.push(edge);
						} else if (area < smallestArea) {
							smallestEdges = [edge];
							smallestArea = area;
						}
					}
					edge = edge.next;
				}
			}
		}

		if (smallestEdges.length && smallestArea <= threshold) {
			for (const smallestEdge of smallestEdges) {
				edgeAreaMap.delete(smallestEdge.prev);
				edgeAreaMap.delete(smallestEdge.next);
				polygon.removeEndVertex(smallestEdge.prev);
			}
		} else break;
	}

	for (const face of polygon.faces) {
		if (Utils.EQ_0(face.area())) polygon.deleteFace(face);
	}

	return polygon;
}

export function simplifyPolygon(polygon: Polygon, threshold = 1) {
	const newPolygon = new Polygon();

	for (const face of polygon.faces) {
		if (face instanceof Face) {
			newPolygon.addFace(
				simplify(face.toPolygon().vertices, threshold, true).map((p) =>
					point(p.x, p.y),
				),
			);
		}
	}

	return newPolygon;
}

export function fixPolygon(polygon: Polygon) {
	for (const face of polygon.faces) {
		if (!(face instanceof Face)) continue;

		let edge = face.first;
		while (edge !== face.last) {
			if (edge.shape instanceof Segment && edge.prev.shape instanceof Segment) {
				const prev = edge.prev.shape.ps;
				const start = edge.shape.ps;
				const end = edge.shape.pe;

				const triangle = new Polygon([prev, start, end]);
				const area = triangle.area();

				if (Utils.EQ_0(area)) {
					polygon.removeEndVertex(edge.prev);
				}
			}
			edge = edge.next;
		}
	}
	for (const face of polygon.faces) {
		if (face instanceof Face && face.isEmpty()) polygon.deleteFace(face);
	}

	return polygon;
}

export function findCurvePoints(
	face: Face,
	minCurveAngle = 1,
	maxCurveAngle = 20,
) {
	const lowerThreshold = Math.cos((Math.PI * minCurveAngle) / 180);
	const upperThreshold = Math.cos((Math.PI * maxCurveAngle) / 180);
	let start = face.first;
	let restarted = false;
	let restarting = false;

	const chains: Point[][] = [];
	let chain: Point[] = [];
	let lastVector: Vector | null = null;
	let edge = start;
	do {
		if (edge.shape instanceof Segment) {
			const currentVector = edge.shape.tangentInStart();
			if (lastVector == null) {
				chain.push(edge.shape.ps);
				chain.push(edge.shape.pe);
				lastVector = currentVector;
				edge = edge.next;
				continue;
			}
			const turned = Math.min(1, Math.abs(lastVector.dot(currentVector)));
			if (turned > upperThreshold && turned < lowerThreshold) {
				chain.push(edge.shape.pe);
				lastVector = currentVector;
				edge = edge.next;
				continue;
			}
		}
		if (!restarted) {
			restarted = true;
			restarting = true;
			start = edge;
		} else if (chain.length > 0) chains.push(chain);
		chain = [];
		lastVector = null;
	} while (
		edge !== start ||
		(restarting ? ((restarting = false), true) : false)
	);

	if (chain.length > 0) chains.push(chain);

	return chains;
}

export type Curve = ReturnType<typeof fitCurve>[number];
export type DegenerateCurve = [Curve[0], Curve[0]];

export function curvePolygon(
	polygon: Polygon,
	minCurveAngle = 1,
	maxCurveAngle = 20,
	maxCurveError = 0.01,
) {
	return [...polygon.faces].map((face) =>
		findCurvePoints(face, minCurveAngle, maxCurveAngle).map((chain) => ({
			chain,
			curve: (chain.length === 2
				? [[chain[0], chain[1]]]
				: fitCurve(chain, maxCurveError)) as Readonly<
				(Curve | DegenerateCurve)[]
			>,
		})),
	);
}
