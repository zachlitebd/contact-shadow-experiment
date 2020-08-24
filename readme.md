# Contact Shadow Experiment

## Strategy
1. Render a mesh to a depth framebuffer using an orthographic projection, and a camera placed beneath the mesh, looking up.
2. Render a plane, and sample the depth framebuffer when the plane's worldspace coords are inside the bounds of the depth camera.
3. Blur


## TODO:
- Blur
- Parameterized depth camera bounds
- ~~A second coordinate system for rendering the ground~~


