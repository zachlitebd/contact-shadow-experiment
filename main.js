import { mat4, quat } from "gl-matrix";

const DepthMapRes = 1024;
const depthCamera = {
  eye: [0, -1, 0.001],
  look: [0, 0, 0],
  up: [0, 1, 0],
};

const depthView = mat4.lookAt(
  mat4.create(),
  depthCamera.eye,
  depthCamera.look,
  depthCamera.up
);

const cubeTransform = {
  translation: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

const planeTransform = {
  translation: [0, -0.75, 0],
  rotation: [90, 0, 0],
  scale: [10, 10, 1],
};

function getModelTransform(transform) {
  return mat4.fromRotationTranslationScale(
    mat4.create(),
    quat.fromEuler(
      quat.create(),
      transform.rotation[0],
      transform.rotation[1],
      transform.rotation[2]
    ),
    transform.translation,
    transform.scale
  );
}

let cubeModelTransform = getModelTransform(cubeTransform);
const planeModelTransform = getModelTransform(planeTransform);

const frustrumSize = 1;
const depthProjection = mat4.ortho(
  mat4.create(),
  -frustrumSize,
  frustrumSize,
  -frustrumSize,
  frustrumSize,
  -frustrumSize,
  frustrumSize
);

const depthFrag = `
  precision mediump float;
  varying vec3 vPosition;
  void main () {
    gl_FragColor = vec4(vec3(vPosition.z), 1.0);
  }`;

const depthVert = `
  precision mediump float;
  attribute vec3 position;
  uniform mat4 depthProjection, depthView, model;
  varying vec3 vPosition;
  void main() {
    vec4 p = depthProjection * depthView * model * vec4(position, 1.0);
    gl_Position = p;
    vPosition = p.xyz;
  }`;

const planeFrag = `
  precision mediump float;
  uniform sampler2D depthMap;
  uniform float h;
  varying vec3 vWorldPos;
  void main() {
    float bound = 1.0;
    vec4 color;
    if (vWorldPos.x >= -bound && vWorldPos.x <= bound  && vWorldPos.z >= -bound && vWorldPos.z <= bound) {
      vec2 sampleCoord = vWorldPos.xz * .5 + .5;
      float depth = texture2D(depthMap, sampleCoord).z;
      if (depth == 0.0) {
        depth = .95;
      }
      color = vec4(depth, depth, depth, 1.0);
    } else {
      color = vec4(.95, .95, .95, 1.0);
    }
      // vec4 sum = vec4( 0.0 );
      // sum += texture2D( depthMap, vec2( sampleCoord.x - 4.0 * h, sampleCoord.y ) ) * 0.051;
      // sum += texture2D( depthMap, vec2( sampleCoord.x - 3.0 * h, sampleCoord.y ) ) * 0.0918;
      // sum += texture2D( depthMap, vec2( sampleCoord.x - 2.0 * h, sampleCoord.y ) ) * 0.12245;
      // sum += texture2D( depthMap, vec2( sampleCoord.x - 1.0 * h, sampleCoord.y ) ) * 0.1531;
      // sum += texture2D( depthMap, vec2( sampleCoord.x, sampleCoord.y ) ) * 0.1633;
      // sum += texture2D( depthMap, vec2( sampleCoord.x + 1.0 * h, sampleCoord.y ) ) * 0.1531;
      // sum += texture2D( depthMap, vec2( sampleCoord.x + 2.0 * h, sampleCoord.y ) ) * 0.12245;
      // sum += texture2D( depthMap, vec2( sampleCoord.x + 3.0 * h, sampleCoord.y ) ) * 0.0918;
      // sum += texture2D( depthMap, vec2( sampleCoord.x + 4.0 * h, sampleCoord.y ) ) * 0.051;
      // gl_FragColor = sum;
    gl_FragColor = color;
  }`;

const planeVert = `
  precision mediump float;
  uniform mat4 projection, view, model, cubeModel;
  attribute vec3 position;
  varying vec3 vWorldPos;
  void main() {
    vWorldPos = (model * vec4(position, 1.0)).xyz;
    gl_Position = projection * view * model * vec4(position, 1.0);
  }`;

const cubeFrag = `
  precision mediump float;
  varying vec3 vnormal;
  void main () {
    gl_FragColor = vec4(abs(vnormal), 1.0);
  }`;

const cubeVert = `
  precision mediump float;
  uniform mat4 projection, view, model;
  attribute vec3 position, normal;
  varying vec3 vnormal;
  void main () {
    vnormal = normal;
    gl_Position = projection * view * model * vec4(position, 1.0);
  }`;

window.onload = () => {
  const regl = require("regl")({ extensions: "OES_texture_float" });
  const camera = require("regl-camera")(regl, { damping: 0 });
  const primitiveCube = require("primitive-cube");
  const primitivePlane = require("primitive-plane");

  const cube = primitiveCube();
  const plane = primitivePlane();

  const depthFrameBuffer = regl.framebuffer({
    color: regl.texture({
      width: DepthMapRes,
      height: DepthMapRes,
      wrap: "clamp",
      type: "float",
    }),
    depth: true,
  });

  const drawDepth = regl({
    frag: depthFrag,
    vert: depthVert,
    uniforms: {
      depthView,
      depthProjection,
    },
    framebuffer: depthFrameBuffer,
  });

  const drawShadowPlane = regl({
    frag: planeFrag,
    vert: planeVert,
    attributes: {
      position: plane.positions,
    },
    uniforms: {
      depthMap: depthFrameBuffer,
      model: planeModelTransform,
      h: 4.5 * (1 / 256),
    },
    elements: plane.cells,
  });

  const drawCube = regl({
    frag: cubeFrag,
    vert: cubeVert,
  });

  const preDrawCube = regl({
    attributes: {
      position: cube.positions,
      normal: cube.normals,
    },
    uniforms: { model: () => cubeModelTransform },
    elements: cube.cells,
  });

  regl.frame(() => {
    camera(() => {
      regl.clear({
        color: [1, 1, 1, 1],
        depth: true,
      });

      regl.clear({
        color: [0, 0, 0, 1],
        depth: true,
        framebuffer: depthFrameBuffer,
      });

      cubeTransform.rotation[1] += 1;
      cubeModelTransform = getModelTransform(cubeTransform);

      // render the cube to the display for human consumption
      drawCube(() => preDrawCube());

      // render the cube to the depth map for ground plane consumption
      drawDepth(() => preDrawCube());

      // render the ground plane
      drawShadowPlane();
    });
  });
};
