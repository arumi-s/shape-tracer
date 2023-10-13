import { Polygon, Point, Vector, point, Utils } from "@flatten-js/core";

export function isCornerPoint(point: Point) {
	return Utils.EQ_0(point.x % 1) && Utils.EQ_0(point.y % 1);
}

export function mixPoints(
	aPoly: Polygon,
	bPoly: Polygon,
	a: Point,
	b: Point,
	aRel: Vector,
	bRel: Vector,
) {
	const aEdge = aPoly.findEdgeByPoint(a);
	const bEdge = bPoly.findEdgeByPoint(b);

	const aAbs = a.translate(aRel);
	const bAbs = b.translate(bRel);
	const aWeight = isCornerPoint(b) ? 0 : 1;
	const bWeight = isCornerPoint(a) ? 0 : 1;
	const totalWeight = aWeight + bWeight;
	if (totalWeight !== 0) {
		const mixed = point(
			(aWeight * aAbs.x + bWeight * bAbs.x) / totalWeight,
			(aWeight * aAbs.y + bWeight * bAbs.y) / totalWeight,
		);
		if (bWeight === 1) {
			a.x = mixed.x - aRel.x;
			a.y = mixed.y - aRel.y;
			aPoly.addVertex(a, aEdge);
			aPoly.removeEndVertex(aEdge);
		}
		if (aWeight === 1) {
			b.x = mixed.x - bRel.x;
			b.y = mixed.y - bRel.y;
			bPoly.addVertex(b, bEdge);
			bPoly.removeEndVertex(bEdge);
		}
	}
}
