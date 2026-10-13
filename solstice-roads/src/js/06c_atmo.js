/* =====================================================================
   Atmosphere for every lit material, patched into three.js' own shader
   chunks so no material needs its own hook:
   - aerial perspective: haze pools in the valleys and thins with height,
     and glows warm towards the sun (in-scattering)
   - drifting cloud shadows sweeping over the countryside
   The shared uniform values are plain {x,y,z,w} objects: three.js copies
   them by reference when it clones ShaderLib uniforms, so one update per
   frame reaches every program.
   ===================================================================== */
const Atmo = {
  cloud: { x: 0, y: 0, z: 1, w: 0 }, // xy: wind drift (m), z: coverage threshold, w: shadow strength
  fog: { x: 20, y: 150, z: 1, w: 0 }, // x: valley floor height, y: haze scale height, z: sun glow strength
  drift: new THREE.Vector2(),
};

(function patchChunks() {
  const SC = THREE.ShaderChunk;
  SC.lights_pars_begin = SC.lights_pars_begin + `
uniform vec4 atmoCloud, atmoFog;
float atmoHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float atmoNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(atmoHash(i), atmoHash(i + vec2(1.0, 0.0)), f.x), mix(atmoHash(i + vec2(0.0, 1.0)), atmoHash(i + vec2(1.0, 1.0)), f.x), f.y); }
float atmoCloudShadow(vec3 viewPos){
  if (atmoCloud.w < 0.001) return 1.0;
  vec3 wp = cameraPosition + (vec4(viewPos, 0.0) * viewMatrix).xyz;
  vec2 p = (wp.xz + atmoCloud.xy) * 0.0021;
  float n = atmoNoise(p) * 0.58 + atmoNoise(p * 2.3 + 7.1) * 0.29 + atmoNoise(p * 5.3 + 3.7) * 0.13;
  return 1.0 - smoothstep(atmoCloud.z, atmoCloud.z + 0.16, n) * atmoCloud.w;
}
`;
  SC.lights_fragment_begin = '#define ATMO_LIT\n' + SC.lights_fragment_begin.replace(
    'getDirectionalLightInfo( directionalLight, directLight );',
    'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= atmoCloudShadow( - vViewPosition );');
  SC.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  vec3 fogC = fogColor;
  #if defined( ATMO_LIT ) && defined( FOG_EXP2 )
  if (atmoFog.y > 1.0) {
    vec3 vp = - vViewPosition;
    float dy = (vec4(vp, 0.0) * viewMatrix).y;
    float k = dy / atmoFog.y;
    float base = exp(- clamp(cameraPosition.y - atmoFog.x, -60.0, 600.0) / atmoFog.y);
    float avg = base * (abs(k) > 0.01 ? (1.0 - exp(- k)) / k : 1.0 - 0.5 * k);
    float od = fogDensity * vFogDepth;
    fogFactor = 1.0 - exp(- od * od * clamp(avg, 0.25, 2.2));
    #if NUM_DIR_LIGHTS > 0
    float mu = max(dot(normalize(vp), directionalLights[ 0 ].direction), 0.0);
    fogC += directionalLights[ 0 ].color * (pow(mu, 6.0) * 0.045 + pow(mu, 40.0) * 0.06) * atmoFog.z;
    #endif
  }
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogC, fogFactor );
#endif`;
  for (const id of ['standard', 'physical', 'lambert', 'phong', 'toon']) {
    const s = THREE.ShaderLib[id];
    if (!s) continue;
    s.uniforms.atmoCloud = { value: Atmo.cloud };
    s.uniforms.atmoFog = { value: Atmo.fog };
  }
})();

/* Called once the heightfield exists: the haze settles on the low ground. */
function initAtmosphere() {
  const H = World.H, s = [];
  for (let i = 0; i < H.length; i += 97) s.push(H[i]);
  s.sort((a, b) => a - b);
  Atmo.fog.x = s[Math.floor(s.length * 0.3)] || 20;
}

function updateAtmosphere(dt, golden) {
  const c = Sky.cur, day = 1 - Sky.night;
  // wind pushes the cloud field across the map
  Atmo.drift.x += dt * (7 + c.clouds * 6 + c.rain * 8);
  Atmo.drift.y += dt * (3 + c.clouds * 2);
  Atmo.cloud.x = Atmo.drift.x; Atmo.cloud.y = Atmo.drift.y;
  // broken cloud gives the strongest moving shadows; overcast already dims the sun as a whole
  const broken = smoothstep(0.02, 0.35, c.clouds) * (1 - smoothstep(0.7, 0.95, c.clouds));
  Atmo.cloud.z = lerp(0.74, 0.44, smoothstep(0.0, 0.6, c.clouds));
  Atmo.cloud.w = (0.18 + 0.47 * broken) * day * (1 - c.fog * 0.8) * (1 - c.rain * 0.5);
  Atmo.fog.y = lerp(150, 260, c.fog) + c.rain * 80;
  Atmo.fog.z = (0.6 + golden * 1.6) * day * (1 - c.clouds * 0.75) * (1 - c.fog * 0.6);
}
