<script lang="ts">
	import ShapeTracer from "./lib/ShapeTracer.svelte";

	let src: string = "./tests/heart.png";

	async function selectFile(file: File) {
		src = URL.createObjectURL(await new Response(file).blob());
	}
</script>

<main
	class="w-full h-full"
	on:dragover|preventDefault
	on:drop|preventDefault={(event) => {
		if (event instanceof DragEvent && event.dataTransfer?.items) {
			const imageItem = [...event.dataTransfer.items].find(
				(item) => item.kind === "file" && item.type.startsWith("image/"),
			);
			if (imageItem == null) return;

			const imageFile = imageItem.getAsFile();
			if (imageFile == null) return;

			selectFile(imageFile);
		}
	}}
>
	<div class="fixed left-0 top-0 z-10 bg-white/80 p-4 flex flex-col gap-2">
		<a class="text-lg" href="./">Shape Tracer</a>
		<a
			class="text-sm text-blue-500 hover:text-blue-700 hover:underline"
			href="https://github.com/arumi-s/shape-tracer"
			target="_blank"
			rel="noopener noreferrer">Github</a
		>
		<hr class="border-neutral-400" />
		<a
			class="text-sm text-blue-500 hover:text-blue-700 hover:underline"
			href="https://yqnn.github.io/svg-path-editor/"
			target="_blank"
			rel="noopener noreferrer">SvgPathEditor</a
		>
		<a
			class="text-sm text-blue-500 hover:text-blue-700 hover:underline"
			href="https://jakearchibald.github.io/svgomg/"
			target="_blank"
			rel="noopener noreferrer">SVGOMG</a
		>
	</div>
	{#if src !== ""}
		<ShapeTracer {src} />
	{/if}
</main>

<style>
</style>
