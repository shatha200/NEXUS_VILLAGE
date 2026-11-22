import React, {useMemo, useRef} from 'react';
import {Canvas, useFrame} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import * as THREE from 'three';

const color={wall:'#d7d0b9',floor:'#a78a6e',wood:'#766050',metal:'#aebdc2',linen:'#f1f5f0',skin:'#b98565',dark:'#202d32'};
function Box({p,s,c,rough=.75,...props}){return <mesh position={p} castShadow receiveShadow {...props}><boxGeometry args={s}/><meshStandardMaterial color={c} roughness={rough}/></mesh>}
function Tube({a,b,r=.025,c='#c0d0d2'}){
 const v1=new THREE.Vector3(...a),v2=new THREE.Vector3(...b),d=new THREE.Vector3().subVectors(v2,v1);
 const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());
 return <mesh position={v1.add(v2).multiplyScalar(.5)} quaternion={q} castShadow><cylinderGeometry args={[r,r,d.length(),10]}/><meshStandardMaterial color={c} metalness={.5} roughness={.4}/></mesh>;
}
function WallLabel({text,p,width=3,height=.48,red=false,rotation=[0,0,0]}) {
 const tex=useMemo(()=>{const c=document.createElement('canvas');c.width=1024;c.height=180;const x=c.getContext('2d');x.fillStyle='#eeeae0';x.fillRect(0,0,1024,180);x.fillStyle=red?'#a52b35':'#20505a';x.font=`bold ${text.length>23?55:72}px Arial`;x.textAlign='center';x.textBaseline='middle';x.fillText(text,512,95,980);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;},[text,red]);
 React.useEffect(()=>()=>tex.dispose(),[tex]);
 return <mesh position={p} rotation={rotation}><planeGeometry args={[width,height]}/><meshBasicMaterial map={tex} toneMapped={false} side={THREE.DoubleSide}/></mesh>;
}
function Screen({p,critical=false}){
 const cv=useMemo(()=>{
  const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');
  x.fillStyle='#071a1e';x.fillRect(0,0,512,256);x.strokeStyle=critical?'#ef625c':'#5df5bf';x.lineWidth=4;x.beginPath();
  if(!critical){for(let i=0;i<500;i++){const y=130 +((i%110)<10?-(10-(i%110))*8:Math.sin(i*.065)*6);i?x.lineTo(i,y):x.moveTo(i,y);}}else{x.moveTo(0,130);x.lineTo(512,130);}x.stroke();
  x.font='bold 30px sans-serif';x.fillStyle=critical?'#ff8677':'#b4f7d2';x.fillText(critical?'POWER OFF':'ECG  72 BPM',18,47);
  return new THREE.CanvasTexture(c);
 },[critical]);
 React.useEffect(()=>()=>cv.dispose(),[cv]);
 return <group position={p}>
   <Box p={[0,0,-.04]} s={[.85,.53,.13]} c={color.metal}/>
   <mesh position={[0,0,.037]}><planeGeometry args={[.76,.44]}/><meshBasicMaterial map={cv} toneMapped={false}/></mesh>
   <Box p={[0,-.32,-.03]} s={[.13,.14,.11]} c={color.metal}/>
 </group>
}
function Person({p=[0,0,0],lying=false,clothing='#81a3ab',skin=color.skin}){
 return <group position={p} rotation={lying?[Math.PI/2,0,0]:[0,0,0]}>
   <mesh position={[0,1.05,0]} castShadow><sphereGeometry args={[.19,18,14]}/><meshStandardMaterial color={skin} roughness={.85}/></mesh>
   <mesh position={[0,1.35,-.06]}><sphereGeometry args={[.19,16,10,0,Math.PI*2,0,Math.PI*.38]}/><meshStandardMaterial color="#40342b"/></mesh>
   <mesh position={[0,.58,0]} castShadow><capsuleGeometry args={[.24,.53,6,12]}/><meshStandardMaterial color={clothing}/></mesh>
   {[-1,1].map(i=><React.Fragment key={i}>
     <Tube a={[i*.29,.82,0]} b={[i*.35,.28,.14]} r={.075} c={skin}/>
     <Tube a={[i*.13,.32,0]} b={[i*.14,-.18,0]} r={.1} c={clothing}/>
   </React.Fragment>)}
 </group>;
}
function Bed({x,z,critical}){
 return <group position={[x,0,z]}>
  {[.45,-.45].map((xx,i)=><React.Fragment key={i}><Tube a={[xx,.18,-1]} b={[xx,.72,-1]} r={.03}/><Tube a={[xx,.18,1]} b={[xx,.72,1]} r={.03}/></React.Fragment>)}
  <Box p={[0,.62,0]} s={[1.25,.12,2.35]} c={color.metal}/>
  <Box p={[0,.76,0]} s={[1.1,.15,2.2]} c={color.linen}/>
  <Box p={[0,.89,-.79]} s={[.66,.17,.38]} c="#d4e7df"/>
  <group position={[0,.86,.15]} scale={[.8,.78,.8]} rotation={[0,Math.PI,0]}><Person lying clothing="#d9e3e8" /></group>
  <Box p={[0,.91,.43]} s={[1.03,.13,.95]} c="#e5f0ec"/>
  <Box p={[0,.9,1.15]} s={[1.28,.43,.10]} c={color.metal}/>
  <Tube a={[.7,.6,1.05]} b={[.7,1.9,1.05]} r={.028}/>
  <Box p={[.74,1.88,1.05]} s={[.48,.11,.5]} c={color.metal}/>
  <Screen p={[.74,2.25,1.05]} critical={critical}/>
  {/* IV stand with saline bag and tubing */}
  <Tube a={[-.84,0,.1]} b={[-.84,2.3,.1]} r={.025}/>
  <Tube a={[-1.02,2.3,.1]} b={[-.65,2.3,.1]} r={.025}/>
  <Box p={[-.70,2.06,.1]} s={[.17,.35,.12]} c="#d7f5ef"/>
 </group>;
}
function HospitalRoom({energy,water}){
 const critical=energy<25;
 return <group>
  <Box p={[0,1.9,-4.1]} s={[12,4,.18]} c={color.wall}/>
  <Box p={[-5.9,1.9,0]} s={[.18,4,8.2]} c={color.wall}/>
  <Box p={[5.9,1.9,0]} s={[.18,4,8.2]} c={color.wall}/>
  <Box p={[0,0,0]} s={[12,.12,8.2]} c="#c6c7c2"/>
  <Box p={[0,3.8,0]} s={[12,.12,8.2]} c="#eceddf"/>
  {[-3.8,0,3.8].map((x,i)=><Bed key={i} x={x} z={-.25} critical={critical}/>)}
  <Box p={[-4.9,1.15,-3.95]} s={[1.25,1.15,.32]} c="#eef0eb"/>
  <Box p={[4.7,1.5,-3.95]} s={[1.6,1.9,.22]} c="#dfede9"/>
  <Box p={[4.7,1.45,-3.75]} s={[1.45,1.4,.1]} c="#102d38"/>
  <WallLabel text={critical?'BACKUP POWER FAILURE':'EMERGENCY SERVICES'} p={[4.7,1.75,-3.67]} width={1.35} height={.24}/>
  <Box p={[0,3.3,-3.95]} s={[2.8,.52,.09]} c="#f3f5ed"/>
  <WallLabel text="HÔPITAL · URGENCES" p={[0,3.3,-3.88]} width={2.65} red/>
  <pointLight position={[0,3.4,1]} intensity={critical?.11:2.5} color={critical?'#f08166':'#fbf5df'} distance={10}/>
  <ambientLight intensity={critical?.28:.8}/>
  <Box p={[0,2.35,3.75]} s={[2.2,1,.13]} c="#c2dbe5"/>
  <WallLabel p={[0,2.4,3.82]} rotation={[0,Math.PI,0]} text={water<25?'WATER SUPPLY CRITICAL':'WARD B · MONITORED'} width={2}/>
 </group>
}
function HomeRoom({households,grid}){
 const scarce=households<30;
 return <group>
  <Box p={[0,0,0]} s={[12,.12,8.2]} c="#aa8d71"/>
  <Box p={[0,2,-4.1]} s={[12,4,.18]} c="#e5d2ad"/>
  <Box p={[-5.9,2,0]} s={[.18,4,8]} c="#e5d2ad"/>
  <Box p={[5.9,2,0]} s={[.18,4,8]} c="#e5d2ad"/>
  <Box p={[0,3.8,0]} s={[12,.12,8]} c="#f0e2c7"/>
  {/* tiled kitchenette and old blue-painted shutters */}
  <Box p={[-3.3,1,-3.8]} s={[4.5,2,.5]} c="#50717e"/>
  <Box p={[-3.3,1.15,-3.43]} s={[4.6,.13,.85]} c="#eee5d4"/>
  <Box p={[-4.5,2.9,-3.8]} s={[1.5,1.25,.48]} c="#d0b88d"/>
  <Box p={[-2.4,2.9,-3.8]} s={[1.5,1.25,.48]} c="#d0b88d"/>
  <Box p={[1.8,1.35,-3.78]} s={[3.0,2.7,.55]} c="#8b6745"/>
  {[.7,1.5,2.3].map((x,i)=><Box key={i} p={[x,1.95,-3.4]} s={[.1,.85,.05]} c="#e3c9a5"/>)}
  {!scarce&&[-4.2,-3.3,-2.4].map((x,i)=><mesh key={i} position={[x,1.4,-3.35]} castShadow><cylinderGeometry args={[.14,.14,.42,12]}/><meshStandardMaterial color={i===0?'#c7874a':'#74a4a3'}/></mesh>)}
  <Box p={[3,1.1,.4]} s={[2.8,.18,1.65]} c="#997448"/>
  {[-1,1].map(i=><Box key={i} p={[3+i*1.2,.55,.4]} s={[.13,1.1,.13]} c="#705034"/>)}
  <Box p={[2.5,.45,2.1]} s={[1.8,.9,.9]} c="#427f8b"/>
  <Box p={[2.5,.90,2.4]} s={[1.8,.6,.3]} c="#f7ebd6"/>
  <Person p={[0,0,1.5]} clothing="#a97f52"/>
  <Box p={[0,2.9,-3.9]} s={[3,.5,.12]} c="#efe5c9"/>
  <WallLabel p={[0,2.9,-3.79]} text={scarce?'LOW WATER / LIMITED SUPPLIES':'FAMILY HOME · WATER ACCESS'} width={2.85}/>
  <pointLight position={[0,3,1]} intensity={grid==='OFF'?.12:2.8} color="#fff0c5" distance={9}/>
  <ambientLight intensity={grid==='OFF'?.25:.85}/>
 </group>
}
export default function Interior3D({hospital=false,energy=100,water=100,households=100,grid='ON'}) {
 return <div style={{width:'100%',height:430,borderRadius:12,overflow:'hidden',background:'#141b20'}}>
  <Canvas shadows camera={{position:[7.8,5.6,9.4],fov:40,near:.1,far:100}} dpr={[1,1.6]}>
   <color attach="background" args={['#28343a']}/>
   <hemisphereLight intensity={.9} groundColor="#88715c"/>
   <directionalLight position={[-4,9,5]} intensity={2.1} castShadow shadow-mapSize={[1024,1024]}/>
   {hospital?<HospitalRoom energy={energy} water={water}/>:<HomeRoom households={households} grid={grid}/>} 
   <OrbitControls enableDamping target={[0,1,0]} maxDistance={18} minDistance={4} maxPolarAngle={Math.PI*.49}/>
  </Canvas>
 </div>
}
