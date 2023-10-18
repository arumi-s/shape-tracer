export function loadImage(src: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = document.createElement("img");

		image.onload = () => {
			resolve(image);
		};
		image.onerror = (_, _a, _b, _c, error) => {
			reject(error);
		};
		image.src = src;
	});
}
