import React, { useEffect, useState } from 'react';
import { Bot, X } from 'lucide-react';

// A compact non-blocking typewriter panel. Animation is presentation only;
// the backend returns the complete auditable text before playback begins.
export default function NexusNarrator({message, engine, onClose}) {
  const [visible,setVisible]=useState('');
  useEffect(()=>{
    setVisible('');
    if(!message)return;
    let index=0;
    const timer=setInterval(()=>{
      index=Math.min(message.length,index+3);
      setVisible(message.slice(0,index));
      if(index===message.length)clearInterval(timer);
    },18);
    return ()=>clearInterval(timer);
  },[message]);
  if(!message)return null;
  return <aside className="nexus-narrator" role="status" aria-live="off">
    <div className="narrator-top"><span><Bot size={16}/> NEXUS REASONING</span><button onClick={onClose} aria-label="Dismiss explanation"><X size={16}/></button></div>
    <div className="narrator-text">{visible}<span className="narrator-caret">▍</span></div>
    <div className="narrator-bottom"><span>{engine==='llm'?'LIVE LLM EXPLANATION':'TRANSPARENT RULE-BASED EXPLANATION'}</span><button onClick={()=>setVisible(message)}>SHOW ALL</button></div>
  </aside>;
}
