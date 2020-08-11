# Contact Shadow Experiment

## Strategy
1. Render a mesh to a depth framebuffer using an orthographic projection, and a camera placed beneath the mesh, looking up.
2. Render a plane, and sample the depth framebuffer when the plane's worldspace coords are inside the bounds of the depth camera.
3. Blur


## TODO:
- Blur
- Parameterized depth camera bounds
- A second coordinate system for rendering the ground



Render Mesh to depth buffer
render mesh
render plane, sampling depth buffer
Where do I sample the depth buffer???
apply blur


what happens when camera changes, and model transform???