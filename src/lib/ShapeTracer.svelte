<script lang="ts">
	import {
		BooleanOperations,
		Polygon,
		Segment,
		Vector,
		vector,
		Utils,
		Point,
	} from "@flatten-js/core";
	import copy from "copy-to-clipboard";
	import ScaledView from "./ScaledView.svelte";
	import { PI2, calcArea, matchArea } from "../math/area";
	import { type Cell, CellType, type CellVertex } from "../math/cell";
	import {
		printPolygon,
		createOuterPolygon,
		clipPolygon,
		boundPolygon,
		smoothPolygon,
		fixPolygon,
		clipPolygonAt,
		curvePolygon,
		type Curve,
		type DegenerateCurve,
	} from "../math/polygon";
	import { isCornerPoint, mixPoints } from "../math/point";
	import { eachCell, eachNeighbour, type Grid } from "../math/grid";

	export let src: string;

	let useTransparency = true;
	let keepMidPoint = true;
	let centerThreshold = 0.99;
	let emptyThreshold = 0.02;
	let nearAngleThreshold = 10;
	let smoothThreshold = 0.5;
	let lowerAngleBound = 1;
	let upperAngleBound = 20;

	try {
		const data = JSON.parse(localStorage.getItem("options") ?? "");
		if ("useTransparency" in data) useTransparency = data.useTransparency;
		if ("keepMidPoint" in data) keepMidPoint = data.keepMidPoint;
		if ("centerThreshold" in data) centerThreshold = data.centerThreshold;
		if ("emptyThreshold" in data) emptyThreshold = data.emptyThreshold;
		if ("nearAngleThreshold" in data)
			nearAngleThreshold = data.nearAngleThreshold;
		if ("smoothThreshold" in data) smoothThreshold = data.smoothThreshold;
		if ("lowerAngleBound" in data) lowerAngleBound = data.lowerAngleBound;
		if ("upperAngleBound" in data) upperAngleBound = data.upperAngleBound;
	} catch (_: unknown) {}

	$: {
		localStorage.setItem(
			"options",
			JSON.stringify({
				useTransparency,
				keepMidPoint,
				centerThreshold,
				emptyThreshold,
				nearAngleThreshold,
				smoothThreshold,
				lowerAngleBound,
				upperAngleBound,
			}),
		);
	}

	let image: HTMLImageElement;

	let grid: Grid = {
		width: 0,
		height: 0,
		cells: [],
	};

	let combinedPolygon: Polygon | null = null;
	let shapePath = "";

	function handleImageLoad() {
		triggerBuildGrid++;
	}

	function processBuildGrid() {
		const width = image.width;
		const height = image.height;

		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d")!;
		if (!useTransparency) {
			context.fillStyle = "#fff";
			context.fillRect(0, 0, width, height);
		}
		context.drawImage(image, 0, 0);
		const imageData = context.getImageData(0, 0, width, height).data;

		const values: number[] = [];
		for (let index = 0; index < imageData.length; index += 4) {
			const colorR = imageData[index];
			const colorG = imageData[index + 1];
			const colorB = imageData[index + 2];
			const colorA = imageData[index + 3];
			values[index >> 2] = useTransparency
				? colorA / 255
				: 1 - (0.299 * colorR + 0.587 * colorG + 0.114 * colorB) / 255;
		}

		grid = {
			width,
			height,
			cells: values.map(
				(value, index) =>
					({
						position: vector(index % width, Math.floor(index / width)),
						value,
					}) as Cell,
			),
		};
		triggerDetectCategory++;
	}
	function processDetectCategory() {
		eachCell(grid, (cell) => {
			if (cell.value > centerThreshold) {
				cell.type = CellType.CENTER;
			} else if (cell.value < emptyThreshold) {
				cell.type = CellType.EMPTY;
			} else {
				cell.type = CellType.EDGE;
			}
		});
		triggerDetectFacing++;
	}
	function processDetectFacing() {
		eachCell(grid, (cell) => {
			if (cell.type === CellType.EDGE || cell.type === CellType.CENTER) {
				let vectorSum = vector(0, 0);
				eachNeighbour(grid, cell, (kernelCell, kernelX, kernelY) => {
					vectorSum = vectorSum.add(
						vector(kernelX, kernelY).normalize().multiply(kernelCell.value),
					);
				});
				try {
					cell.face = vectorSum.normalize();
				} catch (_: unknown) {
					cell.face = vector(1, 0);
				}
			}
		});
		triggerSmoothFacing++;
	}
	function processSmoothFacing() {
		const average = new WeakMap<Cell, Vector>();
		const nearThreshold = Math.cos((Math.PI * nearAngleThreshold) / 180);
		eachCell(grid, (cell) => {
			if (cell.type === CellType.EDGE) {
				let vectorSum = cell.face;
				eachNeighbour(grid, cell, (kernelCell) => {
					if (kernelCell.type === CellType.EDGE) {
						if (
							Math.min(1, Math.abs(cell.face.dot(kernelCell.face))) >
							nearThreshold
						) {
							vectorSum = vectorSum.add(kernelCell.face);
						}
					}
				});
				average.set(cell, vectorSum.normalize());
			}
		});
		eachCell(grid, (cell) => {
			if (cell.type === CellType.EDGE) {
				cell.face = average.get(cell)!;
			}
		});
		triggerMatchArea++;
	}
	function processMatchArea() {
		eachCell(grid, (cell) => {
			if (cell.type === CellType.EDGE) {
				const dir = Math.atan2(cell.face.y, cell.face.x) + PI2;
				const rate = matchArea(dir, cell.value);

				const [outerPolygon, mid] = createOuterPolygon(dir, rate, keepMidPoint);
				const intersectPolygon = clipPolygon(outerPolygon);

				if (keepMidPoint) cell.mid = mid;
				cell.polygon = intersectPolygon;
				cell.area = calcArea(dir, rate);
			} else if (cell.type === CellType.CENTER) {
				cell.polygon = boundPolygon;
				cell.area = 1;
			}
		});
		triggerJoinVertex++;
	}
	function processJoinVertex() {
		const vertices: CellVertex[] = [];
		eachCell(grid, (cell) => {
			if (cell.type === CellType.EDGE || cell.type === CellType.CENTER) {
				for (const rel of cell.polygon.vertices) {
					if (cell.mid && rel.equalTo(cell.mid)) continue;
					vertices.push({
						cell,
						rel,
						abs: rel.translate(cell.position),
						dynamic: !isCornerPoint(rel),
					});
				}
			}
		});

		const nearestMap = new WeakMap<CellVertex, CellVertex>();
		for (const vertex of vertices) {
			if (!vertex.dynamic) continue;

			let nearest: [number, CellVertex | null] = [1, null];
			let fallbackNearest: [number, CellVertex | null] = [1, null];
			const neighbourStaticVertext = vertices.filter(
				(v) =>
					!v.dynamic &&
					Math.hypot(v.abs.x - vertex.abs.x, v.abs.y - vertex.abs.y) <= 1,
			);
			for (const search of vertices) {
				if (
					search === vertex ||
					(!Utils.EQ(search.abs.x, vertex.abs.x) &&
						!Utils.EQ(search.abs.y, vertex.abs.y))
				)
					continue;
				const dist =
					(search.dynamic ? 0 : 0.5) +
					Math.hypot(vertex.abs.x - search.abs.x, vertex.abs.y - search.abs.y);
				if (dist <= nearest[0]) {
					const segment = new Segment(vertex.abs, search.abs);
					if (!neighbourStaticVertext.some((v) => segment.contains(v.abs))) {
						nearest = [dist, search];
					}
				}
				if (dist <= fallbackNearest[0]) {
					fallbackNearest = [dist, search];
				}
			}
			const realNearest = nearest[1] ?? fallbackNearest[1];
			if (realNearest) {
				nearestMap.set(vertex, realNearest);

				if (realNearest.dynamic) {
					const segment = new Segment(vertex.abs, realNearest.abs);
					const closerStaticVertext = neighbourStaticVertext.find((v) =>
						segment.contains(v.abs),
					);
					if (closerStaticVertext) {
						nearestMap.set(vertex, closerStaticVertext);
					}
				}
			}
		}

		const links: [CellVertex, CellVertex][] = [];
		const linked = new WeakSet<CellVertex>();
		for (const vertex of vertices) {
			if (!vertex.dynamic || !nearestMap.has(vertex)) continue;

			const nearest = nearestMap.get(vertex)!;
			if (nearest.dynamic) {
				if (!linked.has(vertex) && nearestMap.get(nearest) === vertex) {
					links.push([vertex, nearest]);
					linked.add(vertex);
					linked.add(nearest);
				}
			} else {
				links.push([vertex, nearest]);
				linked.add(vertex);
			}
		}

		for (const [vertexA, vertexB] of links) {
			mixPoints(
				vertexA.cell.polygon,
				vertexB.cell.polygon,
				vertexA.rel,
				vertexB.rel,
				vertexA.cell.position,
				vertexB.cell.position,
			);
		}

		eachCell(grid, (cell) => {
			if (cell.type === CellType.EDGE) {
				cell.polygon = fixPolygon(cell.polygon);

				if (Utils.EQ_0(cell.polygon.area())) {
					cell.type = CellType.EMPTY;
					cell.polygon = undefined!;
				}
			}
		});

		triggerUnifyShape++;
	}
	function processUnifyShape() {
		let polygon = new Polygon();
		eachCell(grid, (cell) => {
			if (cell.polygon) {
				try {
					polygon = BooleanOperations.unify(
						polygon,
						cell.polygon.translate(cell.position),
					);
				} catch (error: unknown) {
					console.log(error);
				}
			}
		});

		combinedPolygon = polygon;
		triggerSmoothShape++;
	}
	let shapes: ReturnType<typeof curvePolygon> = [];
	function processSmoothShape() {
		const finalPolygon = smoothPolygon(combinedPolygon!, smoothThreshold);

		shapes = curvePolygon(finalPolygon, lowerAngleBound, upperAngleBound);

		shapePath = printPolygon(finalPolygon);

		eachCell(grid, (cell) => {
			if (cell.type === CellType.EDGE) {
				try {
					cell.area = clipPolygonAt(finalPolygon, cell.position).area();
				} catch (_: unknown) {}
			}
		});
	}
	function printBezier(
		curves: (Curve | DegenerateCurve)[] | Readonly<(Curve | DegenerateCurve)[]>,
	) {
		return curves
			.map(
				(b, i) =>
					(i === 0 ? `M${b[0].x} ${b[0].y} ` : "") +
					(b.length === 4
						? `C${b[1].x} ${b[1].y} ${b[2].x} ${b[2].y} ${b[3].x} ${b[3].y}`
						: `L${b[1].x} ${b[1].y}`),
			)
			.join(" ");
	}

	let points: Point[] = [];

	let triggerBuildGrid = 0;
	let triggerDetectCategory = 0;
	let triggerDetectFacing = 0;
	let triggerSmoothFacing = 0;
	let triggerMatchArea = 0;
	let triggerJoinVertex = 0;
	let triggerUnifyShape = 0;
	let triggerSmoothShape = 0;

	$: {
		if (triggerBuildGrid) {
			useTransparency;
			processBuildGrid();
		}
	}
	$: {
		if (grid.width > 0 && grid.height > 0 && triggerDetectCategory) {
			centerThreshold;
			emptyThreshold;
			processDetectCategory();
		}
	}
	$: {
		if (triggerDetectFacing) {
			processDetectFacing();
		}
	}
	$: {
		if (triggerSmoothFacing) {
			nearAngleThreshold;
			processSmoothFacing();
		}
	}
	$: {
		if (triggerMatchArea) {
			keepMidPoint;
			processMatchArea();
		}
	}
	$: {
		if (triggerJoinVertex) {
			processJoinVertex();
		}
	}
	$: {
		if (triggerUnifyShape) {
			processUnifyShape();
		}
	}
	$: {
		if (combinedPolygon && triggerSmoothShape) {
			smoothThreshold;
			lowerAngleBound;
			upperAngleBound;
			processSmoothShape();
		}
	}

	function randomFillColor(i: number) {
		const colors = [
			"fill-sky-500",
			"fill-red-500",
			"fill-lime-500",
			"fill-orange-500",
			"fill-indigo-500",
		];
		return colors[i % colors.length];
	}
	function randomStrokeColor(i: number) {
		const colors = [
			"stroke-sky-500",
			"stroke-red-500",
			"stroke-lime-500",
			"stroke-orange-500",
			"stroke-indigo-500",
		];
		return colors[(i + 1) % colors.length];
	}
</script>

<div class="fixed right-0 top-0 z-10">
	<div class="bg-white/80 p-4 flex flex-col gap-2">
		<label class="space-y-1">
			<div class="font-bold">useTransparency</div>
			<input
				class="py-1 px-2"
				type="checkbox"
				name="useTransparency"
				id="useTransparency"
				bind:checked={useTransparency}
			/>
		</label>
		<label class="space-y-1">
			<div class="font-bold">keepMidPoint</div>
			<input
				class="py-1 px-2"
				type="checkbox"
				name="keepMidPoint"
				id="keepMidPoint"
				bind:checked={keepMidPoint}
			/>
		</label>
		<label class="space-y-1">
			<div class="font-bold">centerThreshold</div>
			<input
				class="w-32 py-1 px-2"
				type="number"
				name="centerThreshold"
				id="centerThreshold"
				bind:value={centerThreshold}
				min="0"
				max="1"
				step="0.01"
			/>
		</label>
		<label class="space-y-1">
			<div class="font-bold">emptyThreshold</div>
			<input
				class="w-32 py-1 px-2"
				type="number"
				name="emptyThreshold"
				id="emptyThreshold"
				bind:value={emptyThreshold}
				min="0"
				max="1"
				step="0.01"
			/>
		</label>
		<label class="space-y-1">
			<div class="font-bold">nearAngleThreshold</div>
			<input
				class="w-32 py-1 px-2"
				type="number"
				name="nearAngleThreshold"
				id="nearAngleThreshold"
				bind:value={nearAngleThreshold}
				min="0"
				max="90"
				step="1"
			/>
		</label>
		<label class="space-y-1">
			<div class="font-bold">smoothThreshold</div>
			<input
				class="w-32 py-1 px-2"
				type="number"
				name="smoothThreshold"
				id="smoothThreshold"
				bind:value={smoothThreshold}
				min="0"
				max="32"
				step="0.05"
			/>
		</label>
		<label class="space-y-1">
			<div class="font-bold">lowerAngleBound</div>
			<input
				class="w-32 py-1 px-2"
				type="number"
				name="lowerAngleBound"
				id="lowerAngleBound"
				bind:value={lowerAngleBound}
				min="0"
				max="90"
				step="1"
			/>
		</label>
		<label class="space-y-1">
			<div class="font-bold">upperAngleBound</div>
			<input
				class="w-32 py-1 px-2"
				type="number"
				name="upperAngleBound"
				id="upperAngleBound"
				bind:value={upperAngleBound}
				min="0"
				max="90"
				step="1"
			/>
		</label>
		<hr class="border-neutral-400" />
		<button
			class="border bg-neutral-400 py-1 px-2 hover:bg-neutral-500 active:scale-95 transition-all"
			on:click={() => {
				copy(shapePath);
			}}>Copy Path</button
		>
		<button
			class="border bg-neutral-400 py-1 px-2 hover:bg-neutral-500 active:scale-95 transition-all"
			on:click={() => {
				copy(
					shapes
						.map(
							(shape) =>
								printBezier(shape.flatMap((section) => section.curve)) + "Z",
						)
						.join(" "),
				);
			}}>Copy Curve</button
		>
	</div>
</div>
<ScaledView>
	<div
		class="grid border-white/50 [&>*]:row-start-1 [&>*]:col-start-1 xscale-[2.5] origin-bottom-left"
	>
		<img
			class="pointer-events-none"
			{src}
			alt="target"
			bind:this={image}
			on:load={handleImageLoad}
		/>
		<svg width={grid.width} height={grid.height}>
			<g>
				{#each grid.cells as cell, i (i)}
					{#if cell.type !== CellType.EMPTY}
						<g transform="translate({cell.position.x}, {cell.position.y})">
							<path class="fill-blue-500/50" d={printPolygon(cell.polygon)} />
							{#if cell.type === CellType.EDGE}
								<path
									class="stroke-white/0 stroke-[0.05]"
									d="M .5 .5 L {cell.face.x + 0.5} {cell.face.y + 0.5}"
								/>
								<text
									class="fill-yellow-500"
									x={0.5}
									y={0.5}
									font-size="0.33"
									text-anchor="middle"
									dominant-baseline="middle"
									>{Math.round((cell.area ?? 0) * 100)}/{Math.round(
										cell.value * 100,
									)}</text
								>
							{/if}
						</g>
					{/if}
				{/each}
			</g>
			<g>
				<path class="fill-yellow-200/50" d={shapePath} />
			</g>
			<g class="fill-red-500">
				{#each points as point}
					<circle cx={point.x} cy={point.y} r="0.1" />
				{/each}
			</g>
			{#each shapes as sections}
				{#each sections as section, i}
					<g>
						{#each section.chain as point}
							<circle
								class={randomFillColor(i)}
								cx={point.x}
								cy={point.y}
								r="0.1"
							/>
						{/each}
						<path
							class="{randomStrokeColor(i)} stroke-[0.05] fill-none"
							d={printBezier(section.curve)}
						/>
					</g>
				{/each}
			{/each}
		</svg>
	</div>
</ScaledView>

<style lang="postcss">
	img {
		image-rendering: pixelated;
	}
</style>
