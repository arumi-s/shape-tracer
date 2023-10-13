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
	{#if src !== ""}
		<ShapeTracer {src} />
	{/if}
</main>

<style>
</style>
