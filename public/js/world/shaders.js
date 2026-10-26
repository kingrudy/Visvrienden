// Eigen GLSL-shaders: water, lucht, wind in bomen en riet, terreindetail met natte oevers en lichtbundels onder water.
import * as THREE from 'three';
import { PONDS } from '../shared.js';

/* ------------------------------------------------------------------ shaders: wind in bomen/riet, terrein-detail en lichtbundels op de bodem */
export const WIND = { uWT: { value: 0 }, uWA: { value: 1 } };
export function windify(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uWT = WIND.uWT;
    sh.uniforms.uWA = WIND.uWA;
    sh.vertexShader =
      'uniform float uWT; uniform float uWA;\n' +
      sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 wpI = (instanceMatrix*vec4(transformed,1.0)).xyz;
      #else
        vec3 wpI = transformed;
      #endif
      float swH = max(transformed.y, 0.0);
      float swP = wpI.x*0.21 + wpI.z*0.17;
      transformed.x += (sin(uWT*1.5 + swP) + 0.45*sin(uWT*3.7 + swP*2.3))*0.013*swH*uWA;
      transformed.z += (cos(uWT*1.2 + swP*1.3) + 0.3*sin(uWT*4.1 + swP))*0.010*swH*uWA;`,
      );
  };
  return mat;
}
const POND_U = { value: PONDS.map(p => new THREE.Vector4(p.x, p.z, p.r, p.waterY)) };
export function terrainShade(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uWT = WIND.uWT;
    sh.uniforms.uPonds = POND_U;
    sh.uniforms.uDay = TERRAIN_U.uDay;
    sh.vertexShader =
      'varying vec3 vWP;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWP = (modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader =
      'uniform float uWT, uDay; uniform vec4 uPonds[' +
      PONDS.length +
      ']; varying vec3 vWP;\n' +
      sh.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
      { float n = sin(vWP.x*1.7)*sin(vWP.z*1.3) + 0.6*sin(vWP.x*4.1+vWP.z*3.3) + 0.35*sin(vWP.x*9.3 - vWP.z*7.7);
        diffuseColor.rgb *= 0.93 + 0.055*n;
        for (int i = 0; i < ${PONDS.length}; i++) {
          vec4 pd = uPonds[i]; float d = length(vWP.xz - pd.xy);
          if (d < pd.z + 6.0) {
            float dy = pd.w - vWP.y;
            if (dy > -0.4) { float wet = smoothstep(-0.4, 0.0, dy)*0.35; diffuseColor.rgb *= 1.0 - wet; }
            if (dy > 0.0) {
              vec2 q = vWP.xz*0.9; float t = uWT*0.6;
              float c1 = sin(q.x*2.1 + sin(q.y*1.7 + t)*1.6 + t), c2 = sin(q.y*2.3 + sin(q.x*1.9 - t)*1.6 - t);
              float c = pow(1.0 - abs(c1*c2), 6.0); float fade = exp(-dy*0.5);
              diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(0.55,0.85,1.0), 0.45) + vec3(0.55,0.95,1.0)*c*0.35*fade*uDay;
            }
          }
        }
      }`,
      );
  };
  return mat;
}
export const TERRAIN_U = { uDay: { value: 1 } };
/* ------------------------------------------------------------------ water */
export const WATER_VS = `uniform float uTime; uniform float uAmp; varying vec3 vW; varying vec3 vN;
void main(){ vec4 wp = modelMatrix*vec4(position,1.0);
  float a = wp.x*0.33+uTime*1.1, b = wp.z*0.41-uTime*0.9, c = (wp.x+wp.z)*0.7+uTime*1.7;
  float h = (sin(a)*0.5+sin(b)*0.5)*0.05*uAmp + sin(c)*0.02*uAmp;
  float dx = (cos(a)*0.33*0.5)*0.05*uAmp + cos(c)*0.7*0.02*uAmp, dz = (cos(b)*0.41*0.5)*0.05*uAmp + cos(c)*0.7*0.02*uAmp;
  wp.y += h; vW = wp.xyz; vN = normalize(vec3(-dx, 1.0, -dz)); gl_Position = projectionMatrix*viewMatrix*wp; }`;
export const WATER_FS = `uniform vec3 uCam, uSun, uSunCol, uShallow, uDeep, uSky, uFogCol; uniform float uFogNear, uFogFar, uTime, uOpacity; varying vec3 vW; varying vec3 vN;
void main(){
  float n1 = sin(vW.x*1.3+vW.z*0.7+uTime*1.3)+sin(vW.z*1.9-vW.x*0.5-uTime*1.1)+sin((vW.x+vW.z)*2.7+uTime*1.9)*0.6;
  vec3 N = normalize(vN + vec3(n1*0.035, 0.0, sin(n1*2.1+vW.x*0.4)*0.035));
  vec3 V = normalize(uCam - vW); float fres = pow(1.0-max(dot(V,N),0.0), 3.0);
  vec3 col = mix(uShallow, uDeep, 0.55); col = mix(col, uSky, fres*0.75);
  vec3 R = reflect(-normalize(uSun), N); float spec = pow(max(dot(R,V),0.0), 80.0);
  col += uSunCol*spec*1.4;
  float gl = pow(max(sin(vW.x*7.0+uTime*2.3)*sin(vW.z*6.3-uTime*1.9),0.0),20.0)*pow(max(dot(R,V),0.0),5.0); col += uSunCol*gl*2.2;
  float d = length(uCam - vW); float f = smoothstep(uFogNear, uFogFar, d); col = mix(col, uFogCol, f);
  gl_FragColor = vec4(col, mix(uOpacity-0.1, 0.95, fres));
  #include <colorspace_fragment>
}`;

export const SKY_VS = `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }`;
export const SKY_FS = `uniform vec3 uZen, uHor, uSun, uSunCol; varying vec3 vD;
void main(){ float h = clamp(vD.y, -0.2, 1.0); float t = pow(max(h,0.0), 0.55);
  vec3 col = mix(uHor, uZen, t); col = mix(col, uHor*0.8, smoothstep(0.0,-0.2,vD.y));
  float s = max(dot(normalize(vD), normalize(uSun)), 0.0);
  col += uSunCol*(pow(s, 600.0)*3.0 + pow(s, 12.0)*0.25);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
