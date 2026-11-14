// Procedural sky dome: gradient, Mie sun glow, sun & moon discs, twinkling stars, milky way and
// fbm clouds that drift with the wind. Rendered first, without depth, following the camera.
import * as THREE from 'three';

const VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform float uTime;
uniform vec3 uSunDir, uMoonDir, uZenith, uHorizon, uSunColor, uCloudLit, uCloudShade;
uniform float uSunVis, uNight, uCoverage, uOvercast, uFlash, uSunElev, uTwilight;
uniform vec2 uWindOff;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = .5, s = 0.;
  for (int i = 0; i < OCT; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= .5; }
  return s;
}
float hg(float c, float g) { float g2 = g * g; return (1. - g2) / (12.566 * pow(1. + g2 - 2. * g * c, 1.5)); }

float starLayer(vec3 d, float scale, float thr) {
  vec3 p = d * scale; vec3 id = floor(p); vec3 f = fract(p) - .5;
  float h = hash13(id);
  if (h < thr) return 0.;
  vec3 off = vec3(hash13(id + 7.1), hash13(id + 13.7), hash13(id + 3.3)) - .5;
  float dist = length(f - off * .6);
  float size = .05 + .07 * fract(h * 91.7);
  float tw = .65 + .35 * sin(uTime * (1.5 + 4. * fract(h * 37.1)) + h * 80.);
  return smoothstep(size, 0., dist) * tw * (.4 + .6 * fract(h * 13.3));
}

void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.);
  float cosS = dot(d, uSunDir);
  float cosM = dot(d, uMoonDir);

  // base gradient
  float t = pow(h, .5);
  vec3 col = mix(uHorizon, uZenith, t);
  // below the horizon: fog-coloured haze
  col = mix(col, uHorizon * .9, smoothstep(0., -.25, d.y));

  // sun scattering: broad Mie lobe + warm horizon bloom at low sun
  float vis = uSunVis;
  col += uSunColor * (hg(cosS, .78) * .11 + pow(max(cosS, 0.), 6.) * .10) * vis * smoothstep(-.15, .05, uSunElev);
  vec2 az = normalize(d.xz + 1e-5), saz = normalize(uSunDir.xz + 1e-5);
  float horizonGlow = pow(max(dot(az, saz), 0.), 3.) * exp(-h * 6.5) * uTwilight;
  col += uSunColor * horizonGlow * .55 * vis;

  // stars (behind everything), milky way band
  float starVis = uNight * smoothstep(0., .12, d.y);
  vec3 sky2 = vec3(0.);
  if (starVis > .001) {
    float s = starLayer(d, 70., .93) + starLayer(d, 130., .95) * .8 + starLayer(d, 36., .985) * 1.4;
    vec3 gal = normalize(vec3(.35, .55, .75));
    float band = exp(-pow(dot(d, gal) * 3.4, 2.));
    float mw = band * (.35 + .65 * fbm(vec2(atan(d.x, d.z) * 3., dot(d, gal) * 9.)));
    sky2 = vec3(.9, .95, 1.) * s * 1.2 + vec3(.20, .24, .38) * mw * .30;
  }

  // moon
  float moonVis = uNight * (1. - uOvercast * .85) * smoothstep(-.02, .06, d.y);
  float md = smoothstep(.99935, .99965, cosM);
  vec2 mp = (d - uMoonDir).xz * 150.;
  float maria = .78 + .22 * vnoise(mp * .9) + .08 * vnoise(mp * 3.);
  vec3 moon = vec3(.93, .95, 1.) * maria * md * 2.2;
  moon += vec3(.55, .65, .95) * (pow(max(cosM, 0.), 90.) * .45 + pow(max(cosM, 0.), 8.) * .05);
  sky2 += moon * moonVis * smoothstep(0., .04, d.y + .02);

  // clouds
  float cloudFade = smoothstep(0., .16, d.y);
  float dens = 0.;
  float lit = 1.;
  if (uCoverage > .01 && d.y > -.02) {
    vec2 cp = d.xz / (h * .85 + .14) * .5 + uWindOff;
    float n = fbm(cp);
    float thr = mix(.74, .28, uCoverage);
    dens = smoothstep(thr, thr + .26, n);
    float n2 = fbm(cp + uSunDir.xz * .09 / (h * .6 + .4));
    float d2 = smoothstep(thr, thr + .26, n2);
    lit = clamp(.55 + (dens - d2) * 2.2 - dens * .25 * uOvercast, 0., 1.);
  }
  dens *= cloudFade;
  vec3 cloudCol = mix(uCloudShade, uCloudLit, lit);
  cloudCol += uSunColor * pow(max(cosS, 0.), 14.) * (1. - dens * .4) * .25 * vis * (1. - lit * .3);
  // night sky objects are dimmed by cloud
  col += sky2 * (1. - dens * .92);
  // sun disc (sits behind clouds)
  float sd = smoothstep(.99962, .99982, cosS) * smoothstep(-.01, .02, d.y);
  col += uSunColor * sd * 9. * vis * smoothstep(-.03, .04, uSunElev) * (1. - dens * .96);
  col = mix(col, cloudCol, dens * (.94 - .1 * uOvercast * 0.));
  col += vec3(.55, .6, .85) * uFlash * (.25 + dens * 1.4) ;

  // dither against banding
  col += (hash12(gl_FragCoord.xy + fract(uTime)) - .5) / 220.;
  gl_FragColor = vec4(col, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const _c = new THREE.Color();
const _grey = new THREE.Color();

/** Creates the sky dome. `update(dn, wx, dt, camera)` pushes the day/night and weather state to the shader. */
export function createSky(quality = 'high') {
  const uniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunColor: { value: new THREE.Color() },
    uCloudLit: { value: new THREE.Color() },
    uCloudShade: { value: new THREE.Color() },
    uSunVis: { value: 1 }, uNight: { value: 0 }, uCoverage: { value: 0.3 }, uOvercast: { value: 0 },
    uFlash: { value: 0 }, uSunElev: { value: 0.5 }, uTwilight: { value: 0 },
    uWindOff: { value: new THREE.Vector2() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    defines: { OCT: octaves(quality) },
    side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 28), material);
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  mesh.name = 'SkyDome';
  mesh.matrixAutoUpdate = true;

  let windX = 0, windY = 0;

  function octaves(q) { return q === 'low' ? 3 : q === 'medium' ? 4 : 5; }

  return {
    mesh, uniforms,
    setQuality(q) { material.defines.OCT = octaves(q); material.needsUpdate = true; },
    /** dn: DayNight, wx: weather values (smoothed), flash: lightning 0..1, dark: unused */
    update(dt, dn, wx, flash, camera, time) {
      const u = uniforms;
      u.uTime.value = time;
      mesh.position.copy(camera.position);
      u.uSunDir.value.copy(dn.sunDir);
      u.uMoonDir.value.copy(dn.moonDir);
      u.uSunElev.value = dn.elev;
      u.uNight.value = dn.night;
      u.uTwilight.value = dn.twilight * (1 - wx.overcast * .7);
      u.uCoverage.value = wx.cloud;
      u.uOvercast.value = wx.overcast;
      u.uSunVis.value = (1 - wx.overcast * .93) * (1 - wx.fog * .5);
      u.uFlash.value = flash;
      // sky colours: desaturate towards storm-grey, blend into fog colour in fog weather
      _grey.setScalar(dn.zenith.r * .3 + dn.zenith.g * .5 + dn.zenith.b * .2).multiplyScalar(.75);
      u.uZenith.value.copy(dn.zenith).lerp(_grey, wx.overcast * .72);
      _grey.setScalar(dn.horizon.r * .3 + dn.horizon.g * .5 + dn.horizon.b * .2).multiplyScalar(.9);
      u.uHorizon.value.copy(dn.horizon).lerp(_grey, wx.overcast * .6);
      u.uZenith.value.lerp(u.uHorizon.value, wx.fog * .85);
      u.uSunColor.value.copy(dn.sunColor);
      // cloud lighting
      const day = dn.dayFactor;
      _c.copy(dn.sunColor).multiplyScalar(.95 * day + .02).lerp(u.uHorizon.value, .25 * (1 - wx.overcast));
      _c.lerp(_grey.setScalar(.38 * day + .02), wx.overcast * .75);
      u.uCloudLit.value.copy(_c).addScalar(.015 + dn.night * .04);
      _c.copy(u.uZenith.value).lerp(u.uHorizon.value, .4).multiplyScalar(.55 + .15 * day).lerp(_grey.setScalar(.18 * day + .015), wx.overcast * .8);
      u.uCloudShade.value.copy(_c);
      // wind drift
      const sp = (.25 + wx.windNow * 1.6) * dt * .006;
      windX += sp; windY += sp * .35;
      u.uWindOff.value.set(windX, windY);
    },
    dispose() { mesh.geometry.dispose(); material.dispose(); },
  };
}
