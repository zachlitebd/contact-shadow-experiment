import { mat4, quat } from "gl-matrix";

const DepthMapRes = 512;
const depthCamera = {
  eye: [0, -1, 0.000001],
  look: [0, 0, 0],
  up: [0, 1, 0],
};

const depthView = mat4.lookAt(
  mat4.create(),
  depthCamera.eye,
  depthCamera.look,
  depthCamera.up
);

const planeCamera = {
  eye: [0, 1, 0.00001],
  look: [0, 0, 0],
  up: [0, 1, 0]
}
const planeView = mat4.lookAt(
  mat4.create(),
  planeCamera.eye,
  planeCamera.look,
  planeCamera.up
)

const cubeTransform = {
  translation: [0, 0, 0],
  rotation: [0, 0, 45],
  scale: [1, 1, 1],
};

const planeTransform = {
  translation: [0, -1, 0],
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

const planeProjection = mat4.ortho(
  mat4.create(), -5, 5, 5, -5, -5, 5
)

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
    float bound = 2.0;
    vec4 color;
    
    if (vWorldPos.x >= -bound && vWorldPos.x <= bound  && vWorldPos.z >= -bound && vWorldPos.z <= bound) {
      
      vec2 sampleCoord = vWorldPos.xz * .5 + .5;
      float depth = texture2D(depthMap, sampleCoord).z;

      if (depth == 0.0) {
        color = vec4(1.0);
      } else {
        color = vec4(depth, depth, depth, 1.0);
      }
    
    } else {
      color = vec4(1.0);
    }

    gl_FragColor = color;
  }`;

const planeVert = `
  precision mediump float;
  uniform mat4 planeProjection, planeView, model;
  attribute vec3 position;
  varying vec3 vWorldPos;
  void main() {
    vWorldPos = (model * vec4(position, 1.0)).xyz;
    gl_Position = planeProjection * planeView * model * vec4(position, 1.0);
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
  const regl = require("regl")({ extensions: ["OES_texture_float", "OES_texture_float_linear"] });
  const camera = require("regl-camera")(regl, { damping: 0 });
  const primitiveCube = require("primitive-cube");
  const primitivePlane = require("primitive-plane");

  const cube = primitiveCube();
  const plane = primitivePlane();

  const depthFrameBuffer = regl.framebuffer({
    color: regl.texture({
      width: DepthMapRes,
      height: DepthMapRes,
    }),
  });

  const planeFrameBuffer = regl.framebuffer({
    color: regl.texture({
      width: DepthMapRes,
      height: DepthMapRes,
    }),
  })

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
      planeView,
      planeProjection,
      depthMap: depthFrameBuffer,
      model: planeModelTransform,
    },
    elements: plane.cells,
    framebuffer: planeFrameBuffer
  });



  const drawPlane = regl({
    frag: `
      precision mediump float;
      uniform sampler2D shadowTexture;
      varying vec3 vWorldPos;

      vec4 blurThreeHoriz(sampler2D image, vec2 uv, float h) {

        vec4 sum = vec4( 0.0 );
        sum += texture2D( image, vec2( uv.x - 4.0 * h, uv.y ) ) * 0.051;
        sum += texture2D( image, vec2( uv.x - 3.0 * h, uv.y ) ) * 0.0918;
        sum += texture2D( image, vec2( uv.x - 2.0 * h, uv.y ) ) * 0.12245;
        sum += texture2D( image, vec2( uv.x - 1.0 * h, uv.y ) ) * 0.1531;
        sum += texture2D( image, vec2( uv.x, uv.y ) ) * 0.1633;
        sum += texture2D( image, vec2( uv.x + 1.0 * h, uv.y ) ) * 0.1531;
        sum += texture2D( image, vec2( uv.x + 2.0 * h, uv.y ) ) * 0.12245;
        sum += texture2D( image, vec2( uv.x + 3.0 * h, uv.y ) ) * 0.0918;
        sum += texture2D( image, vec2( uv.x + 4.0 * h, uv.y ) ) * 0.051;
        return sum;
      }

      vec4 blurThreeVertical(sampler2D image, vec2 uv, float v) {
        vec4 sum = vec4( 0.0 );

        sum += texture2D( image, vec2( uv.x, uv.y - 4.0 * v ) ) * 0.051;
        sum += texture2D( image, vec2( uv.x, uv.y - 3.0 * v ) ) * 0.0918;
        sum += texture2D( image, vec2( uv.x, uv.y - 2.0 * v ) ) * 0.12245;
        sum += texture2D( image, vec2( uv.x, uv.y - 1.0 * v ) ) * 0.1531;
        sum += texture2D( image, vec2( uv.x, uv.y ) ) * 0.1633;
        sum += texture2D( image, vec2( uv.x, uv.y + 1.0 * v ) ) * 0.1531;
        sum += texture2D( image, vec2( uv.x, uv.y + 2.0 * v ) ) * 0.12245;
        sum += texture2D( image, vec2( uv.x, uv.y + 3.0 * v ) ) * 0.0918;
        sum += texture2D( image, vec2( uv.x, uv.y + 4.0 * v ) ) * 0.051;
        
        return sum;
      }

      vec4 blur9(sampler2D image, vec2 uv, vec2 resolution, vec2 direction) {
        vec4 color = vec4(0.0);
        vec2 off1 = vec2(1.411764705882353) * direction;
        vec2 off2 = vec2(3.2941176470588234) * direction;
        vec2 off3 = vec2(5.176470588235294) * direction;
        color += texture2D(image, uv) * 0.1964825501511404;
        color += texture2D(image, uv + (off1 / resolution)) * 0.2969069646728344;
        color += texture2D(image, uv - (off1 / resolution)) * 0.2969069646728344;
        color += texture2D(image, uv + (off2 / resolution)) * 0.09447039785044732;
        color += texture2D(image, uv - (off2 / resolution)) * 0.09447039785044732;
        color += texture2D(image, uv + (off3 / resolution)) * 0.010381362401148057;
        color += texture2D(image, uv - (off3 / resolution)) * 0.010381362401148057;
        return color;
      }

      void main() {
        vec2 sampleCoord = vWorldPos.xy;
        // float v = 4.0;
        // vec4 vertical = blurThreeVertical(shadowTexture, sampleCoord, v * 1.0 / 256.0);
        // vec4 horiz = blurThreeHoriz(shadowTexture, sampleCoord, v * 1.0 / 256.0);
        // gl_FragColor = mix(vertical, horiz, .5);
        
        vec2 res = vec2(512);
        vec4 vertical = blur9(shadowTexture, sampleCoord, res, vec2(0,1));
        vec4 horiz = blur9(shadowTexture, sampleCoord, res, vec2(1,0));
        gl_FragColor = mix(vertical, horiz, .5);
      }

    `,
    vert: `
      precision mediump float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform mat4 projection, view, model;
      varying vec3 vWorldPos;
      void main() {
        vec4 pos = projection * view * model * vec4(position, 1.0);
        vWorldPos = vec3(uv, 1.0);
        gl_Position = pos;
      }
    `,
    attributes: {
      position: plane.positions,
      uv: plane.uvs
    },
    uniforms: {
      model: planeModelTransform,
      shadowTexture: planeFrameBuffer
    },
    elements: plane.cells,
    cull: {
      enable: true,
      face: "front"
    },
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

  regl.frame(({tick}) => {
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

      regl.clear({
        color: [0,0,0,1],
        depth: true,
        framebuffer: planeFrameBuffer
      })

      cubeTransform.rotation[0] = Math.sin(tick / 100) * 90;
      cubeModelTransform = getModelTransform(cubeTransform);

      // render the cube to the display for human consumption
      drawCube(() => preDrawCube());

      // render the cube to the depth map for ground plane consumption
      drawDepth(() => preDrawCube());

      // render the ground plane
      drawShadowPlane();

      drawPlane();
    });
  });
};
