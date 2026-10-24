/* eslint-disable @typescript-eslint/no-explicit-any */

/*
 * Realistic Earth for globe.gl: day map blended with a night-lights map by a sun
 * direction, a slowly drifting cloud layer and a blue limb. The sun stays on the
 * left of the camera so the terminator and city lights are always in view.
 *
 * Textures: Solar System Scope (CC BY 4.0), based on NASA imagery.
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const EARTH_FRAG = /* glsl */ `
  uniform sampler2D dayTex;
  uniform sampler2D nightTex;
  uniform vec3 sunDir;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewNormal;
  void main() {
    float d = dot(normalize(vWorldNormal), sunDir);
    float lit = smoothstep(-0.12, 0.28, d);

    vec3 day = texture2D(dayTex, vUv).rgb;
    vec3 night = texture2D(nightTex, vUv).rgb;

    vec3 dayCol = day * (0.42 + 0.78 * clamp(d, 0.0, 1.0));
    vec3 nightCol = night * 1.7 + day * 0.025;
    vec3 col = mix(nightCol, dayCol, lit);

    // Blue limb, strongest on the lit side.
    float rim = pow(1.0 - clamp(vViewNormal.z, 0.0, 1.0), 3.0);
    col += vec3(0.22, 0.48, 1.0) * rim * (0.15 + 0.6 * lit);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const CLOUD_FRAG = /* glsl */ `
  uniform sampler2D cloudTex;
  uniform vec3 sunDir;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    float d = dot(normalize(vWorldNormal), sunDir);
    float lit = smoothstep(-0.12, 0.3, d);
    float c = texture2D(cloudTex, vUv).r;
    float a = c * mix(0.12, 0.8, lit);
    vec3 col = vec3(1.0) * mix(0.05, 1.0, lit);
    gl_FragColor = vec4(col, a);
  }
`;

function load(THREE: any, url: string, maxAniso: number) {
  return new Promise<any>((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (t: any) => {
        t.anisotropy = maxAniso;
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        resolve(t);
      },
      undefined,
      reject,
    );
  });
}

export async function setupEarth(g: any, isAlive: () => boolean): Promise<() => void> {
  const THREE: any = await import("three");
  if (!isAlive()) return () => {};

  const renderer = g.renderer();
  const maxTex: number = renderer.capabilities.getMaxTextureSize?.() ?? renderer.capabilities.maxTextureSize ?? 4096;
  const maxAniso: number = renderer.capabilities.getMaxAnisotropy?.() ?? 4;
  const big = maxTex >= 8192 && window.innerWidth > 900;
  const res = big ? "8k" : "4k";

  const [day, night, clouds] = await Promise.all([
    load(THREE, `/globe/earth-day-${res}.jpg`, maxAniso),
    load(THREE, `/globe/earth-night-${res}.jpg`, maxAniso),
    load(THREE, "/globe/earth-clouds.jpg", maxAniso),
  ]);
  if (!isAlive()) return () => {};

  const sunDir = { value: new THREE.Vector3(-0.8, 0.3, 0.5).normalize() };

  g.globeMaterial(
    new THREE.ShaderMaterial({
      uniforms: { dayTex: { value: day }, nightTex: { value: night }, sunDir },
      vertexShader: VERT,
      fragmentShader: EARTH_FRAG,
    }),
  );

  const radius: number = g.getGlobeRadius();
  const cloudMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.006, 96, 96),
    new THREE.ShaderMaterial({
      uniforms: { cloudTex: { value: clouds }, sunDir },
      vertexShader: VERT,
      fragmentShader: CLOUD_FRAG,
      transparent: true,
      depthWrite: false,
    }),
  );
  cloudMesh.renderOrder = 1;
  g.scene().add(cloudMesh);

  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const dir = new THREE.Vector3();
  let raf = 0;
  const tick = () => {
    const cam = g.camera();
    dir.copy(cam.position).normalize();
    right.set(1, 0, 0).applyQuaternion(cam.quaternion);
    up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    // Light from the upper left of the view, slightly toward the camera.
    sunDir.value.copy(dir).multiplyScalar(0.4).addScaledVector(right, -0.9).addScaledVector(up, 0.3).normalize();
    cloudMesh.rotation.y += 0.00006;
    raf = requestAnimationFrame(tick);
  };
  tick();

  return () => {
    cancelAnimationFrame(raf);
    g.scene().remove(cloudMesh);
    cloudMesh.geometry.dispose();
    cloudMesh.material.dispose();
    day.dispose();
    night.dispose();
    clouds.dispose();
  };
}
