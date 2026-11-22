import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky, Html } from "@react-three/drei";
import * as THREE from "three";

/* ---------- helpers ---------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...o });

const M = {
  stone: mat("#9d9b90"), cobble: mat("#b8b09c"), plaster: mat("#f0e4c8"), plaster2: mat("#e6d2a2"), plaster3: mat("#dcbd8e"),
  beam: mat("#56382a"), wood: mat("#8d6239"), shutter: mat("#3f7a6a"), door: mat("#6b3f26"),
  roofA: mat("#8c4a31"), roofB: mat("#a65e3a"), roofC: mat("#6e4b3b"), roofD: mat("#7d5a3c"),
  dark: mat("#2b2d2c"), trunk: mat("#6e4a2e"), white: mat("#f4f2ea"), hay: mat("#d7b04e"), sand: mat("#d8c08a"),
  soil: mat("#6d4f33"), dirt: mat("#7b5b3a"), skin: mat("#d9a679"),
  metal: mat("#838b8a", { metalness: 0.7, roughness: 0.35, flatShading: false }),
  pipe: mat("#6d7878", { metalness: 0.75, roughness: 0.3, flatShading: false }),
  valve: mat("#d6392e"), gold: mat("#e8a317", { emissive: "#e8a317", emissiveIntensity: 0.5 }),
  solar: mat("#17406a", { metalness: 0.6, roughness: 0.25, flatShading: false, emissive: "#0a2240", emissiveIntensity: 0.7 }),
  water: new THREE.MeshStandardMaterial({ color: "#3ba0d2", roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.88 }),
  smoke: new THREE.MeshBasicMaterial({ color: "#d8d4cb", transparent: true, opacity: 0.45, depthWrite: false }),
  cloud: new THREE.MeshStandardMaterial({ color: "#ffffff", flatShading: true, roughness: 1 }),
  cross: new THREE.MeshStandardMaterial({ color: "#d6392e", emissive: "#ff2a1f", emissiveIntensity: 1 })
};
// Materials animated by the crisis (dryness, blackout)
const DYN = {
  grass: mat("#6aad47"), crop: mat("#74b552"), olive: mat("#7f9d66"),
  leaf: [mat("#5aa046"), mat("#4b9040"), mat("#72ae50")],
  home: new THREE.MeshStandardMaterial({ color: "#2b3a3c", emissive: "#ffd58a", emissiveIntensity: 1 }),
  hosp: new THREE.MeshStandardMaterial({ color: "#2b3a3c", emissive: "#fff0c0", emissiveIntensity: 1 })
};
const OK = { grass: new THREE.Color("#6aad47"), crop: new THREE.Color("#74b552"), olive: new THREE.Color("#7f9d66"), leaf: ["#5aa046", "#4b9040", "#72ae50"].map((c) => new THREE.Color(c)) };
const DRY = { grass: new THREE.Color("#a89d58"), crop: new THREE.Color("#b79150"), olive: new THREE.Color("#a39a5a"), leaf: ["#a6a04e", "#9a8f48", "#b3a65a"].map((c) => new THREE.Color(c)) };

const B = ({ s, p, m, r, c = true }) => (
  <mesh position={p} rotation={r} material={m} castShadow={c} receiveShadow><boxGeometry args={s} /></mesh>
);
const Cy = ({ r = [0.5, 0.5], h = 1, p, m, rot, seg = 14, c = true }) => (
  <mesh position={p} rotation={rot} material={m} castShadow={c} receiveShadow><cylinderGeometry args={[r[0], r[1], h, seg]} /></mesh>
);
const Sp = ({ r = 0.5, p, m, sc }) => (
  <mesh position={p} scale={sc} material={m} castShadow receiveShadow><icosahedronGeometry args={[r, 1]} /></mesh>
);

/* ---------- buildings ---------- */
function Win({ p, m }) {
  return (
    <group position={p}>
      <B s={[0.64, 0.78, 0.06]} p={[0, 0, 0]} m={M.beam} />
      <B s={[0.5, 0.64, 0.08]} p={[0, 0, 0.01]} m={m} />
      <B s={[0.06, 0.64, 0.1]} p={[0, 0, 0.02]} m={M.beam} />
      <B s={[0.2, 0.74, 0.05]} p={[-0.4, 0, 0]} m={M.shutter} />
      <B s={[0.2, 0.74, 0.05]} p={[0.4, 0, 0]} m={M.shutter} />
      <B s={[0.72, 0.08, 0.2]} p={[0, -0.42, 0.07]} m={M.wood} />
    </group>
  );
}

function House({ p, r = 0, w = 3, d = 2.6, h = 1.8, rh = 1.5, cols = 2, wall = M.plaster, roof = M.roofA, win = DYN.home, attic = true, chim = true }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape(); const o = 0.4;
    s.moveTo(-w / 2 - o, 0); s.lineTo(w / 2 + o, 0); s.lineTo(0, rh); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d + 0.7, bevelEnabled: false });
    g.translate(0, 0, -(d + 0.7) / 2); return g;
  }, [w, d, rh]);
  const y0 = 0.35;
  const xs = Array.from({ length: cols }, (_, i) => (i - (cols - 1) / 2) * (w / cols));
  return (
    <group position={p} rotation={[0, r, 0]}>
      <B s={[w + 0.2, y0, d + 0.2]} p={[0, y0 / 2, 0]} m={M.stone} />
      <B s={[w, h, d]} p={[0, y0 + h / 2, 0]} m={wall} />
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => <B key={`${x}${z}`} s={[0.16, h + 0.04, 0.16]} p={[x * w / 2, y0 + h / 2, z * d / 2]} m={M.beam} />))}
      <B s={[w + 0.05, 0.12, d + 0.05]} p={[0, y0 + h * 0.5, 0]} m={M.beam} />
      <mesh geometry={geo} material={roof} position={[0, y0 + h, 0]} castShadow receiveShadow />
      {xs.map((x, i) => <React.Fragment key={i}><Win p={[x, y0 + h * 0.74, d / 2 + 0.04]} m={win} /><Win p={[x, y0 + h * 0.26 + 0.2, d / 2 + 0.04]} m={win} /></React.Fragment>)}
      <B s={[0.58, 1.05, 0.08]} p={[0, y0 + 0.52, d / 2 + 0.04]} m={M.door} />
      <B s={[0.9, 0.08, 0.5]} p={[0, y0 + 1.15, d / 2 + 0.25]} m={M.roofC} />
      <B s={[.65,.06,.07]} p={[0,y0+1.65,d/2+.16]} m={M.shutter}/>
      {[-1,1].map(side=><group key={side}>
        <B s={[.045,.50,.08]} p={[side*.36,y0+1.43,d/2+.14]} m={M.wood}/>
        <B s={[.07,.07,.10]} p={[side*.29,y0+.22,d/2+.10]} m={M.metal}/>
      </group>)}
      <B s={[1, 0.12, 0.5]} p={[0, 0.08, d / 2 + 0.35]} m={M.stone} />
      {attic && <Win p={[0, y0 + h + rh * 0.36, (d + 0.7) / 2 + 0.03]} m={win} />}
      {chim && <B s={[0.5, 1.1, 0.5]} p={[w * 0.28, y0 + h + rh * 0.75, -d * 0.2]} m={M.stone} />}
    </group>
  );
}

function Tower({ p }) {
  return (
    <group position={p}>
      <Cy r={[1.15, 1.3]} h={4.8} p={[0, 2.4, 0]} m={M.stone} seg={10} />
      <Cy r={[1.25, 1.25]} h={0.2} p={[0, 4.85, 0]} m={M.beam} seg={10} />
      <mesh position={[0, 6.05, 0]} material={M.roofB} castShadow><coneGeometry args={[1.6, 2.4, 10]} /></mesh>
      <Cy r={[0.42, 0.42]} h={0.1} p={[0, 3.6, 1.2]} rot={[Math.PI / 2, 0, 0]} m={M.white} />
      <Win p={[0, 2.2, 1.18]} m={DYN.hosp} />
    </group>
  );
}

// Dedicated modern hospital: single white rectangular footprint and FLAT roof.
// Roof top: y=4.64; rain collector starts above y=5.20.
const HOSPITAL = { x: 3, z: 0.5, width: 9.6, depth: 6.3, wallTop: 4.38, roofTop: 4.64 };
const hospitalWhite = mat("#f5f8f8", { roughness: 0.76, flatShading: false });
const hospitalTrim = mat("#d7e3e7", { roughness: 0.6, flatShading: false });
const hospitalGlass = mat("#264b61", { metalness: 0.22, roughness: 0.18, flatShading: false });
function Hospital({ live }) {
  const emergencyLight = useRef();
  useFrame(({clock}) => {
    const critical = live.current.hospital < 0.5;
    M.cross.emissiveIntensity = critical ? 0.45 + 0.4 * Math.abs(Math.sin(clock.elapsedTime * 5)) : 0.2;
    if (emergencyLight.current) emergencyLight.current.emissiveIntensity = critical ? 2.5 * Math.abs(Math.sin(clock.elapsedTime * 8)) : 0.5;
  });
  const {x,z,width:w,depth:d,wallTop,roofTop}=HOSPITAL;
  const front=z+d/2;
  return <group>
    {/* Foundation and white multi-storey block, all aligned to one footprint. */}
    <B s={[w+.24,.3,d+.24]} p={[x,.15,z]} m={M.stone}/>
    <B s={[w,wallTop-.3,d]} p={[x,(wallTop+.3)/2,z]} m={hospitalWhite}/>
    {/* Flush flat roof: no pitched House meshes, no gable, no clipping. */}
    <B s={[w+.12,roofTop-wallTop,d+.12]} p={[x,(roofTop+wallTop)/2,z]} m={hospitalTrim}/>
    {/* Flat roof parapets, separated from slab to avoid coincident surfaces. */}
    {[-1,1].map(side=><React.Fragment key={side}>
      <B s={[w+.2,.26,.12]} p={[x,roofTop+.13,z+side*(d/2+.04)]} m={hospitalWhite}/>
      <B s={[.12,.26,d+.2]} p={[x+side*(w/2+.04),roofTop+.13,z]} m={hospitalWhite}/>
    </React.Fragment>)}
    {/* Clean white front with real windows and emergency entrance. */}
    <B s={[w-.28,.2,.11]} p={[x,2.65,front+.065]} m={hospitalTrim}/>
    {[-3.4,-1.75,1.75,3.4].flatMap((dx)=>[1.75,3.35].map((y)=><group key={`${dx}-${y}`}>
      <B s={[1.10,1.05,.095]} p={[x+dx,y,front+.072]} m={hospitalTrim}/>
      <B s={[.92,.87,.10]} p={[x+dx,y,front+.13]} m={DYN.hosp}/>
      <B s={[.04,.87,.115]} p={[x+dx,y,front+.20]} m={hospitalTrim}/>
    </group>))}
    {/* Entrance canopy and double automatic glass doors. */}
    <B s={[2.6,.19,1.38]} p={[x,2.58,front+.63]} m={hospitalWhite}/>
    {[-1.2,1.2].map(i=><Cy key={i} r={[.095,.095]} h={2.15} p={[x+i,1.13,front+1.19]} m={M.metal} seg={12}/>)}
    <B s={[2.12,2.25,.15]} p={[x,1.43,front+.115]} m={hospitalTrim}/>
    <B s={[.99,2.08,.16]} p={[x-.51,1.40,front+.22]} m={hospitalGlass}/>
    <B s={[.99,2.08,.16]} p={[x+.51,1.40,front+.22]} m={hospitalGlass}/>
    <B s={[.05,2.1,.17]} p={[x,1.40,front+.30]} m={M.metal}/>
    {/* Large flush red medical cross, not a floating sign. */}
    <B s={[.26,1.04,.13]} p={[x,3.62,front+.15]} m={M.cross}/>
    <B s={[1.04,.26,.13]} p={[x,3.62,front+.15]} m={M.cross}/>
    {/* Opaque walls make the building credible; transparent inspection surface is clickable. */}
    <InspectedFacade type="hospital" p={[x,2.2,front+.27]} size={[w,4.2,.16]}/>
    {/* Ambulance on the driveway. */}
    <group position={[6.4,0,5.35]} rotation={[0,-.27,0]}>
      <B s={[1.9,.85,.95]} p={[0,.7,0]} m={M.white}/>
      <B s={[.7,.65,.95]} p={[1.2,.58,0]} m={M.white}/>
      <B s={[1.9,.13,.97]} p={[0,.75,0]} m={M.cross}/>
      {[-.6,.9].flatMap(xx=>[-.5,.5].map(zz=><Cy key={`${xx}-${zz}`} r={[.25,.25]} h={.15} p={[xx,.25,zz]} rot={[Math.PI/2,0,0]} m={M.dark} seg={10}/>))}
      <mesh position={[0,1.2,0]}><sphereGeometry args={[.13,10,10]}/><meshStandardMaterial ref={emergencyLight} color="#ff392a" emissive="#ff2010" emissiveIntensity={.5}/></mesh>
    </group>
  </group>;
}

/* ---------- nature ---------- */
function Tree({ p, s = 1, seed = 0, olive = false, live, healthKey="agri" }) {
  // Leaf silhouettes are instanced: detailed crowns without thousands of draw calls.
  const group = useRef(), leaves = useRef(), fallen = useRef();
  const count = olive ? 150 : 190;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const leafMat = olive ? DYN.olive : DYN.leaf[Math.floor(rnd(seed) * 3)];
  const positions = useMemo(() => Array.from({length:count}, (_,i) => {
    const a = rnd(i*3.13+seed*13)*Math.PI*2;
    const phi = Math.acos(2*rnd(i*4.71+seed*11)-1);
    const radius = Math.pow(rnd(i*8.93+seed*7),0.5);
    return {
      x: Math.sin(phi)*Math.cos(a)*radius*(olive?1.5:1.65),
      y: (olive?1.6:2.5)+Math.cos(phi)*radius*(olive?.70:1.15),
      z: Math.sin(phi)*Math.sin(a)*radius*(olive?1.25:1.5),
      angle:a, scale:.11+rnd(i*2.47+seed)*.17
    };
  }), [count,olive,seed]);
  useEffect(() => {
    if (!leaves.current || !fallen.current) return;
    positions.forEach((q,i) => {
      dummy.position.set(q.x,q.y,q.z);
      dummy.rotation.set(rnd(i+seed)*2, q.angle, (rnd(i*8+seed)-.5)*1.7);
      dummy.scale.set(q.scale,.018,q.scale*1.8); dummy.updateMatrix();
      leaves.current.setMatrixAt(i,dummy.matrix);
      dummy.position.set(q.x*1.15,.03+rnd(i+seed)*.025,q.z*1.2);
      dummy.rotation.set(0,q.angle,0);
      dummy.scale.set(q.scale*.85,.008,q.scale*1.4); dummy.updateMatrix();
      fallen.current.setMatrixAt(i,dummy.matrix);
    });
    leaves.current.instanceMatrix.needsUpdate=true;
    fallen.current.instanceMatrix.needsUpdate=true;
  },[dummy,positions,seed]);
  useFrame(({clock}) => {
    const health = clamp(live.current[healthKey]*(olive?1:0.7) + (olive?0:0.2) - live.current.heat*.10);
    const leafness = clamp((health-.06)/.77);
    if (leaves.current) leaves.current.count=Math.floor(count*(0.04+leafness*.96));
    if (fallen.current) fallen.current.count=Math.floor(count*(1-leafness)*.65);
    if (group.current) group.current.rotation.z = Math.sin(clock.elapsedTime*.7+seed)*.018*(1+live.current.wind*.025);
  });
  return <group ref={group} position={p} scale={s}>
    <Cy r={[olive?.13:.16,olive?.22:.27]} h={olive?1.35:1.8} p={[0,olive?.67:.9,0]} m={M.trunk} seg={10}/>
    {Array.from({length:7},(_,i)=> {
      const a=i*Math.PI*2/7;
      return <group key={i} position={[0,olive?1.1:1.65,0]} rotation={[Math.cos(a)*.6,a,-Math.sin(a)*.65]}>
        <Cy r={[.035,.1]} h={olive?.9:1.15} p={[0,.36,0]} m={M.trunk} seg={6}/>
      </group>;
    })}
    <instancedMesh ref={leaves} args={[null,null,count]} material={leafMat} castShadow><sphereGeometry args={[1,5,4]}/></instancedMesh>
    <instancedMesh ref={fallen} args={[null,null,count]} material={M.hay}><sphereGeometry args={[1,5,4]}/></instancedMesh>
  </group>;
}

function Palm({p, live, seed=0}) {
  const foliage=useRef();
  useFrame(()=>{if(foliage.current) foliage.current.scale.setScalar(.35+.65*clamp(live.current.agri));});
  return <group position={p}>
    {Array.from({length:7},(_,i)=><Cy key={i} r={[.13-i*.01,.20-i*.009]} h={.54} p={[Math.sin(i*.16)*.22,.30+i*.50,0]} m={M.trunk} seg={10}/>)}
    <group ref={foliage} position={[.27,3.95,0]}>
      {Array.from({length:11},(_,i)=>{
        const a=i*2*Math.PI/11;
        return <group key={i} rotation={[0,a,0]}>
          <mesh position={[0,-.28,1.12]} rotation={[.45,0,0]} castShadow material={DYN.leaf[i%3]}><sphereGeometry args={[.18,7,4]}/></mesh>
          {Array.from({length:9},(_,j)=> <group key={j} position={[0,-.04-j*.075,.30+j*.25]}>
            <mesh scale={[1,.07,.28]} position={[-.32,0,0]} rotation={[0,.2,-.15]} material={DYN.leaf[(i+j)%3]}><sphereGeometry args={[.36,7,5]}/></mesh>
            <mesh scale={[1,.07,.28]} position={[.32,0,0]} rotation={[0,-.2,.15]} material={DYN.leaf[(i+j+1)%3]}><sphereGeometry args={[.36,7,5]}/></mesh>
          </group>)}
        </group>;
      })}
    </group>
  </group>;
}

function Bush({ p, seed = 0, flowers = true }) {
  const cols = ["#e0574a", "#f0c24a", "#f4eaf0", "#c26ad0"];
  return (
    <group position={p}>
      <Sp r={0.42} p={[0, 0.3, 0]} m={DYN.leaf[seed % 3]} sc={[1.2, 0.8, 1.2]} />
      {flowers && [0, 1, 2, 3].map((i) => <mesh key={i} position={[Math.cos(i * 1.6 + seed) * 0.4, 0.5 + rnd(i + seed) * 0.15, Math.sin(i * 1.6 + seed) * 0.4]}><sphereGeometry args={[0.07, 6, 6]} /><meshStandardMaterial color={cols[(i + seed) % 4]} /></mesh>)}
    </group>
  );
}

function Fence({ a, b }) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), n = Math.max(2, Math.round(L / 1.2));
  return (
    <group position={[a[0], 0, a[1]]} rotation={[0, Math.atan2(dx, dz), 0]}>
      {Array.from({ length: n + 1 }).map((_, i) => <B key={i} s={[0.12, 0.8, 0.12]} p={[0, 0.4, (L / n) * i]} m={M.wood} />)}
      <B s={[0.07, 0.08, L]} p={[0, 0.65, L / 2]} m={M.wood} />
      <B s={[0.07, 0.08, L]} p={[0, 0.35, L / 2]} m={M.wood} />
    </group>
  );
}

const Strip = ({ a, b, w = 1.3 }) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
  return <B s={[w, 0.05, L]} p={[(a[0] + b[0]) / 2, 0.03, (a[1] + b[1]) / 2]} r={[0, Math.atan2(dx, dz), 0]} m={M.cobble} c={false} />;
};

function FountainPool({live}){
  const ref=useRef();
  useFrame(()=>{if(ref.current)ref.current.visible=!!live.current.hospitalWaterOn;});
  return <mesh ref={ref} position={[0,.51,0]}><cylinderGeometry args={[1.3,1.3,.06,24]}/><meshStandardMaterial color="#59c1eb" metalness={.2} roughness={.14}/></mesh>;
}
function Fountain({ p, live }) {
  const drops = useRef([]);
  useFrame(({ clock }) => drops.current.forEach((d, i) => {
    if (!d) return;
    d.visible = !!live.current.hospitalWaterOn;
    if (!d.visible) return;
    const u = (clock.elapsedTime * 0.8 + i / 10) % 1, a = (i / 10) * 6.28;
    d.position.set(Math.cos(a) * u * 0.9, 1.9 + Math.sin(u * Math.PI) * 0.7 - u * 0.9, Math.sin(a) * u * 0.9);
  }));
  return (
    <group position={p}>
      <Cy r={[1.5, 1.6]} h={0.55} p={[0, 0.27, 0]} m={M.stone} seg={16} />
      <FountainPool live={live}/>

      <Cy r={[0.2, 0.3]} h={1.4} p={[0, 1.1, 0]} m={M.stone} seg={8} />
      <Cy r={[0.6, 0.3]} h={0.2} p={[0, 1.7, 0]} m={M.stone} seg={12} />
      {Array.from({ length: 10 }).map((_, i) => <mesh key={i} ref={(e) => (drops.current[i] = e)}><sphereGeometry args={[0.06, 6, 6]} /><meshBasicMaterial color="#9fd8f5" /></mesh>)}
    </group>
  );
}

function Smoke({ p }) {
  const r = useRef([]);
  useFrame(({ clock }) => r.current.forEach((m, i) => { if (!m) return; const u = (clock.elapsedTime * 0.25 + i / 4) % 1; m.position.set(u * 0.6, u * 2.2, 0); m.scale.setScalar(0.15 + u * 0.5); }));
  return <group position={p}>{[0, 1, 2, 3].map((i) => <mesh key={i} ref={(e) => (r.current[i] = e)} material={M.smoke}><sphereGeometry args={[1, 8, 8]} /></mesh>)}</group>;
}

function Cloud({ p, s = 1, i }) {
  const g = useRef();
  useFrame((_, dt) => { if (g.current) { g.current.position.x += dt * (0.5 + i * 0.1); if (g.current.position.x > 70) g.current.position.x = -70; } });
  return (
    <group ref={g} position={p} scale={s}>
      {[[0, 0, 0, 2.2], [2, -0.2, 0.4, 1.7], [-2, -0.2, 0.2, 1.6], [0.8, 0.8, 0, 1.5]].map((c, k) => <mesh key={k} position={[c[0], c[1], c[2]]} scale={[1, 0.65, 0.9]} material={M.cloud}><icosahedronGeometry args={[c[3], 1]} /></mesh>)}
    </group>
  );
}

const PEOPLE = [
  ...Array.from({ length: 7 }, (_, i) => ({ k: "plaza", a: i * 0.9, sp: 0.16 + rnd(i) * 0.12, rx: 3.6 + rnd(i + 9) * 1.4, rz: 3 + rnd(i + 4) * 1.2, c: ["#c0392b", "#2e7d6b", "#d9a441", "#3b6ea5", "#8e5a9b"][i % 5] })),
  ...[0, 1, 2].map((i) => ({ k: "farm", x0: i === 2 ? 13.5 : 4, z: i === 1 ? -8.8 : -7.2, a: i * 2, sp: 0.07 + i * 0.02, c: ["#d9a441", "#8a5a3b", "#3b6ea5"][i] }))
];
function Villagers({ live }) {
  const refs = useRef([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, k = 0.3 + 0.7 * live.current.homes;
    PEOPLE.forEach((q, i) => {
      const g = refs.current[i]; if (!g) return;
      const a = q.a + t * q.sp * k;
      let x, z, dx, dz;
      if (q.k === "plaza") { x = 3 + Math.cos(a) * q.rx; z = 7 + Math.sin(a) * q.rz; dx = -Math.sin(a) * q.rx; dz = Math.cos(a) * q.rz; }
      else { x = q.x0 + Math.sin(a) * 3; z = q.z; dx = Math.cos(a); dz = 0; }
      g.position.set(x, 0.05 + Math.abs(Math.sin(t * 6 + i)) * 0.05, z);
      g.rotation.y = Math.atan2(dx, dz);
    });
  });
  return PEOPLE.map((q, i) => (
    <group key={i} ref={(e) => (refs.current[i] = e)}>
      <mesh position={[0, 0.5, 0]} castShadow><capsuleGeometry args={[0.16, 0.45, 4, 8]} /><meshStandardMaterial color={q.c} flatShading /></mesh>
      <mesh position={[0, 1.05, 0]} castShadow material={M.skin}><sphereGeometry args={[0.15, 8, 8]} /></mesh>
      {q.k === "farm" && <mesh position={[0, 1.2, 0]} material={M.hay}><cylinderGeometry args={[0.28, 0.28, 0.04, 10]} /></mesh>}
    </group>
  ));
}

/* ---------- pipes, cables, energy ---------- */
function Pipe({ pts, r = 0.12, m = M.pipe, flow, n = 8, speed = 0.12, live, color = "#6bc6f5", activeKey }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.05), [pts]);
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 48, r, 8), [curve, r]);
  const beads = useRef([]);
  useFrame(({ clock }) => {
    if (!flow) return;
    const on = live.current[activeKey];
    beads.current.forEach((b, i) => { if (!b) return; b.visible = !!on; if (on) b.position.copy(curve.getPointAt((clock.elapsedTime * speed + i / n) % 1)); });
  });
  return (
    <group>
      <mesh geometry={geo} material={m} castShadow />
      {flow && Array.from({ length: n }).map((_, i) => <mesh key={i} ref={(e) => (beads.current[i] = e)}><sphereGeometry args={[r * 0.95, 8, 8]} /><meshBasicMaterial color={color} /></mesh>)}
    </group>
  );
}
function Cable({ pts, live, activeKey="energyOn" }) {
  const lifted = useMemo(() => pts.map((p) => [p[0], p[1] - 0.1, p[2]]), [pts]);
  return (
    <group>
      {pts.map((p, i) => (
        <group key={i} position={[p[0], 0, p[2]]}>
          <Cy r={[0.07, 0.1]} h={p[1]} p={[0, p[1] / 2, 0]} m={M.trunk} seg={6} />
          <B s={[0.9, 0.07, 0.07]} p={[0, p[1] - 0.1, 0]} m={M.wood} />
        </group>
      ))}
      <Pipe pts={lifted} r={0.03} m={M.dark} flow n={7} speed={0.18} color="#ffc23a" activeKey={activeKey} live={live} />
    </group>
  );
}

// Route constants (module level so geometry is built once)
const W_INLET = [[-14.4, 0.4, -3.4], [-12.9, 0.4, -2.4], [-11.6, 0.4, -1.4], [-11.6, 0.4, -0.9]];
const W_OUT1 = [[-10.7, 0.4, -0.5], [-9.2, 0.35, 0.8]];
const W_OUT2 = [[-10.7, 0.4, 1.7], [-9.2, 0.35, 0.8]];
const W_HOSP = [[-9.2, 0.35, 0.8], [-5, 0.35, 2.8], [0.2, 0.35, 3.0], [1.1, 0.35, 2.6]];
const W_HOME = [[-5, 0.35, 2.8], [-5, 0.35, 8], [-3.3, 0.35, 8.3]];
const W_AGRI_A = [[-9.2, 0.35, 0.8], [-6, 0.35, -3.2], [-1.5, 0.35, -4.2], [-0.3, 0.35, -5]];
const W_AGRI_B = [[-1.5, 0.35, -4.2], [9.2, 0.35, -4.2], [9.2, 0.35, -5]];
const E_HOSP = [[-8.5, 2.6, 3.4], [-4.5, 2.6, 4.3], [-1.6, 2.6, 4.1]];
const E_AGRI = [[-8.5, 2.6, 3.4], [-6, 2.6, -1], [0, 2.6, -3], [8, 2.6, -3], [16.5, 2.6, -3.6]];
const E_PUMP = [[-8.5, 1.3, 3.4], [-9.6, 1.0, 1.2], [-11, 1.0, 0.6]];

function Field({ p, w = 8, d = 5, live }) {
  const rows = 6, cols = Math.floor(w / 0.55);
  const crops = useRef(), drops = useRef(), dummy = useMemo(() => new THREE.Object3D(), []);
  const sp = [-w / 3, 0, w / 3];
  useEffect(() => {
    let k = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      dummy.position.set(-w / 2 + 0.45 + (c * (w - 0.9)) / (cols - 1), 0.3, -d / 2 + 0.5 + (r * (d - 1)) / (rows - 1));
      dummy.scale.setScalar(0.8 + rnd(r * 50 + c) * 0.5); dummy.updateMatrix(); crops.current.setMatrixAt(k++, dummy.matrix);
    }
    crops.current.instanceMatrix.needsUpdate = true;
  }, [w, d, cols, dummy]);
  useFrame(({ clock }) => {
    const on = live.current.sprayOn;
    if (crops.current) crops.current.scale.y = .17+.83*clamp(live.current.agri);
    drops.current.visible = on; if (!on) return; let k = 0;
    sp.forEach((sx, si) => { for (let j = 0; j < 10; j++) {
      const u = (clock.elapsedTime * 0.9 + j / 10 + si * 0.3) % 1, a = (j / 10) * 6.28, rad = u * 1.6;
      dummy.position.set(sx + Math.cos(a) * rad, 1 + Math.sin(u * Math.PI) * 0.6 - u * 0.95, Math.sin(a) * rad); dummy.scale.setScalar(1); dummy.updateMatrix(); drops.current.setMatrixAt(k++, dummy.matrix);
    } });
    drops.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group position={p}>
      <B s={[w + 0.3, 0.14, d + 0.3]} p={[0, 0.06, 0]} m={M.wood} />
      <B s={[w, 0.18, d]} p={[0, 0.1, 0]} m={M.soil} />
      {Array.from({ length: rows }).map((_, r) => <React.Fragment key={r}>
        <B s={[w - 0.3, 0.12, 0.42]} p={[0, 0.2, -d / 2 + 0.5 + (r * (d - 1)) / (rows - 1)]} m={M.dirt} c={false} />
        <Cy r={[0.035, 0.035]} h={w + 0.3} p={[-0.15, 0.27, -d / 2 + 0.5 + (r * (d - 1)) / (rows - 1) + 0.22]} rot={[0, 0, Math.PI / 2]} m={M.pipe} seg={6} c={false} />
      </React.Fragment>)}
      <Cy r={[0.1, 0.1]} h={d + 1} p={[-w / 2 - 0.3, 0.3, 0]} rot={[Math.PI / 2, 0, 0]} m={M.pipe} seg={8} />
      {sp.map((sx, i) => <group key={i} position={[sx, 0, 0]}><Cy r={[0.04, 0.04]} h={0.9} p={[0, 0.5, 0]} m={M.pipe} seg={6} /><Cy r={[0.12, 0.12]} h={0.1} p={[0, 0.98, 0]} m={M.valve} seg={8} /></group>)}
      <instancedMesh ref={crops} args={[null, null, rows * cols]} material={DYN.crop} castShadow receiveShadow><icosahedronGeometry args={[0.22, 0]} /></instancedMesh>
      <instancedMesh ref={drops} args={[null, null, 30]}><sphereGeometry args={[0.05, 6, 6]} /><meshBasicMaterial color="#9fd8f5" /></instancedMesh>
    </group>
  );
}

function Pump({ p, live }) {
  const fw = useRef();
  useFrame((_, dt) => { if (fw.current && live.current.pumpOn) fw.current.rotation.x += dt * 9; });
  return (
    <group position={p}>
      <B s={[1.5, 0.2, 1]} p={[0, 0.1, 0]} m={M.stone} />
      <Cy r={[0.34, 0.34]} h={1.1} p={[0, 0.58, 0]} rot={[0, 0, Math.PI / 2]} m={M.gold} />
      <B s={[0.5, 0.35, 0.5]} p={[-0.1, 1, 0]} m={M.dark} />
      <group ref={fw} position={[0.75, 0.58, 0]}>
        <mesh rotation={[0, Math.PI / 2, 0]} material={M.metal}><torusGeometry args={[0.36, 0.05, 6, 16]} /></mesh>
        <B s={[0.05, 0.7, 0.05]} p={[0, 0, 0]} m={M.metal} /><B s={[0.05, 0.05, 0.7]} p={[0, 0, 0]} m={M.metal} />
      </group>
    </group>
  );
}

function Pond({ live }) {
  const w = useRef();
  useFrame(() => { if (!w.current) return; const s = 0.12 + clamp(live.current.tank) * 0.55; w.current.scale.y = s; w.current.position.y = 0.08 + s / 2; });
  return (
    <group position={[-16, 0, -3.5]}>
      <Cy r={[3.2, 3.2]} h={0.3} p={[0, 0.1, 0]} m={M.dirt} seg={32} />
      <mesh ref={w} material={M.water} receiveShadow><cylinderGeometry args={[3, 3, 1, 32]} /></mesh>
      <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.stone} castShadow><torusGeometry args={[3.25, 0.32, 6, 40]} /></mesh>
      {Array.from({ length: 8 }).map((_, i) => <Cy key={i} r={[0.03, 0.03]} h={1.1} p={[Math.cos(i * 0.8) * 3.4, 0.55, Math.sin(i * 0.8) * 3.4]} m={DYN.leaf[1]} seg={5} />)}
    </group>
  );
}

function Solar({ p, rows = 3, cols = 4 }) {
  return (
    <group position={p}>
      {Array.from({ length: rows }).flatMap((_, r) => Array.from({ length: cols }).map((__, c) => (
        <group key={`${r}${c}`} position={[c * 1.55, 0, r * 2.1]}>
          <mesh position={[0, 0.8, 0]} rotation={[-0.55, 0, 0]} material={M.solar} castShadow><boxGeometry args={[1.4, 0.07, 1.8]} /></mesh>
          <B s={[0.07, 0.8, 0.07]} p={[0, 0.4, -0.2]} m={M.metal} />
        </group>
      )))}
    </group>
  );
}

function Turbine({ p, live }) {
  const rot = useRef();
  useFrame((_, dt) => { if (rot.current) rot.current.rotation.z -= dt * (0.4 + live.current.wind * 0.12); });
  return (
    <group position={p}>
      <Cy r={[0.14, 0.28]} h={8} p={[0, 4, 0]} m={M.white} seg={8} />
      <group ref={rot} position={[0, 8, 0.4]}>
        <Sp r={0.3} m={M.white} p={[0, 0, 0]} />
        {[0, 1, 2].map((i) => <group key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]}><B s={[0.22, 3.4, 0.06]} p={[0, 1.8, 0]} m={M.white} /></group>)}
      </group>
    </group>
  );
}

function Cabinet({ p }) {
  return (
    <group position={p}>
      <B s={[1.5, 1.5, 0.9]} p={[0, 0.75, 0]} m={M.gold} />
      <B s={[1.2, 0.1, 0.7]} p={[0, 1.55, 0]} m={M.dark} />
      <B s={[0.5, 0.5, 0.05]} p={[0, 0.85, 0.47]} m={M.dark} />
      <B s={[0.12, 0.34, 0.06]} p={[0, 0.85, 0.5]} m={M.gold} r={[0, 0, 0.3]} />
    </group>
  );
}

/* ---------- Tunisian architectural details, inspection and flags ---------- */
function InspectedFacade({type, p, size=[4,3,4]}) {
  return <mesh position={p} userData={{inspect:type}}>
    <boxGeometry args={size}/>
    <meshBasicMaterial transparent opacity={0} depthWrite={false} color="#ffffff" />
  </mesh>;
}
function Arch({p=[0,0,0],r=0,w=2.5,h=2.6}) {
  return <group position={p} rotation={[0,r,0]}>
    <B s={[.20,h-1,.24]} p={[-w/2,(h-1)/2,0]} m={M.plaster}/>
    <B s={[.20,h-1,.24]} p={[w/2,(h-1)/2,0]} m={M.plaster}/>
    <mesh position={[0,h-1,0]} rotation={[0,0,Math.PI]} material={M.plaster}>
      <torusGeometry args={[w/2,.12,8,28,Math.PI]}/>
    </mesh>
    <B s={[w+.4,.12,.30]} p={[0,h,0]} m={M.plaster}/>
  </group>;
}
function TileDetails({p,w=3,d=2.6,roofH=1.5,r=0}) {
  const over=.35, slope=Math.atan2(roofH,w/2+over);
  return <group position={p} rotation={[0,r,0]}>
    {[-1,1].flatMap(side=>Array.from({length:6},(_,j)=>{
      const f=(j+.5)/6;
      return <group key={`${side}-${j}`} position={[side*f*(w/2+over),roofH*(1-f),0]} rotation={[0,0,side*slope]}>
        <B s={[.025,.025,d+.65]} p={[0,0,0]} m={M.roofD} c={false}/>
      </group>;
    }))}
    {Array.from({length:8},(_,j)=><B key={j} s={[w+.7,.025,.025]} p={[0,roofH*.5,-d/2+(j+.5)*(d+.65)/8]} m={M.roofC} c={false}/>)}
  </group>;
}
function Flag({p,kind}) {
  const texture=useMemo(()=>{
    const cv=document.createElement('canvas'); cv.width=256;cv.height=160;
    const ctx=cv.getContext('2d');
    ctx.fillStyle=kind==='tn'?'#d32334':'#fff';ctx.fillRect(0,0,256,160);
    ctx.fillStyle=kind==='tn'?'#fff':'#c42034';ctx.beginPath();ctx.arc(128,80,kind==='tn'?48:39,0,Math.PI*2);ctx.fill();
    if(kind==='tn'){
      // Correct flag: red field, white disc, red crescent, red five-point star.
      // Cresent is formed by cutting a smaller white circle from a red disc.
      ctx.fillStyle='#e70013';ctx.beginPath();ctx.arc(116,80,32,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(128,72,27,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#e70013';ctx.beginPath();
      const cx=153,cy=80;
      for(let i=0;i<10;i++){
        const a=-Math.PI/2+i*Math.PI/5;const radius=i%2===0?18:7.2;
        const x=cx+Math.cos(a)*radius,y=cy+Math.sin(a)*radius;
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.closePath();ctx.fill();
    }
    const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;return tex;
  },[kind]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  const cloth=useRef();
  useFrame(({clock})=>{if(cloth.current) cloth.current.rotation.y=Math.sin(clock.elapsedTime*2+(kind==='tn'?0:1))*.11;});
  return <group position={p}>
    <Cy r={[.055,.09]} h={7.5} p={[0,3.75,0]} m={M.metal} seg={10}/>
    <Sp r={.12} p={[0,7.55,0]} m={M.gold}/>
    <group ref={cloth} position={[1.26,6.7,0]}>
      <mesh material={new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide})}>
        <planeGeometry args={[2.45,1.48,16,6]}/>
      </mesh>
    </group>
  </group>;
}
function BackupDepot({ p=[-16,0,-13], backup, onInspect }) {
  const water=(backup?.rainCollectedLiters||0)/650;
  const energy=Math.min(1,(backup?.storedSolarKwh||0)/4);
  return <group position={p}>
    <B s={[6.8,.4,5.3]} p={[0,.2,0]} m={M.stone}/>
    <B s={[6.2,3.5,4.8]} p={[0,2.05,0]} m={M.plaster}/>
    <B s={[6.5,.22,5]} p={[0,3.93,0]} m={M.metal}/>
    <B s={[1.9,2.8,.1]} p={[0,1.55,2.46]} m={M.dark}/>
    <B s={[1.5,.15,.08]} p={[0,3.5,2.52]} m={M.gold}/>
    <B s={[5.5,.8,.12]} p={[0,3.08,2.5]} m={M.dark}/>
    <Html position={[0,3.08,2.62]} center transform distanceFactor={10} style={{pointerEvents:'none'}}>
      <div className="depot-sign">BACKUP STORAGE<small>WATER · ENERGY · RAIN</small></div>
    </Html>
    {/* Physical distinct blue water cistern and gold electrical battery. */}
    <Cy r={[.90,.90]} h={2.4} p={[-2,1.5,3.2]} m={M.metal}/>
    <Cy r={[.73,.73]} h={Math.max(.02,2.08*water)} p={[-2,.35+Math.max(.02,2.08*water)/2,3.2]} m={M.water}/>
    <B s={[1.3,2.4,1.2]} p={[2,1.4,3.15]} m={M.dark}/>
    <B s={[1.1,Math.max(.05,1.9*energy),.16]} p={[2,.3+Math.max(.05,1.9*energy)/2,3.84]} m={M.gold}/>
    <mesh position={[0,2.05,2.58]} userData={{inspect:'backup-storage'}}>
      <boxGeometry args={[7.4,4.4,6.4]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/>
    </mesh>
  </group>;
}

function Pebbles() {
 const nodes=useMemo(()=>Array.from({length:155},(_,i)=>{
   const a=i*2.39996;const rad=5.4+Math.sqrt(i/155)*17;
   return [Math.sin(a)*rad,.05,Math.cos(a)*rad];
 }).filter(([x,y,z])=>x>-10||z>12),[]);
 return <group>{nodes.map((p,i)=><mesh key={i} position={p} rotation={[0,i*.4,0]} receiveShadow material={i%3===0?M.stone:M.cobble}>
   <dodecahedronGeometry args={[.12+rnd(i)*.18,0]}/>
 </mesh>)}</group>;
}
/* ---------- interaction layer ---------- */
const COIN_BLUE = "#5A9FC9", COIN_GOLD = "#E8A317";
function Coins({ p, n, color }) {
  const g = useRef();
  useFrame(({ clock }) => { if (g.current) g.current.position.y = p[1] + Math.sin(clock.elapsedTime * 2 + p[0]) * 0.05; });
  if (!n) return null;
  const k = Math.min(n, 12);
  return (
    <group ref={g} position={p}>
      {Array.from({ length: k }).map((_, i) => <mesh key={i} position={[0, i * 0.17, 0]} castShadow><cylinderGeometry args={[0.42, 0.42, 0.13, 24]} /><meshStandardMaterial color={color} metalness={0.8} roughness={0.3} emissive={color} emissiveIntensity={0.35} /></mesh>)}
      <Html position={[0, k * 0.17 + 0.5, 0]} center distanceFactor={20} style={{ pointerEvents: "none" }}><div className="coin-count" style={{ color }}>{n}</div></Html>
    </group>
  );
}

function Pad({ zone, p, s, hover, dragging }) {
  const m = useRef();
  useFrame(() => { if (m.current) m.current.opacity += ((hover === zone ? 0.42 : dragging ? 0.14 : 0) - m.current.opacity) * 0.2; });
  return (
    <group position={p}>
      <mesh userData={{ zone }}><boxGeometry args={s} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
      <mesh position={[0, -s[1] / 2 + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[s[0], s[2]]} /><meshBasicMaterial ref={m} color="#ffe29a" transparent opacity={0} depthWrite={false} /></mesh>
    </group>
  );
}

function Picker({ pickRef, onInspect, onZoneClick }) {
  const { gl, camera, scene } = useThree();
  useEffect(() => {
    const ray = new THREE.Raycaster(), v = new THREE.Vector2();
    const findHits = (cx, cy) => {
      const r = gl.domElement.getBoundingClientRect();
      v.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(v, camera);
      return ray.intersectObjects(scene.children, true);
    };
    pickRef.current = (cx, cy) => {
      const hit = findHits(cx, cy).find((h) => h.object.userData.zone);
      return hit ? hit.object.userData.zone : null;
    };
    let start = null;
    const down = (e) => { start = {x: e.clientX, y:e.clientY, t:performance.now()}; };
    const up = (e) => {
      if (!start || Math.hypot(e.clientX-start.x, e.clientY-start.y) > 7 || performance.now()-start.t > 700) { start=null; return; }
      start = null;
      const hits=findHits(e.clientX,e.clientY);
      const zone=hits.find(h=>h.object.userData.zone);
      const placed=zone && onZoneClick ? onZoneClick(zone.object.userData.zone) : false;
      const hit = hits.find(h => h.object.userData.inspect);
      if (hit && onInspect && !placed) onInspect(hit.object.userData.inspect);
    };
    gl.domElement.addEventListener('pointerdown', down);
    gl.domElement.addEventListener('pointerup', up);
    return () => {
      gl.domElement.removeEventListener('pointerdown', down);
      gl.domElement.removeEventListener('pointerup', up);
    };
  }, [gl, camera, scene, pickRef, onInspect, onZoneClick]);
  return null;
}

const statusOf = (v) => (v >= 0.7 ? ["STABLE", "ok"] : v >= 0.35 ? ["AT RISK", "risk"] : ["CRITICAL", "crit"]);
function ZoneTag({ p, title, k, live }) {
  const el = useRef();
  useFrame(() => {
    if (!el.current) return; const L = live.current;
    const v = k === "z1" ? Math.min(L.hospital, L.homes) : k === "z2" ? (L.pumpOn ? Math.min(1, L.tank * 1.6) : Math.min(0.25, L.tank)) : L.agri;
    const [t, c] = statusOf(v); el.current.dataset.s = c; el.current.lastChild.textContent = t;
  });
  return (
    <Html position={p} center distanceFactor={24} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
      <div ref={el} className="zone-tag" data-s="ok"><b>{title}</b><em>STABLE</em></div>
    </Html>
  );
}

const VIEWS = { overview: { p: [27, 19, 29], t: [0, 0, -1] }, z1: { p: [15, 9, 19], t: [3, 1, 5] }, z2: { p: [-3, 9, 15], t: [-13, 0, 0] }, z3: { p: [19, 11, 2], t: [7, 0, -10] } };
function CameraRig({ view }) {
  const { camera, controls } = useThree();
  const fly = useRef({ t: 0, p: new THREE.Vector3(), tg: new THREE.Vector3() });
  useEffect(() => { const v = VIEWS[view.name] || VIEWS.overview; fly.current.p.set(...v.p); fly.current.tg.set(...v.t); fly.current.t = 1.8; }, [view]);
  useFrame((_, dt) => { const f = fly.current; if (f.t > 0 && controls) { f.t -= dt; camera.position.lerp(f.p, 0.06); controls.target.lerp(f.tg, 0.06); controls.update(); } });
  return null;
}

/* ---------- state driver: blends base -> target and animates materials/lights ---------- */
function Driver({ scenario, base, target, progressRef, live, sun, hemi }) {
  const { scene } = useThree();
  const c1 = useMemo(() => new THREE.Color("#fff1d0"), []), c2 = useMemo(() => new THREE.Color("#ff9a4d"), []);
  const f1 = useMemo(() => new THREE.Color("#bfdcee"), []), f2 = useMemo(() => new THREE.Color("#dca56c"), []), fg = useMemo(() => new THREE.Color("#8d8a84"), []);
  useFrame(() => {
    const p = progressRef.current, L = live.current;
    ["hospital", "homes", "agri", "tank"].forEach((k) => { L[k] = lerp(base[k], target[k], p); });
    const heat = clamp((scenario.temperature - 28) / 27), poll = clamp(scenario.pollution / 100);
    L.heat = heat; L.wind = scenario.wind_speed;
    // Separate resource flows by endpoint; moving water to one sector does not water another.
    const stage = p < .04 ? base : target;
    L.pumpOn = !!stage.pump;
    L.hospitalWaterOn = !!stage.hospitalWater && L.pumpOn;
    L.householdWaterOn = !!stage.householdWater && L.pumpOn;
    L.agriWaterOn = !!stage.agricultureWater && L.pumpOn;
    L.sprayOn = L.agriWaterOn;
    L.hospitalEnergyOn = !!stage.hospitalEnergy;
    L.energyOn = L.pumpOn || L.hospitalEnergyOn;
    const dry = clamp((1 - L.agri) * 0.9 + heat * 0.15);
    DYN.crop.color.lerpColors(OK.crop, DRY.crop, dry); DYN.olive.color.lerpColors(OK.olive, DRY.olive, dry);
    DYN.leaf.forEach((m, i) => m.color.lerpColors(OK.leaf[i], DRY.leaf[i], dry));
    DYN.grass.color.lerpColors(OK.grass, DRY.grass, clamp(heat * 0.55 + dry * 0.45));
    const grid = scenario.grid_status !== "OFF";
    DYN.home.emissiveIntensity = lerp(0.03, 1, clamp(L.homes * 1.1)) * (grid ? 1 : 0.15);
    DYN.hosp.emissiveIntensity = lerp(0.05, 1.1, clamp(L.hospital));
    sun.current.color.lerpColors(c1, c2, heat); sun.current.intensity = 2.4 + heat * 0.8;
    hemi.current.intensity = 0.55 + heat * 0.15;
    if (scene.fog) { scene.fog.color.lerpColors(f1, f2, heat).lerp(fg, poll * 0.45); scene.fog.near = lerp(55, 22, clamp(heat * 0.6 + poll * 0.5)); scene.fog.far = lerp(140, 75, clamp(heat * 0.6 + poll * 0.5)); }
  });
  return null;
}

/* ---------- world ---------- */
const HOUSES = [
  { p: [-2, 0, 6], r: Math.PI / 2, w: 3, d: 2.6, h: 1.9, rh: 1.6, wall: M.plaster2, roof: M.roofA },
  { p: [8.6, 0, 5], r: -Math.PI / 2, w: 3.2, d: 2.8, h: 2.6, rh: 1.7, wall: M.plaster, roof: M.roofB },
  { p: [8.8, 0, 10], r: -Math.PI / 2, w: 2.8, d: 2.6, h: 1.8, rh: 1.5, wall: M.plaster3, roof: M.roofD },
  { p: [-1.5, 0, 11.2], r: Math.PI / 2, w: 3.2, d: 2.8, h: 2.7, rh: 1.7, wall: M.plaster, roof: M.roofC },
  { p: [4, 0, 13.2], r: Math.PI, w: 3, d: 2.6, h: 1.9, rh: 1.6, wall: M.plaster2, roof: M.roofB }
];
const FOREST = Array.from({ length: 16 }, (_, i) => { const a = 0.4 + i * 0.5 + rnd(i) * 0.3, r = 20 + rnd(i + 3) * 4; return [Math.cos(a) * r, 0, Math.sin(a) * r]; }).filter((p) => !(p[0] > -8 && p[0] < 24 && p[2] < -14)).filter((p) => !(p[0] < -14 && p[2] < 12));

// Solid deployable curved canopy over the FLAT hospital roof.
// All heights are measured against HOSPITAL.roofTop, avoiding roof intersections.
function RainCapture({ weather, live }) {
  const hinge = useRef();
  const tank = useRef();
  const deployed = !!weather?.deployed && Number(weather?.rainfall_mm) > 0;
  const canopyGeometry = useMemo(() => {
    const U=28,V=16, vertices=[],indices=[], thickness=.095;
    const elevation=(u,v)=>.13+.34*Math.sin(Math.PI*u)+.06*v;
    // Top and bottom layers -> real closed volume rather than a ghostly plane.
    for(let layer=0;layer<2;layer++) for(let i=0;i<=U;i++) for(let j=0;j<=V;j++){
      const u=i/U,v=j/V;
      vertices.push((u-.5)*7.3,elevation(u,v)-(layer?thickness:0),v*3.35);
    }
    const n=(U+1)*(V+1), id=(layer,i,j)=>layer*n+i*(V+1)+j;
    for(let i=0;i<U;i++)for(let j=0;j<V;j++){
      let a=id(0,i,j),b=id(0,i+1,j),c=id(0,i,j+1),d=id(0,i+1,j+1);
      indices.push(a,c,b,b,c,d);
      a=id(1,i,j);b=id(1,i+1,j);c=id(1,i,j+1);d=id(1,i+1,j+1);
      indices.push(a,b,c,b,d,c);
    }
    for(let i=0;i<U;i++) for(const j of [0,V]){
      const a=id(0,i,j),b=id(0,i+1,j),c=id(1,i,j),d=id(1,i+1,j);
      indices.push(a,b,c,b,d,c);
    }
    for(let j=0;j<V;j++) for(const i of [0,U]){
      const a=id(0,i,j),b=id(0,i,j+1),c=id(1,i,j),d=id(1,i,j+1);
      indices.push(a,c,b,b,c,d);
    }
    const geom=new THREE.BufferGeometry();
    geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geom.setIndex(indices);geom.computeVertexNormals();
    return geom;
  },[]);
  const canopyMaterial=useMemo(()=>new THREE.MeshPhysicalMaterial({
    color:'#6aa9c7',metalness:.17,roughness:.32,clearcoat:.55,
    side:THREE.DoubleSide,transparent:false,depthWrite:true
  }),[]);
  useEffect(()=>()=>{canopyGeometry.dispose();canopyMaterial.dispose();},[canopyGeometry,canopyMaterial]);
  useFrame((_,dt)=>{
    // Closed canopy folds UP from its rear hinge, safely away from the roof.
    if(hinge.current) hinge.current.rotation.x=THREE.MathUtils.damp(
      hinge.current.rotation.x, deployed?0:-1.2,2.5,dt
    );
    if(tank.current) tank.current.scale.y=THREE.MathUtils.damp(tank.current.scale.y,
      deployed?Math.min(.95,.22+(Number(weather?.captured_liters)||0)/1200):.08,1.5,dt);
  });
  const hingeY=HOSPITAL.roofTop+.58;
  const hingeZ=HOSPITAL.z-1.65;
  return <group>
    {/* Roof-mounted supports. Minimum canopy surface clearance > 0.45 m. */}
    {[-3.25,3.25].map(dx=><group key={dx}>
      <Cy r={[.065,.065]} h={.58} p={[HOSPITAL.x+dx,HOSPITAL.roofTop+.29,hingeZ]} m={M.metal} seg={10}/>
      <Cy r={[.075,.075]} h={.58} p={[HOSPITAL.x+dx,HOSPITAL.roofTop+.29,hingeZ+3.1]} m={M.metal} seg={10}/>
    </group>)}
    <group position={[HOSPITAL.x,hingeY,hingeZ]} ref={hinge}>
      <mesh geometry={canopyGeometry} material={canopyMaterial} castShadow receiveShadow/>
      {/* Real structural ribs, located just below the canopy shell. */}
      {Array.from({length:9},(_,i)=>{
        const u=i/8;
        return <B key={i} p={[(u-.5)*7.3,.13+.34*Math.sin(Math.PI*u)-.07,1.675]} s={[.055,.075,3.25]} m={M.metal}/>;
      })}
      {/* Demonstration-only droplet strips: no usable pump energy credited. */}
      {[-2.8,-1.4,0,1.4,2.8].map(xx=><B key={xx} s={[.065,.025,2.65]} p={[xx,.52,1.65]} m={M.gold} c={false}/>)}
      <B s={[7.35,.12,.14]} p={[0,.2,3.39]} m={M.metal}/>
      <B s={[7.35,.1,.12]} p={[0,.13,-.04]} m={M.metal}/>
    </group>
    {/* Animated micro-energy transfer is a research demonstration only: a tiny LED/indicator at the hospital, NOT beds or pumping loads. */}
    <Pipe pts={[[HOSPITAL.x+2,5.35,HOSPITAL.z-.9],[HOSPITAL.x+4.4,5.28,HOSPITAL.z-.9],[HOSPITAL.x+4.4,4.0,HOSPITAL.z+1.8],[HOSPITAL.x+4.5,3.25,HOSPITAL.z+3.12]]}
      r={.038} m={M.dark} flow={deployed} n={9} live={live} activeKey="rainOn" color="#ffd04a" speed={.32}/>
    <mesh position={[HOSPITAL.x+4.5,3.25,HOSPITAL.z+3.15]}>
      <sphereGeometry args={[.18,14,14]}/><meshStandardMaterial color={deployed?'#ffdf65':'#667377'} emissive={deployed?'#eebd20':'#000000'} emissiveIntensity={deployed?1.6:0}/>
    </mesh>
    {/* Separate non-potable water tank. Water flows only with deployed roof and rain. */}
    <Pipe pts={[[6.65,5.38,1.71],[7.55,5.12,1.71],[8.65,4.7,2.5],[10.9,3.8,3.74],[10.9,.8,3.74]]}
      r={.095} m={M.pipe} flow={deployed} n={12} live={live} activeKey="rainOn" color="#94dafa"/>
    <Cy r={[.69,.69]} h={1.4} p={[10.9,.8,3.74]} m={M.metal} seg={28}/>
    <mesh position={[10.9,.16,3.74]}><cylinderGeometry args={[.63,.63,.1,28]}/><meshStandardMaterial color="#5c9dad"/></mesh>
    <mesh position={[10.9,.3,3.74]} ref={tank}><cylinderGeometry args={[.57,.57,1.25,28]}/><meshPhysicalMaterial color="#42b7ed" transparent opacity={.68} roughness={.16}/></mesh>
  </group>;
}
function Rainfall({weather}) {
 const inst=useRef();const n=260;
 const drops=useMemo(()=>Array.from({length:n},(_,i)=>({x:-20+rnd(i*9)*43,z:-20+rnd(i*21)*37,y:8+rnd(i*73)*19})),[]);
 const dummy=useMemo(()=>new THREE.Object3D(),[]);
 useFrame(({clock})=>{
   if(!inst.current)return;
   const raining=Number(weather?.rainfall_mm)>0&&!!weather?.deployed;
   inst.current.visible=raining;
   if(!raining)return;
   for(let i=0;i<n;i++){
     const d=drops[i], y=((d.y-clock.elapsedTime*(10+Number(weather.rainfall_mm)*.08))%23+23)%23;
     dummy.position.set(d.x,y+.6,d.z);dummy.scale.set(.016,.25,.016);dummy.updateMatrix();inst.current.setMatrixAt(i,dummy.matrix);
   }
   inst.current.instanceMatrix.needsUpdate=true;
 });
 return <instancedMesh ref={inst} args={[null,null,n]} frustumCulled={false} visible={false}>
   <sphereGeometry args={[1,4,4]}/><meshBasicMaterial color="#afdef4" transparent opacity={.65}/>
 </instancedMesh>;
}
function World({ scenario, base, target, progressRef, coins, hoverZone, dragging, view, pickRef, onInspect, onZoneClick, weather, backup }) {
  const live = useRef({ hospital: 1, homes: 1, agri: 1, tank: 0.7, heat: 0, wind: 5, pumpOn: true, sprayOn: true, rainOn: false, energyOn: false, hospitalWaterOn:false, householdWaterOn:false, agriWaterOn:false, hospitalEnergyOn:false });
  const sun = useRef(), hemi = useRef();
  const heat = clamp((scenario.temperature - 28) / 27);
  live.current.rainOn=!!weather?.deployed && Number(weather?.rainfall_mm)>0;
  const C = coins || {};
  return (
    <>
      <fog attach="fog" args={["#bfdcee", 55, 140]} />
      <Sky sunPosition={[-40, 38, 22]} turbidity={3 + heat * 10} rayleigh={2 - heat * 1.1} mieCoefficient={0.004 + heat * 0.02} mieDirectionalG={0.8} />
      <hemisphereLight ref={hemi} args={["#ffffff", "#7b6a4a", 0.6]} />
      <directionalLight ref={sun} position={[-22, 24, 14]} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-32} shadow-camera-right={32} shadow-camera-top={32} shadow-camera-bottom={-32} shadow-camera-far={90} shadow-bias={-0.0004} />
      <Driver scenario={scenario} base={base} target={target} progressRef={progressRef} live={live} sun={sun} hemi={hemi} />
      <Rainfall weather={weather}/>
      <RainCapture weather={weather} live={live}/>
      <Picker pickRef={pickRef} onInspect={onInspect} onZoneClick={onZoneClick} />
      <CameraRig view={view} />

      {/* island */}
      <mesh position={[0, -1.6, 0]} material={[M.dirt, DYN.grass, M.dirt]} receiveShadow castShadow><cylinderGeometry args={[27, 24.5, 3.2, 72]} /></mesh>
      <mesh position={[-13, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={M.sand} receiveShadow><circleGeometry args={[9.5, 40]} /></mesh>
      <mesh position={[3, 0.02, 7]} rotation={[-Math.PI / 2, 0, 0]} material={M.cobble} receiveShadow><circleGeometry args={[5, 40]} /></mesh>
      <Strip a={[3, 11]} b={[3, 2.8]} /><Strip a={[-2, 7]} b={[-8, 3]} /><Strip a={[-8, 3]} b={[-9, 0]} />
      <Strip a={[-6, -1]} b={[0, -3.4]} /><Strip a={[0, -3.4]} b={[15, -3.4]} />

      {/* ZONE 1: hospital + houses */}
      <Hospital live={live} />
      <Fountain p={[3, 0, 7]} live={live} />
      <Flag p={[0,0,7.6]} kind="tn" />
      <Flag p={[6.2,0,7.6]} kind="jp" />

      <Pebbles />
      {HOUSES.map((h, i) => <group key={i}>
        <House {...h} />
        <InspectedFacade type={`home-${i+1}`} p={[h.p[0],1.55,h.p[2]]} size={[h.w+1,3.2,h.d+1]}/>
        <TileDetails p={[h.p[0],h.h+.35,h.p[2]]} w={h.w} d={h.d} roofH={h.rh} r={h.r}/>
      </group>)}
      <Smoke p={[-1.2, 4.2, 5.4]} /><Smoke p={[9.3, 4.6, 4.4]} /><Smoke p={[-0.6, 4.3, 10.6]} />
      {[[0.6, 4.2], [5.4, 4.8], [-0.5, 8.6], [6.8, 8.5], [1.2, 10.6], [5.6, 11.4]].map((p, i) => <Bush key={i} p={[p[0], 0, p[1]]} seed={i} />)}
      <Fence a={[11, 3]} b={[11, 12]} /><Fence a={[-4.5, 8]} b={[-4.5, 14]} />
      {[[10.3, 12.4], [0.3, 14.4], [-4, 3.8]].map((p, i) => <Tree key={i} p={[p[0], 0, p[1]]} s={1 + i * 0.1} seed={i + 20} live={live} healthKey="homes" />)}

      {/* ZONE 2: water source + pumps + energy */}
      <Pond live={live} />
      <House p={[-9.8, 0, -3.4]} r={Math.PI / 2} w={3.2} d={2.6} h={1.8} rh={1.4} wall={M.plaster3} roof={M.roofD} />
      <Pump p={[-11.5, 0, -0.5]} live={live} /><Pump p={[-11.5, 0, 1.7]} live={live} />
      <Pipe pts={W_INLET} flow n={10} live={live} activeKey="pumpOn" r={0.14} />
      <Pipe pts={W_OUT1} flow n={4} live={live} activeKey="pumpOn" /><Pipe pts={W_OUT2} flow n={4} live={live} activeKey="pumpOn" />
      <Cy r={[0.05, 0.05]} h={0.7} p={[-9.2, 0.7, 0.8]} m={M.pipe} seg={6} /><mesh position={[-9.2, 1.05, 0.8]} rotation={[Math.PI / 2, 0, 0]} material={M.valve}><torusGeometry args={[0.22, 0.05, 6, 14]} /></mesh>
      <Cabinet p={[-8.5, 0, 3.4]} />
      <Solar p={[-18.5, 0, 5]} /><Turbine p={[-20, 0, -9]} live={live} />
      <Cable pts={E_PUMP} live={live} />

      <BackupDepot backup={backup} />

      {/* ZONE 3: agriculture */}
      <Field p={[4, 0, -8]} live={live} /><Field p={[13.5, 0, -8]} live={live} />
      <Pipe pts={W_AGRI_A} flow n={12} live={live} activeKey="agriWaterOn" /><Pipe pts={W_AGRI_B} flow n={12} live={live} activeKey="agriWaterOn" />
      <House p={[7, 0, -15]} w={4.2} d={3.2} h={2} rh={1.5} cols={2} wall={M.plaster3} roof={M.roofC} chim={false} />
      <Cy r={[0.9, 0.9]} h={3.6} p={[11.4, 1.8, -15]} m={M.stone} seg={10} /><mesh position={[11.4, 3.7, -15]} material={M.roofB} castShadow><coneGeometry args={[1.1, 1, 10]} /></mesh>
      {[0, 1, 2].map((i) => <Cy key={i} r={[0.5, 0.5]} h={0.6} p={[1 + i * 1.1, 0.3, -14.2 + (i % 2) * 0.5]} rot={[0, 0, Math.PI / 2]} m={M.hay} seg={10} />)}
      {Array.from({ length: 7 }).flatMap((_, i) => [-18.2, -20.2].map((z, j) => <Tree key={`${i}${j}`} p={[-3 + i * 3.4, 0, z]} s={0.9} seed={i * 3 + j} olive live={live} />))}
      {[[16,-16],[19,-15],[22,-13],[-21,-12]].map((q,i)=><Palm key={i} p={[q[0],0,q[1]]} live={live} seed={i}/>)}


      <Solar p={[19.5, 0, -10]} rows={2} cols={2} /><Cabinet p={[19, 0, -3.4]} />
      <Cable pts={E_HOSP} live={live} activeKey="hospitalEnergyOn" /><Cable pts={E_AGRI} live={live} />
      <Pipe pts={W_HOSP} flow n={12} live={live} activeKey="hospitalWaterOn" /><Pipe pts={W_HOME} flow n={8} live={live} activeKey="householdWaterOn" />

      {FOREST.map((p, i) => <Tree key={i} p={p} s={1.1 + rnd(i) * 0.6} seed={i + 40} live={live} healthKey="homes" />)}
      <Villagers live={live} />
      {[[-40, 34, -30, 1.4], [20, 40, -50, 1.8], [-10, 36, 40, 1.2], [45, 38, 10, 1.6], [-55, 40, 0, 2]].map((c, i) => <Cloud key={i} i={i} p={[c[0], c[1], c[2]]} s={c[3]} />)}

      {/* drop targets */}
      <Pad zone="hospital" p={[3, 2.2, 0.5]} s={[10, 4.4, 6.8]} hover={hoverZone} dragging={dragging} />
      <Pad zone="households" p={[3.5, 1.5, 9]} s={[16, 3, 10]} hover={hoverZone} dragging={dragging} />
      <Pad zone="pump" p={[-13, 1.5, 0]} s={[14, 3, 14]} hover={hoverZone} dragging={dragging} />
      <Pad zone="agriculture" p={[8, 1.5, -10]} s={[21, 3, 13]} hover={hoverZone} dragging={dragging} />

      <Coins p={[1.6, 0.2, 4.2]} n={C.hospital?.w} color={COIN_BLUE} /><Coins p={[4.6, 0.2, 4.2]} n={C.hospital?.e} color={COIN_GOLD} />
      <Coins p={[6, 0.2, 8.6]} n={C.households?.w} color={COIN_BLUE} />
      <Coins p={[6.5, 0.2, -2.4]} n={C.agriculture?.w} color={COIN_BLUE} />
      <Coins p={[-10.4, 0.2, 5.4]} n={C.pump?.e} color={COIN_GOLD} />
      <Coins p={[-16, 0.3, -0.2]} n={C.pump?.w} color={COIN_BLUE} />

      {/* All zone sign meshes removed; physical flags and scene interactions remain. */}
    </>
  );
}

export default function Village3D(props) {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: [27, 19, 29], fov: 36, near: 0.5, far: 400 }}>
      <World {...props} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.07} enablePan screenSpacePanning minPolarAngle={0.16} maxPolarAngle={Math.PI / 2.08} minDistance={5} maxDistance={65} target={[0, 0, -1]} mouseButtons={{LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN}} />
    </Canvas>
  );
}
