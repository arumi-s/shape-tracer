# Space Tracer

I always wanted a controllable tool for tracing bitmap images into svg paths

## Mechanism

### BuildGrid

- build a grid of cells, 1 cell is 1 pixel
- get each cell's supposed filled rate from the pixel brightness or transparency

### DetectCategory

- categorize each cell into `center cell` (filled rate > 98%), `empty cell` (filled rate < 2%), `edge cell` (any thing between)
- thresholds can be configured separately

### DetectFacing

- detect a general facing direction for each `edge cell` by averaging it's neighbours

### SmoothFacing

- average facing direction for each `edge cell` with it's neighbours having similar angles

### MatchArea

- create a polygon for each cell by: have a fixed segment that is perpendicular to the facing direction, move the fixed segment along the facing direction until the remaining area matches the filled rate
- this process has been optimized using calculus to a simple formula

### JoinVertex

- join near by vertices to their mid point
- added a lots of constraints to eliminate weird shapes

### UnifyShape

- combind all polygons into one polygon

### SmoothShape

- smooth edges using the Visvalingam’s algorithm until the removed triangles is larger than a set value
- interpolate a curve using the Algorithm for Automatically Fitting Digitized Curves

## TODO

- [ ] Prevent Polygon Calculation Errors
- [ ] Corner Detection, make corners more recognizable.
- [ ] Match Area Again after Join Vertex
- [ ] Perfomance, optimize code
- [ ] Use Multi-Thread
- [ ] Zoom In & Pan
- [ ] Path Editor, allow user to fine tune points by hand

## Other Useful Tools

- [SvgPathEditor](https://yqnn.github.io/svg-path-editor/) by Yqnn
- [SVGOMG](https://jakearchibald.github.io/svgomg/) by jakearchibald
