export const PI_2 = Math.PI / 2;
export const PI_4 = Math.PI / 4;
export const PI2 = Math.PI * 2;

export function calcArea(dir: number, rate: number) {
	dir = dir % PI_2;
	const upper = dir > PI_4;

	if (upper) {
		dir = PI_2 - dir;
		rate = -rate;
	}

	const q1x = Math.SQRT1_2 * Math.cos(dir + PI_4);
	const tant = Math.tan(dir);
	const cot2 = 1 / tant;
	let area = 0;

	if (rate > q1x) {
		area =
			(rate * (Math.sin(dir) + Math.cos(dir) - rate)) / Math.sin(2 * dir) +
			(-tant / 8 - cot2 / 8 + 3 / 4);
	} else if (rate < -q1x) {
		area =
			(rate * (-Math.sin(dir) + Math.cos(dir) + rate)) / Math.sin(2 * dir) +
			rate / Math.cos(dir) +
			(tant / 8 + cot2 / 8 + 1 / 4);
	} else {
		area = rate / Math.cos(dir) + 0.5;
	}

	return upper ? 1 - area : area;
}

export function matchArea(dir: number, area: number) {
	dir = dir % PI_2;
	const upper = dir > PI_4;

	if (upper) {
		dir = PI_2 - dir;
		area = 1 - area;
	}

	const tant_2 = Math.tan(dir) / 2;
	let rate = 0;

	if (area > 1 - tant_2) {
		rate =
			-Math.sqrt((1 - area) * Math.sin(2 * dir)) +
			Math.SQRT1_2 * Math.sin(dir + PI_4);
	} else if (area < tant_2) {
		rate =
			Math.sqrt(area * Math.sin(2 * dir)) - Math.SQRT1_2 * Math.sin(dir + PI_4);
	} else {
		rate = (area - 0.5) * Math.cos(dir);
	}

	return upper ? -rate : rate;
}
