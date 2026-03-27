import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── DESIGN TOKENS ───
const T = {
  bg: "#E2D5BC",
  paper: "#EDE2CE",
  ink: "#2C2416",
  inkLight: "#4E3F2E",
  inkFaint: "#8C7A5E",
  inkGhost: "#BFB094",
  accent: "#B83A24",
  accentSoft: "rgba(184,58,36,0.1)",
  teal: "#2A7C6F",
  tealSoft: "rgba(42,124,111,0.1)",
  gold: "#7A5A0E",
  goldSoft: "rgba(122,90,14,0.1)",
  rust: "#6E4420",
  green: "#4A7C59",
  greenSoft: "rgba(74,124,89,0.1)",
  neon: "#7B4DAA",
  neonSoft: "rgba(123,77,170,0.1)",
  industrial: "#6B6B6B",
  industrialSoft: "rgba(107,107,107,0.1)",
  shadow: "rgba(44,36,22,0.18)",
  stain: "#6E4420",
  grain: `url("data:image/svg+xml,%3Csvg viewBox='0 0 600 600' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='6' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.09'/%3E%3Ccircle cx='120' cy='80' r='6' fill='%236E4420' opacity='0.12'/%3E%3Ccircle cx='480' cy='150' r='4' fill='%236E4420' opacity='0.1'/%3E%3Ccircle cx='350' cy='90' r='3' fill='%235C3A18' opacity='0.08'/%3E%3Ccircle cx='90' cy='320' r='5' fill='%236E4420' opacity='0.1'/%3E%3Ccircle cx='530' cy='400' r='7' fill='%235C3A18' opacity='0.09'/%3E%3Ccircle cx='200' cy='500' r='4' fill='%236E4420' opacity='0.11'/%3E%3Ccircle cx='420' cy='530' r='3' fill='%235C3A18' opacity='0.07'/%3E%3Ccircle cx='60' cy='180' r='2' fill='%236E4420' opacity='0.13'/%3E%3Ccircle cx='550' cy='250' r='5' fill='%236E4420' opacity='0.08'/%3E%3Ccircle cx='300' cy='350' r='2' fill='%235C3A18' opacity='0.06'/%3E%3Ccircle cx='150' cy='450' r='6' fill='%236E4420' opacity='0.07'/%3E%3Ccircle cx='470' cy='60' r='3' fill='%235C3A18' opacity='0.1'/%3E%3C/svg%3E")`,
};

const VIBE_ROUTES = {
  any: { label: "Surprise Me", icon: "🎲", color: T.teal, soft: T.tealSoft, desc: "A bit of everything" },
  industrial: { label: "Industrial Decay", icon: "🏚️", color: T.industrial, soft: T.industrialSoft, desc: "Warehouses, brutalism, rust" },
  green: { label: "Green Lungs", icon: "🌿", color: T.green, soft: T.greenSoft, desc: "Gardens, overgrown alleys, trees" },
  neon: { label: "Neon Path", icon: "💡", color: T.neon, soft: T.neonSoft, desc: "Indie shops, lit signs, nightlife" },
};

const ROUTE_NAMES = {
  any: ["The Long Way Round","The Scenic Detour","The Wanderer's Path","The Serendipity Line","The Discovery Arc"],
  industrial: ["The Rust Belt","The Concrete Drift","The Machine Walk","The Foundry Line","The Grey Mile"],
  green: ["The Breathing Route","The Overgrown Way","The Chlorophyll Trail","The Quiet Green","The Root Path"],
  neon: ["The Glow Circuit","The Neon Crawl","The Shopfront Shuffle","The Pixel Walk","The Late Night Line"],
};

const VIBE_COLORS = { industrial: T.industrial, green: T.green, neon: T.neon, any: T.teal, weird: T.accent, hidden: T.teal, quiet: T.gold, art: T.neon, secret: T.gold };

function seededShuffle(arr, seed) { const a=[...arr]; let s=seed; for(let i=a.length-1;i>0;i--){s=(s*16807+0)%2147483647; const j=s%(i+1);[a[i],a[j]]=[a[j],a[i]];} return a; }

// ─── OVERPASS API ───
const OSM_VIBE_MAP = {
  industrial: { tags:['industrial','warehouse','works','factory','railway','abandoned','ruins','bunker','water_tower','silo','chimney','gasometer','crane','bridge'], icon:"🏚️", challenges:["Photo the most textured wall you can find.","Capture any rust, peeling paint, or weathered signage.","Photograph a detail nobody would normally notice.","Find something geometric and frame it."] },
  green: { tags:['park','garden','nature_reserve','allotments','community_garden','grass','meadow','forest','tree','pond','lake','cemetery','flower_bed','dog_park'], icon:"🌿", challenges:["Photo the oldest-looking tree you can see.","Find something growing where it shouldn't.","Sit still for 60 seconds. Photo whatever catches your eye.","Photograph the most peaceful view here."] },
  neon: { tags:['cafe','bar','pub','nightclub','restaurant','shop','bookshop','music','vinyl','tattoo','art_gallery','gallery','theatre','cinema','bakery','deli','charity_shop','antiques','vintage','second_hand','florist','hairdresser','barber'], icon:"💡", challenges:["Photo the shopfront from across the street.","Find the quirkiest detail in the window display.","Capture what makes this place different from a chain.","Photo the menu or whatever's in the window."] },
};

function buildOverpassQuery(s,w,n,e,v){const b=`${s},${w},${n},${e}`;let f=[];if(v==="industrial"||v==="any")f.push(`node["man_made"~"works|warehouse|chimney|water_tower|silo|gasometer|crane"](${b});`,`node["building"~"industrial|warehouse"](${b});`,`way["building"~"industrial|warehouse"](${b});`,`node["abandoned"](${b});`);if(v==="green"||v==="any")f.push(`node["leisure"~"park|garden|nature_reserve|dog_park"](${b});`,`node["landuse"~"allotments|meadow|forest|cemetery"](${b});`,`way["leisure"~"park|garden|nature_reserve"](${b});`,`node["natural"~"tree|water|pond"](${b});`);if(v==="neon"||v==="any")f.push(`node["amenity"~"cafe|bar|pub|nightclub|restaurant|theatre|cinema|arts_centre"](${b});`,`node["shop"~"books|music|tattoo|vintage|charity|antiques|second_hand|florist|bakery|deli"](${b});`,`node["tourism"="gallery"](${b});`,`node["craft"~"brewery|distillery"](${b});`);return `[out:json][timeout:10];(${f.join("")});out center 80;`;}

function classifyElement(el){const t=el.tags||{},av=Object.values(t).join(" ").toLowerCase(),ak=Object.keys(t).join(" ").toLowerCase();for(const[v,c]of Object.entries(OSM_VIBE_MAP)){if(c.tags.some(x=>av.includes(x)||ak.includes(x)))return v;}if(t.amenity==="cafe"||t.amenity==="restaurant"||t.amenity==="bar"||t.shop)return"neon";if(t.leisure||t.natural||t.landuse==="grass")return"green";if(t.building==="industrial"||t.man_made)return"industrial";return"neon";}

function pickIcon(t){if(!t)return"📍";if(t.amenity==="cafe"||t.cuisine==="coffee")return"☕";if(t.amenity==="bar"||t.amenity==="pub")return"🍺";if(t.amenity==="restaurant")return"🍽️";if(t.amenity==="theatre"||t.amenity==="cinema")return"🎭";if(t.amenity==="arts_centre"||t.tourism==="gallery")return"🎨";if(t.shop==="books")return"📚";if(t.shop==="music"||t.shop==="vinyl")return"📀";if(t.shop==="florist")return"💐";if(t.shop==="bakery")return"🥐";if(t.shop==="tattoo")return"✒️";if(t.shop==="vintage"||t.shop==="second_hand"||t.shop==="charity")return"🛍️";if(t.shop)return"🪴";if(t.leisure==="park"||t.leisure==="garden")return"🌳";if(t.leisure==="nature_reserve")return"🌲";if(t.leisure==="dog_park")return"🐕";if(t.landuse==="allotments")return"🌻";if(t.natural==="water"||t.natural==="pond")return"🦆";if(t.man_made||t.building==="industrial")return"🏚️";if(t.railway)return"🚂";return"📍";}

function osmToDiscovery(el){const t=el.tags||{},v=classifyElement(el),cfg=OSM_VIBE_MAP[v],lat=el.lat||el.center?.lat,lon=el.lon||el.center?.lon,name=t.name||t["name:en"]||t.brand||`Unnamed ${t.amenity||t.shop||t.leisure||t.man_made||"spot"}`,pts=[];if(t.amenity)pts.push(t.amenity.replace(/_/g," "));if(t.cuisine)pts.push(t.cuisine.replace(/;/g,", "));if(t.shop)pts.push(t.shop.replace(/_/g," ")+" shop");if(t.leisure)pts.push(t.leisure.replace(/_/g," "));if(t.man_made)pts.push(t.man_made.replace(/_/g," "));if(t["addr:street"])pts.push(`on ${t["addr:street"]}`);const desc=pts.length>0?pts.join(" · "):"A real place worth discovering.";return{type:t.amenity||t.shop||t.leisure||t.man_made||"place",icon:pickIcon(t),name:name.length>35?name.slice(0,33)+"…":name,desc:desc.charAt(0).toUpperCase()+desc.slice(1),vibe:v,time:`+${Math.floor(Math.random()*6)+2} min`,challenge:cfg.challenges[Math.floor(Math.random()*cfg.challenges.length)],lat,lon,osmTags:t};}

const CHAINS=["starbucks","costa","pret","mcdonald","burger king","kfc","subway","greggs","nando","pizza hut","domino","tesco","sainsbury","asda","lidl","aldi","waitrose","boots","superdrug","poundland","primark","five guys","wagamama","caffe nero"];
function isChain(n){return CHAINS.some(c=>(n||"").toLowerCase().includes(c));}

async function fetchRealDiscoveries(sc,ec,v,count){const pad=0.005,s=Math.min(sc.lat,ec.lat)-pad,n=Math.max(sc.lat,ec.lat)+pad,w=Math.min(sc.lng,ec.lng)-pad,e=Math.max(sc.lng,ec.lng)+pad;const q=buildOverpassQuery(s,w,n,e,v);const r=await fetch("https://overpass-api.de/api/interpreter",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:`data=${encodeURIComponent(q)}`});if(!r.ok)throw new Error(`Overpass ${r.status}`);const d=await r.json();if(!d.elements?.length)return null;let disc=d.elements.filter(x=>x.lat||x.center?.lat).map(osmToDiscovery).filter(x=>!isChain(x.name));const named=disc.filter(x=>!x.name.startsWith("Unnamed")),unnamed=disc.filter(x=>x.name.startsWith("Unnamed"));let pool=v==="any"?[...named,...unnamed]:[...named.filter(x=>x.vibe===v),...unnamed.filter(x=>x.vibe===v),...named,...unnamed];const seen=new Set();pool=pool.filter(x=>{if(seen.has(x.name))return false;seen.add(x.name);return true;});return seededShuffle(pool,Date.now()%10000).slice(0,count);}

async function enhanceWithAI(discoveries){const toE=discoveries.filter(d=>d.name&&!d.name.startsWith("Unnamed"));if(!toE.length)return discoveries;const prompt=toE.map((d,i)=>`${i+1}. "${d.name}" — ${d.type}. ${d.desc}. Vibe: ${d.vibe}.`).join("\n");try{const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:`You write for Unroute, a scavenger-hunt app for urban explorers. Your voice: a well-traveled friend scribbling notes in a Moleskine. Witty, specific, never generic.\n\nReturn ONLY a JSON array. No markdown. Each: {"desc":"1 quirky sentence","challenge":"1 sentence photo task requiring presence"}\n\nNever say "hidden gem", "capture the essence", "explore", or "discover". Under 15 words each.`,messages:[{role:"user",content:`Write for these ${toE.length} real places:\n${prompt}`}]})});const d=await r.json(),txt=d.content?.map(c=>c.text||"").join("")||"",enhanced=JSON.parse(txt.replace(/```json|```/g,"").trim());return discoveries.map(x=>{const i=toE.findIndex(t=>t.name===x.name);if(i>=0&&enhanced[i])return{...x,desc:enhanced[i].desc||x.desc,challenge:enhanced[i].challenge||x.challenge,aiEnhanced:true};return x;});}catch(e){console.warn("AI failed:",e.message);return discoveries;}}

async function generateRouteAsync(level,vibeKey,sC,dC){const count=Math.max(2,Math.min(level,8)),names=ROUTE_NAMES[vibeKey]||ROUTE_NAMES.any,name=names[Math.floor(Math.random()*names.length)];let picks=null,isReal=false,isPioneer=false;if(sC&&dC){try{picks=await fetchRealDiscoveries(sC,dC,vibeKey,count);if(picks?.length>=2){isReal=true;picks=await enhanceWithAI(picks);}else{isPioneer=true;picks=[];}}catch(e){console.warn("Overpass:",e.message);isPioneer=true;picks=[];}}else{isPioneer=true;picks=[];}const extraMin=picks.length?picks.reduce((s,d)=>s+parseInt(d.time),0):0;let baseDist,routeDist;if(sC&&dC){const R=6371,dLat=(dC.lat-sC.lat)*Math.PI/180,dLon=(dC.lng-sC.lng)*Math.PI/180,a=Math.sin(dLat/2)**2+Math.cos(sC.lat*Math.PI/180)*Math.cos(dC.lat*Math.PI/180)*Math.sin(dLon/2)**2;baseDist=Math.max(0.3,R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))*1.3).toFixed(1);routeDist=picks.length?(parseFloat(baseDist)*(1+level*0.12)).toFixed(1):baseDist;}else{baseDist="?";routeDist="?";}return{picks,extraMin,baseDist,routeDist,name,vibeKey,isReal,isPioneer};}

// ─── GEOLOCATION ───
function useGeolocation(){const[loc,setLoc]=useState({status:"idle",coords:null,address:null});useEffect(()=>{if(!navigator.geolocation){setLoc(p=>({...p,status:"unsupported"}));return;}setLoc(p=>({...p,status:"requesting"}));navigator.geolocation.getCurrentPosition(async(pos)=>{const c={lat:pos.coords.latitude,lng:pos.coords.longitude};setLoc(p=>({...p,status:"located",coords:c}));try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${c.lat}&lon=${c.lng}&format=json&zoom=16&addressdetails=1`,{headers:{"Accept-Language":"en"}});const d=await r.json(),a=d.address||{};setLoc(p=>({...p,address:a.road?`${a.road}${a.suburb?", "+a.suburb:""}${a.city||a.town?", "+(a.city||a.town):""}`:d.display_name?.split(",").slice(0,3).join(",")||"Your location"}));}catch{setLoc(p=>({...p,address:`${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`}));}},()=>setLoc(p=>({...p,status:"denied"})),{enableHighAccuracy:true,timeout:10000,maximumAge:60000});},[]);return loc;}

// ─── ANTI-CLOUD ───
const antiCloud={_s:{},save(k,v){this._s[k]=JSON.stringify(v);},load(k){try{return JSON.parse(this._s[k]);}catch{return null;}},get routeCount(){return this.load("rc")||0;},get totalDiscoveries(){return this.load("td")||0;},get proofCount(){return this.load("pc")||0;},get completedRoutes(){return this.load("cr")||[];},logRoute(r){this.save("rc",this.routeCount+1);this.save("td",this.totalDiscoveries+r.picks.length);const c=this.completedRoutes;c.push({name:r.name,vibe:r.vibeKey,discoveries:r.picks.length,date:new Date().toLocaleDateString()});this.save("cr",c.slice(-20));},logProof(){this.save("pc",this.proofCount+1);}};

// ─── TOAST ───
function Toast({message,type,onDismiss}){useEffect(()=>{const t=setTimeout(onDismiss,4000);return()=>clearTimeout(t);},[onDismiss]);const colors={error:{bg:"rgba(200,67,43,0.08)",border:T.accent,color:T.accent},success:{bg:T.tealSoft,border:T.teal,color:T.teal},warning:{bg:T.goldSoft,border:T.gold,color:T.gold}};const c=colors[type]||colors.warning;return(<div onClick={onDismiss} style={{position:"fixed",top:16,left:16,right:16,zIndex:999,padding:"14px 18px",background:c.bg,border:`1px solid ${c.border}`,borderRadius:4,fontFamily:"'Courier Prime',monospace",fontSize:13,color:c.color,animation:"fadeIn 0.3s ease",backdropFilter:"blur(8px)",boxShadow:`0 2px 12px ${T.shadow}`}}>{message}</div>);}

// ─── HANDWRITTEN LOGO ───
// Each letter gets its own tspan with a random vertical nudge so they bounce
// along an uneven baseline — like scrawled in a notebook.
const LETTER_OFFSETS = [0, -6, 3, -4, 5, -2, 7]; // per-letter y nudge
function UnrouteLogo() {
  const letters = "Unroute".split("");
  const nudges  = [0, -7, 4, -3, 6, -1, 5];
  const rotates = [-2, 1.5, -1, 2.5, -0.5, 2, -1.5];
  return (
    <svg
      viewBox="0 0 310 72"
      style={{ width: "100%", maxWidth: 310, display: "block", overflow: "visible" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {letters.map((ch, i) => (
        <text
          key={i}
          x={i * 42 + 8}
          y={44 + nudges[i]}
          fontFamily="'Caveat', cursive"
          fontWeight="700"
          fontSize="52"
          fill={T.ink}
          transform={`rotate(${rotates[i]}, ${i * 42 + 28}, ${44 + nudges[i]})`}
        >
          {ch}
        </text>
      ))}
    </svg>
  );
}

// ─── PLACE AUTOCOMPLETE ───
function PlaceAutocomplete({value,onChange,onSelect,placeholder,accentColor,resolvedPlace}){
  const[suggestions,setSuggestions]=useState([]);const[isOpen,setIsOpen]=useState(false);const[loading,setLoading]=useState(false);const debRef=useRef(null);const wrapRef=useRef(null);const clr=accentColor||T.teal;
  useEffect(()=>{const h=(e)=>{if(wrapRef.current&&!wrapRef.current.contains(e.target))setIsOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const isPC=(q)=>/^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d?[A-Za-z]{0,2}$/i.test(q.trim());
  const search=useCallback((q)=>{if(!q||q.length<2){setSuggestions([]);setIsOpen(false);return;}if(!isPC(q)&&q.length<3)return;setLoading(true);const params=isPC(q)?`postalcode=${encodeURIComponent(q.trim())}&countrycodes=gb&format=json&addressdetails=1&limit=5`:`q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5`;fetch(`https://nominatim.openstreetmap.org/search?${params}`,{headers:{"Accept-Language":"en"}}).then(r=>r.json()).then(data=>{setSuggestions(data.map(d=>{const a=d.address||{},pts=[a.road,a.suburb||a.neighbourhood||a.hamlet,a.city||a.town||a.village,a.postcode].filter(Boolean);return{display:pts.length?pts.join(", "):d.display_name.split(",").slice(0,3).join(",").trim(),full:d.display_name,lat:parseFloat(d.lat),lng:parseFloat(d.lon)};}));setIsOpen(data.length>0);setLoading(false);}).catch(()=>setLoading(false));},[]);
  return(
    <div ref={wrapRef} style={{position:"relative"}}>
      <div style={{position:"relative"}}>
        <input type="text" value={value} onChange={(e)=>{onChange(e.target.value);if(resolvedPlace)onSelect(null);clearTimeout(debRef.current);debRef.current=setTimeout(()=>search(e.target.value),350);}} placeholder={placeholder} onFocus={()=>{if(suggestions.length)setIsOpen(true);}}
          style={{width:"100%",padding:"14px 40px 14px 16px",fontSize:16,background:T.paper,border:`2px solid ${resolvedPlace?clr:T.inkGhost}`,borderRadius:"255px 15px 225px 15px / 15px 225px 15px 255px",color:T.ink,outline:"none",fontFamily:"'Courier Prime',monospace",transition:"border-color 0.3s",minHeight:50,boxShadow:`1px 2px 0px ${T.inkGhost}`,transform:"rotate(-0.3deg)"}} />
        <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:14}}>
          {loading?<span style={{color:T.inkFaint,animation:"pulse 1s infinite"}}>◌</span>:resolvedPlace?<span style={{color:clr,fontWeight:700}}>✓</span>:null}
        </span>
      </div>
      {resolvedPlace&&!isOpen&&(
        <div style={{marginTop:6,padding:"8px 12px",background:T.tealSoft,border:`1px dashed ${T.teal}`,borderRadius:2,fontFamily:"'Courier Prime',monospace",fontSize:11,color:T.teal,display:"flex",gap:8,flexWrap:"wrap",animation:"fadeIn 0.3s ease"}}>
          <span style={{fontWeight:700}}>✓ RESOLVED</span>
          <span style={{color:T.inkLight,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{resolvedPlace.full||resolvedPlace.display}</span>
          <span style={{color:T.inkFaint,flexShrink:0}}>{resolvedPlace.lat.toFixed(5)}, {resolvedPlace.lng.toFixed(5)}</span>
        </div>
      )}
      {isOpen&&suggestions.length>0&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:T.paper,border:`1.5px solid ${T.inkGhost}`,borderTop:"none",borderRadius:"0 0 3px 3px",boxShadow:`0 8px 24px ${T.shadow}`}}>
          {suggestions.map((s,i)=>(
            <button key={i} onClick={()=>{onChange(s.display);onSelect(s);setIsOpen(false);setSuggestions([]);}} style={{display:"flex",alignItems:"flex-start",gap:10,width:"100%",padding:"14px 16px",background:"transparent",border:"none",borderTop:i?`1px solid ${T.inkGhost}`:"none",cursor:"pointer",textAlign:"left",color:T.ink,fontFamily:"'Courier Prime',monospace",minHeight:48}} onMouseEnter={e=>e.currentTarget.style.background=T.tealSoft} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <span style={{color:T.inkFaint,flexShrink:0}}>↳</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.display}</div>
                <div style={{fontSize:10,color:T.inkFaint,marginTop:2}}>{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── COMPONENTS ───
function Stamp({children,color}){return <span style={{display:"inline-block",padding:"3px 10px",border:`2px solid ${color||T.accent}`,borderRadius:2,fontSize:10,fontFamily:"'Courier Prime',monospace",fontWeight:700,letterSpacing:1.5,color:color||T.accent,textTransform:"uppercase",transform:"rotate(-1deg)"}}>{children}</span>;}

function DiscoveryCard({discovery,index,isActive,onClick,proofImage,onProofCapture}){
  const clr=VIBE_COLORS[discovery.vibe]||T.teal;
  const mapsUrl=discovery.lat&&discovery.lon?`https://www.google.com/maps/dir/?api=1&destination=${discovery.lat},${discovery.lon}&travelmode=walking`:null;
  return(
    <div style={{padding:"20px",background:T.paper,border:`1.5px solid ${isActive?clr:T.inkGhost}`,borderRadius:2,borderLeft:`4px solid ${clr}`,transition:"all 0.3s ease",animation:`fadeIn 0.4s ease ${index*0.08}s both`,boxShadow:isActive?`2px 3px 12px ${T.shadow}, inset 0 0 20px rgba(139,105,20,0.02)`:`1px 1px 4px ${T.shadow}`,transform:`rotate(${(index%2===0?-0.3:0.2)}deg)`}}>
      <div onClick={onClick} style={{cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
          <span style={{fontSize:28,lineHeight:1}}>{discovery.icon}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
              <span style={{fontSize:19,fontWeight:700,color:T.ink,fontFamily:"'Caveat',cursive"}}>{discovery.name}</span>
              <span style={{fontSize:11,fontFamily:"'Courier Prime',monospace",color:clr,whiteSpace:"nowrap",fontWeight:700}}>{discovery.time}</span>
            </div>
            <p style={{margin:"6px 0 0",fontSize:13,color:T.inkLight,lineHeight:1.6,fontFamily:"'Courier Prime',monospace"}}>{discovery.desc}</p>
            {discovery.aiEnhanced&&<span style={{fontSize:10,color:T.gold,fontFamily:"'Courier Prime',monospace"}}>✦ ai-written</span>}
          </div>
        </div>
      </div>
      {isActive&&(
        <div style={{marginTop:14,paddingTop:14,borderTop:`1px dashed ${T.inkGhost}`}}>
          {/* Challenge — always visible, photo is optional */}
          <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:14}}>
            <span style={{fontSize:18}}>📸</span>
            <p style={{fontSize:12,fontFamily:"'Courier Prime',monospace",color:T.accent,margin:0,lineHeight:1.5,fontStyle:"italic"}}>{discovery.challenge}</p>
          </div>

          {/* Optional photo capture */}
          {!proofImage ? (
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <input type="file" accept="image/*" capture="environment" onChange={(e)=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=(ev)=>{antiCloud.logProof();onProofCapture(ev.target.result);};r.readAsDataURL(f);}} style={{display:"none"}} id={`proof-${index}`} />
              <label htmlFor={`proof-${index}`} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"10px 16px",fontSize:12,fontFamily:"'Courier Prime',monospace",background:"transparent",color:T.inkFaint,border:`1px dashed ${T.inkGhost}`,borderRadius:3,cursor:"pointer",minHeight:40}}>
                📷 <span>Add photo (optional)</span>
              </label>
            </div>
          ) : (
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><span>✅</span><Stamp color={T.teal}>PHOTO ADDED</Stamp></div>
              <img src={proofImage} alt="Proof" style={{width:"100%",maxHeight:180,objectFit:"cover",borderRadius:3,border:`1px solid ${T.inkGhost}`}} />
            </div>
          )}

          {mapsUrl&&<a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{display:"block",marginTop:12,padding:"12px 16px",background:T.bg,border:`1px solid ${T.inkGhost}`,borderRadius:3,color:T.inkLight,fontSize:12,fontFamily:"'Courier Prime',monospace",textDecoration:"none",textAlign:"center",minHeight:44}}>🗺️ Open in Google Maps → walk there</a>}
        </div>
      )}
    </div>);
}

function RouteMap({discoveries,active,startLabel,vibeColor,unlockedCount}){
  if(!discoveries.length)return null;
  const pts=discoveries.map((_,i)=>{const t=i/Math.max(discoveries.length-1,1);return{x:40+t*620,y:200+Math.sin(t*Math.PI*2.5+i)*60+(((i*137)%50)-25)};});
  const st={x:20,y:200},en={x:690,y:200},all=[st,...pts,en];
  let d=`M ${all[0].x} ${all[0].y}`;for(let i=1;i<all.length;i++){const p=all[i-1],c=all[i];d+=` C ${p.x+(c.x-p.x)*0.5} ${p.y}, ${p.x+(c.x-p.x)*0.5} ${c.y}, ${c.x} ${c.y}`;}
  const mc=vibeColor||T.teal,sl=startLabel?.length>22?startLabel.slice(0,20)+"…":startLabel;
  return(
    <svg viewBox="0 0 710 400" style={{width:"100%",height:"auto",display:"block"}}>
      <defs>
        <pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.5" fill={T.inkGhost} /></pattern>
        <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" /><feColorMatrix in="noise" type="saturate" values="0" result="bnoise" /><feBlend in="SourceGraphic" in2="bnoise" mode="multiply" /></filter>
        <radialGradient id="mapVignette" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="transparent" /><stop offset="100%" stopColor="rgba(44,36,22,0.08)" /></radialGradient>
      </defs>
      <rect width="710" height="400" fill="#EDE4D3" />
      <rect width="710" height="400" fill="url(#dots)" />
      <rect width="710" height="400" fill="url(#mapVignette)" />
      <line x1="355" y1="0" x2="355" y2="400" stroke="rgba(44,36,22,0.05)" strokeWidth="1" />
      <rect x="0" y="0" width="710" height="3" fill="rgba(44,36,22,0.04)" />
      <rect x="0" y="397" width="710" height="3" fill="rgba(44,36,22,0.04)" />
      <line x1="20" y1="200" x2="690" y2="200" stroke={T.inkGhost} strokeWidth="1.5" strokeDasharray="6 4" />
      <text x="355" y="188" textAnchor="middle" fill={T.inkFaint} fontSize="9" fontFamily="'Courier Prime',monospace" fontStyle="italic">the boring way</text>
      <path d={d} fill="none" stroke={`${mc}30`} strokeWidth="10" strokeLinecap="round" />
      <path d={d} fill="none" stroke={mc} strokeWidth="2" strokeLinecap="round" strokeDasharray="8 4" style={{animation:"drawPath 2.5s ease-out forwards"}} />
      <circle cx={st.x} cy={st.y} r="10" fill={T.paper} stroke={mc} strokeWidth="2" />
      <circle cx={st.x} cy={st.y} r="3" fill={mc} />
      {sl&&<text x={st.x} y={st.y+22} textAnchor="middle" fill={T.inkFaint} fontSize="8" fontFamily="'Courier Prime',monospace">{sl}</text>}
      <circle cx={en.x} cy={en.y} r="8" fill={T.paper} stroke={T.accent} strokeWidth="2" />
      <text x={en.x} y={en.y+4} textAnchor="middle" fill={T.accent} fontSize="9" fontFamily="'Courier Prime',monospace" fontWeight="700">B</text>
      {pts.map((p,i)=>{const dd=discoveries[i],c=VIBE_COLORS[dd.vibe]||mc,isA=active===i,isL=false;return(
        <g key={i} opacity={isL?0.25:1}>{isA&&<circle cx={p.x} cy={p.y} r="16" fill="none" stroke={c} strokeWidth="1" strokeDasharray="3 2"><animate attributeName="r" values="14;20;14" dur="2s" repeatCount="indefinite" /></circle>}<circle cx={p.x} cy={p.y} r="12" fill={T.paper} stroke={c} strokeWidth={isA?2:1.5} /><text x={p.x} y={p.y+5} textAnchor="middle" fontSize="12">{dd.icon}</text></g>
      );})}
      <style>{`@keyframes drawPath{from{stroke-dashoffset:1200;}to{stroke-dashoffset:0;}}`}</style>
    </svg>);
}

// ─── MAIN ───
export default function Unroute(){
  const[dest,setDest]=useState("");const[level,setLevel]=useState(5);const[vibeKey,setVibeKey]=useState("any");const[route,setRoute]=useState(null);const[phase,setPhase]=useState("input");const[activeDisc,setActiveDisc]=useState(null);const[loadingText,setLoadingText]=useState("");const[proofs,setProofs]=useState({});const[useManual,setUseManual]=useState(false);const[manualStart,setManualStart]=useState("");const[startCoords,setStartCoords]=useState(null);const[destCoords,setDestCoords]=useState(null);const[resolvedStart,setResolvedStart]=useState(null);const[resolvedDest,setResolvedDest]=useState(null);const[toast,setToast]=useState(null);const geo=useGeolocation();const topRef=useRef(null);

  useEffect(()=>{if(geo.status==="denied"||geo.status==="unsupported")setUseManual(true);},[geo.status]);
  useEffect(()=>{topRef.current?.scrollIntoView({behavior:"smooth"});},[phase]);

  const msgs=["Avoiding the fastest route…","Querying OpenStreetMap…","Finding real places you've ignored…","Filtering out the boring chains…","Calculating serendipity…","Asking a local cat for directions…","Writing AI descriptions…","Almost there…"];
  const getSC=()=>{if(useManual&&startCoords)return startCoords;if(!useManual&&geo.coords)return{lat:geo.coords.lat,lng:geo.coords.lng};return null;};
  const vibeColor=VIBE_ROUTES[vibeKey]?.color||T.teal;

  const handleGenerate=async()=>{
    if(!dest.trim())return;setPhase("loading");setProofs({});setToast(null);let fDC=destCoords,fSC=getSC();
    if(!fDC){setLoadingText("Resolving destination…");try{const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(dest)}&format=json&limit=1`);const d=await r.json();if(d?.[0]){fDC={lat:parseFloat(d[0].lat),lng:parseFloat(d[0].lon)};setDestCoords(fDC);}}catch{}}
    if(useManual&&manualStart.trim()&&!fSC){setLoadingText("Resolving start…");try{const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(manualStart)}&format=json&limit=1`);const d=await r.json();if(d?.[0]){fSC={lat:parseFloat(d[0].lat),lng:parseFloat(d[0].lon)};setStartCoords(fSC);}}catch{}}
    if(!fSC||!fDC)setToast({message:"⚠ Pick both locations from the dropdown for real places.",type:"warning"});
    let i=0;setLoadingText(msgs[0]);const rp=generateRouteAsync(level,vibeKey,fSC,fDC);const iv=setInterval(()=>{i++;if(i<msgs.length)setLoadingText(msgs[i]);},700);
    const mw=new Promise(r=>setTimeout(r,Math.min(msgs.length,5)*700));
    Promise.all([rp,mw]).then(([r])=>{clearInterval(iv);setRoute(r);setPhase("result");if(r.isReal)setToast({message:`Found ${r.picks.length} real places!`,type:"success"});else if(r.isPioneer)setToast({message:"No mapped places found — Pioneer Mode.",type:"warning"});}).catch(()=>{clearInterval(iv);const n=ROUTE_NAMES[vibeKey]||ROUTE_NAMES.any;setRoute({picks:[],extraMin:0,baseDist:"?",routeDist:"?",name:n[0],vibeKey,isReal:false,isPioneer:true});setPhase("result");setToast({message:"Something went wrong. Pioneer Mode.",type:"error"});});};

  const handleReset=()=>{if(route)antiCloud.logRoute(route);setPhase("input");setRoute(null);setActiveDisc(null);setProofs({});};
  const handleReshuffle=async()=>{setActiveDisc(null);setProofs({});try{setRoute(await generateRouteAsync(level,vibeKey,getSC(),destCoords));}catch{setRoute({picks:[],extraMin:0,baseDist:"?",routeDist:"?",name:"The Detour",vibeKey,isReal:false,isPioneer:true});}};

  const startLabel=useManual?(manualStart.trim()||"Start"):geo.address?geo.address.split(",")[0].trim():geo.coords?`${geo.coords.lat.toFixed(3)}, ${geo.coords.lng.toFixed(3)}`:"You";

  const labels=["","Slight detour","A little lost","Curious","Wandering","Exploring","Adventurous","Deep drift","Off the grid","Into the unknown","Maximum serendipity"];

  return(
    <div style={{minHeight:"100dvh",background:T.bg,backgroundImage:T.grain,backgroundSize:"600px 600px",fontFamily:"'Playfair Display',Georgia,serif",color:T.ink,position:"relative"}}>

      {/* ── WEATHERING OVERLAYS ── */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:2,background:"radial-gradient(ellipse at center, transparent 35%, rgba(110,68,32,0.1) 55%, rgba(60,35,12,0.22) 75%, rgba(35,20,5,0.35) 100%)"}} />
      <div style={{position:"fixed",top:0,left:0,right:0,height:180,pointerEvents:"none",zIndex:2,background:"linear-gradient(to bottom, rgba(60,30,8,0.18) 0%, rgba(90,55,20,0.08) 40%, transparent 100%)"}} />
      <div style={{position:"fixed",bottom:0,left:0,right:0,height:160,pointerEvents:"none",zIndex:2,background:"linear-gradient(to top, rgba(60,30,8,0.16) 0%, rgba(90,55,20,0.06) 40%, transparent 100%)"}} />
      <div style={{position:"fixed",top:0,left:0,bottom:0,width:80,pointerEvents:"none",zIndex:2,background:"linear-gradient(to right, rgba(60,30,8,0.14) 0%, rgba(90,55,20,0.04) 60%, transparent 100%)"}} />
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:80,pointerEvents:"none",zIndex:2,background:"linear-gradient(to left, rgba(60,30,8,0.14) 0%, rgba(90,55,20,0.04) 60%, transparent 100%)"}} />
      <div style={{position:"fixed",top:0,left:0,width:200,height:200,pointerEvents:"none",zIndex:2,background:"radial-gradient(circle at 0% 0%, rgba(50,25,5,0.2) 0%, transparent 70%)"}} />
      <div style={{position:"fixed",top:0,right:0,width:200,height:200,pointerEvents:"none",zIndex:2,background:"radial-gradient(circle at 100% 0%, rgba(50,25,5,0.18) 0%, transparent 70%)"}} />
      <div style={{position:"fixed",bottom:0,left:0,width:200,height:200,pointerEvents:"none",zIndex:2,background:"radial-gradient(circle at 0% 100%, rgba(50,25,5,0.2) 0%, transparent 70%)"}} />
      <div style={{position:"fixed",bottom:0,right:0,width:200,height:200,pointerEvents:"none",zIndex:2,background:"radial-gradient(circle at 100% 100%, rgba(50,25,5,0.18) 0%, transparent 70%)"}} />
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:1,backgroundImage:`repeating-linear-gradient(to bottom, transparent, transparent 31px, rgba(110,68,32,0.08) 31px, rgba(110,68,32,0.08) 32px)`,backgroundSize:"100% 32px"}} />
      <div style={{position:"fixed",top:30,right:-30,width:200,height:200,borderRadius:"50%",pointerEvents:"none",zIndex:2,background:"radial-gradient(circle, rgba(110,68,32,0.06) 30%, rgba(110,68,32,0.12) 60%, transparent 70%)"}} />
      <div style={{position:"fixed",top:40,right:-20,width:180,height:180,borderRadius:"50%",border:"2px solid rgba(110,68,32,0.06)",pointerEvents:"none",zIndex:2}} />
      <div style={{position:"fixed",bottom:100,left:20,width:120,height:120,borderRadius:"50%",pointerEvents:"none",zIndex:2,background:"radial-gradient(circle, rgba(110,68,32,0.04) 40%, rgba(110,68,32,0.08) 65%, transparent 75%)"}} />
      <div style={{position:"fixed",top:"55%",right:"15%",width:80,height:1,pointerEvents:"none",zIndex:2,background:T.inkGhost,transform:"rotate(-25deg)",opacity:0.3}} />
      <div style={{position:"fixed",top:"56%",right:"14%",width:50,height:1,pointerEvents:"none",zIndex:2,background:T.inkGhost,transform:"rotate(-35deg)",opacity:0.2}} />
      <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:1,overflow:"hidden"}}>
        <svg style={{position:"absolute",top:"6%",left:"-2%",width:140,height:140,opacity:0.15,transform:"rotate(35deg)"}} viewBox="0 0 100 100" fill={T.stain}>
          <path d="M45,20 C55,15 65,30 50,45 C70,40 80,60 60,65 C70,80 50,90 40,70 C20,80 15,60 30,50 C10,40 20,20 40,30 Z" />
          <circle cx="18" cy="18" r="3" /><circle cx="80" cy="25" r="2" /><circle cx="75" cy="80" r="3.5" />
        </svg>
        <svg style={{position:"absolute",top:"35%",right:"5%",width:90,height:90,opacity:0.12}} viewBox="0 0 100 100" fill={T.stain}>
          <circle cx="50" cy="50" r="5" /><circle cx="25" cy="35" r="3" /><circle cx="72" cy="62" r="2" /><circle cx="58" cy="22" r="1.5" /><circle cx="38" cy="75" r="4" /><circle cx="82" cy="42" r="1.5" /><circle cx="15" cy="68" r="2.5" /><circle cx="65" cy="85" r="1" />
        </svg>
        <svg style={{position:"absolute",bottom:"12%",left:"6%",width:120,height:50,opacity:0.12,transform:"rotate(-10deg)"}} viewBox="0 0 100 50" fill={T.stain}>
          <path d="M10,25 C30,12 70,38 90,25 C80,42 40,18 20,42 Z" /><circle cx="12" cy="10" r="2" /><circle cx="90" cy="40" r="1.5" />
        </svg>
        <svg style={{position:"absolute",top:"70%",left:"40%",width:60,height:60,opacity:0.1}} viewBox="0 0 100 100" fill={T.stain}>
          <circle cx="20" cy="30" r="3" /><circle cx="60" cy="20" r="2" /><circle cx="80" cy="70" r="4" /><circle cx="40" cy="80" r="2" /><circle cx="10" cy="65" r="1.5" />
        </svg>
        <svg style={{position:"absolute",top:"15%",right:"20%",width:40,height:40,opacity:0.09}} viewBox="0 0 100 100" fill={T.stain}>
          <circle cx="30" cy="50" r="4" /><circle cx="70" cy="30" r="2.5" /><circle cx="50" cy="80" r="3" />
        </svg>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,600&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Caveat:wght@500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html{-webkit-text-size-adjust:100%;}
        body{overscroll-behavior:none;}
        input[type="text"]{font-size:16px !important;}
        input[type="range"]::-webkit-slider-thumb{appearance:none;width:28px;height:28px;border-radius:50%;background:${T.paper};border:3px solid ${T.accent};cursor:pointer;box-shadow:0 2px 6px ${T.shadow};}
        input[type="range"]::-moz-range-thumb{width:28px;height:28px;border-radius:50%;background:${T.paper};border:3px solid ${T.accent};cursor:pointer;}
        button{-webkit-tap-highlight-color:transparent;}
        button:active{opacity:0.85;}
        .hd{border-radius:255px 15px 225px 15px / 15px 225px 15px 255px !important;}
        .hd-alt{border-radius:15px 255px 15px 225px / 255px 15px 225px 15px !important;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulse{0%,100%{opacity:0.4;}50%{opacity:1;}}
        @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
        @keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
        ::selection{background:${T.accent};color:${T.paper};}
        a{color:${T.teal};}
      `}</style>

      {toast&&<Toast message={toast.message} type={toast.type} onDismiss={()=>setToast(null)} />}

      <div ref={topRef} style={{maxWidth:620,margin:"0 auto",padding:`max(24px,env(safe-area-inset-top,24px)) 24px max(32px,env(safe-area-inset-bottom,32px))`,paddingTop:48}}>

        {/* ── HEADER ── */}
        <div style={{marginBottom:32,animation:"fadeIn 0.6s ease"}}>
          {/* Squiggly SVG logo */}
          <div style={{marginBottom:10}}>
            <UnrouteLogo />
          </div>
          <p style={{fontSize:15,color:T.inkLight,fontFamily:"'Courier Prime',monospace",maxWidth:380,lineHeight:1.7,marginBottom:14}}>
            The intentionally inefficient route planner.<br/>Get lost safely. Find what you weren't looking for.
          </p>
          {geo.status==="located"&&<div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",border:`1px dashed ${T.teal}`,borderRadius:2,fontFamily:"'Courier Prime',monospace",fontSize:12,color:T.teal}}><span style={{width:6,height:6,borderRadius:"50%",background:T.teal,display:"inline-block"}} />{geo.address}</div>}
          {(geo.status==="requesting"||geo.status==="idle")&&<div style={{fontFamily:"'Courier Prime',monospace",fontSize:12,color:T.inkFaint,fontStyle:"italic"}}>◌ Locating you…</div>}
          {(geo.status==="denied"||geo.status==="unsupported")&&<div style={{fontFamily:"'Courier Prime',monospace",fontSize:12,color:T.accent}}>✕ Location unavailable</div>}
        </div>

        {/* ── TREASURE MAP ── */}
        {antiCloud.routeCount>0&&(
          <div style={{padding:"18px 22px",background:T.paper,border:`1.5px solid ${T.inkGhost}`,borderRadius:2,marginBottom:28,boxShadow:`2px 2px 8px ${T.shadow}, inset 0 0 20px rgba(139,105,20,0.02)`,transform:"rotate(-0.2deg)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><span style={{fontSize:16}}>🗺️</span><span style={{fontFamily:"'Courier Prime',monospace",fontSize:12,color:T.inkFaint,letterSpacing:1.5,fontWeight:700}}>YOUR TREASURE MAP</span><span style={{fontFamily:"'Courier Prime',monospace",fontSize:9,color:T.accent,marginLeft:"auto"}}>DEVICE-ONLY</span></div>
            <div style={{display:"flex",gap:28}}>
              {[{n:antiCloud.routeCount,l:"Routes",c:T.teal},{n:antiCloud.totalDiscoveries,l:"Finds",c:T.gold},{n:antiCloud.proofCount,l:"Proofs",c:T.accent}].map(s=><div key={s.l}><div style={{fontSize:30,fontWeight:900,color:s.c,fontFamily:"'Playfair Display',serif"}}>{s.n}</div><div style={{fontSize:11,color:T.inkFaint,fontFamily:"'Courier Prime',monospace"}}>{s.l}</div></div>)}
            </div>
          </div>
        )}

        {/* ── INPUT PHASE ── */}
        {phase==="input"&&(
          <div style={{animation:"fadeIn 0.5s ease"}}>
            <div style={{marginBottom:24}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <label style={{fontSize:11,fontFamily:"'Courier Prime',monospace",color:T.inkFaint,letterSpacing:2,fontWeight:700}}>STARTING FROM</label>
                <button onClick={()=>setUseManual(!useManual)} style={{fontSize:11,fontFamily:"'Courier Prime',monospace",padding:"6px 12px",background:"transparent",border:`1px solid ${T.inkGhost}`,borderRadius:2,color:T.inkLight,cursor:"pointer",minHeight:32}}>
                  {useManual?"◉ Use GPS":"✎ Type it"}
                </button>
              </div>
              {useManual?(
                <PlaceAutocomplete value={manualStart} onChange={setManualStart} onSelect={(s)=>{if(!s){setStartCoords(null);setResolvedStart(null);return;}setManualStart(s.display);setStartCoords({lat:s.lat,lng:s.lng});setResolvedStart(s);}} placeholder="King's Cross, SE1 9SG, Hackney Wick…" accentColor={vibeColor} resolvedPlace={resolvedStart} />
              ):(
                <div style={{padding:"14px 16px",fontSize:14,background:T.paper,border:`1.5px solid ${T.inkGhost}`,borderRadius:3,fontFamily:"'Courier Prime',monospace",display:"flex",alignItems:"center",gap:10,minHeight:50,boxShadow:`inset 0 1px 3px ${T.shadow}`}}>
                  {geo.status==="located"?(<><span style={{color:T.teal}}>◉</span><span style={{color:T.ink,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{geo.address||"Your location"}</span>{geo.coords&&<span style={{fontSize:10,color:T.inkFaint}}>{geo.coords.lat.toFixed(4)}, {geo.coords.lng.toFixed(4)}</span>}</>)
                  :geo.status==="requesting"?(<span style={{color:T.inkFaint,fontStyle:"italic"}}>◌ Getting location…</span>)
                  :(<span style={{color:T.accent}}>✕ Location unavailable — switch to manual</span>)}
                </div>
              )}
            </div>

            <div style={{marginBottom:24}}>
              <label style={{display:"block",fontSize:11,fontFamily:"'Courier Prime',monospace",color:T.inkFaint,letterSpacing:2,fontWeight:700,marginBottom:10}}>DESTINATION</label>
              <PlaceAutocomplete value={dest} onChange={setDest} onSelect={(s)=>{if(!s){setDestCoords(null);setResolvedDest(null);return;}setDest(s.display);setDestCoords({lat:s.lat,lng:s.lng});setResolvedDest(s);}} placeholder="Bermondsey Station, E1 6AN, London Bridge…" accentColor={vibeColor} resolvedPlace={resolvedDest} />
            </div>

            {/* Vibe selector */}
            <div style={{marginBottom:28}}>
              <label style={{display:"block",fontSize:11,fontFamily:"'Courier Prime',monospace",color:T.inkFaint,letterSpacing:2,fontWeight:700,marginBottom:10}}>FLAVOUR OF LOST</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {Object.entries(VIBE_ROUTES).map(([key,v],idx)=>{const isA=vibeKey===key;const tilt=(idx%2===0?1:-1)*(0.8+idx*0.2);return(
                  <button key={key} className={idx%2===0?"hd":"hd-alt"} onClick={()=>setVibeKey(key)} style={{padding:"16px",border:`2px solid ${isA?v.color:T.inkGhost}`,background:isA?v.soft:"transparent",cursor:"pointer",textAlign:"left",transition:"all 0.15s",minHeight:52,transform:`rotate(${tilt}deg)${isA?" scale(1.02)":""}`,boxShadow:isA?`2px 3px 0px ${v.color}40`:"none"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><span style={{fontSize:20}}>{v.icon}</span><span style={{fontSize:15,fontWeight:700,color:isA?v.color:T.inkLight,fontFamily:"'Playfair Display',serif"}}>{v.label}</span></div>
                    <p style={{fontSize:12,color:T.inkFaint,fontFamily:"'Courier Prime',monospace",margin:0,lineHeight:1.4}}>{v.desc}</p>
                  </button>);
                })}
              </div>
            </div>

            {/* Level slider */}
            <div style={{marginBottom:36}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
                <span style={{fontSize:11,fontFamily:"'Courier Prime',monospace",color:T.inkFaint,letterSpacing:2,fontWeight:700}}>DISCOVERY LEVEL</span>
                <span style={{fontSize:40,fontFamily:"'Playfair Display',serif",fontWeight:900,color:vibeColor,lineHeight:1}}>{level}</span>
              </div>
              <input type="range" min="1" max="10" value={level} onChange={e=>setLevel(parseInt(e.target.value))} style={{width:"100%",height:6,appearance:"none",background:`linear-gradient(90deg, ${T.teal}, ${T.gold}, ${T.accent})`,borderRadius:3,outline:"none",cursor:"pointer"}} />
              <div style={{marginTop:8,fontSize:13,color:T.inkFaint,fontFamily:"'Courier Prime',monospace",textAlign:"center",fontStyle:"italic"}}>{labels[level]}</div>
            </div>

            <button className="hd" onClick={handleGenerate} disabled={!dest.trim()} style={{width:"100%",padding:"20px 24px",fontSize:18,fontWeight:700,fontFamily:"'Playfair Display',serif",fontStyle:"italic",background:dest.trim()?T.ink:"transparent",color:dest.trim()?T.paper:T.inkGhost,border:`2.5px solid ${dest.trim()?T.ink:T.inkGhost}`,cursor:dest.trim()?"pointer":"default",transition:"all 0.3s",minHeight:60,letterSpacing:0.5,opacity:dest.trim()?1:0.4,transform:"rotate(-0.4deg)",boxShadow:dest.trim()?`3px 4px 0px ${T.inkGhost}`:"none"}}>
              Get Beautifully Lost →
            </button>

            <div style={{marginTop:24,padding:"14px 18px",borderLeft:`3px solid ${T.inkGhost}`,fontFamily:"'Courier Prime',monospace",fontSize:12,color:T.inkFaint,lineHeight:1.8,fontStyle:"italic"}}>
              Tap any stop to expand it. Real places from OpenStreetMap. AI descriptions when available. Photos are optional — just for fun. Everything stays on your device.
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {phase==="loading"&&(
          <div style={{textAlign:"center",padding:"80px 20px",animation:"fadeIn 0.4s ease"}}>
            <div style={{fontSize:56,marginBottom:28,animation:"float 2.5s ease-in-out infinite"}}>{VIBE_ROUTES[vibeKey]?.icon||"🧭"}</div>
            <p style={{fontSize:16,fontFamily:"'Courier Prime',monospace",color:T.inkLight,fontStyle:"italic",lineHeight:1.6}}>{loadingText}</p>
            <div style={{marginTop:32,width:160,height:2,background:T.inkGhost,borderRadius:1,margin:"32px auto 0",overflow:"hidden"}}>
              <div style={{height:"100%",background:vibeColor,borderRadius:1,animation:"loadBar 3.5s ease-in-out infinite"}} />
            </div>
            <style>{`@keyframes loadBar{0%{width:0%;}50%{width:75%;}100%{width:100%;}}`}</style>
          </div>
        )}

        {/* ── RESULT ── */}
        {phase==="result"&&route&&(
          <div style={{animation:"fadeIn 0.5s ease"}}>
            {/* Header card */}
            <div style={{padding:"24px",marginBottom:24,background:T.paper,border:`1.5px solid ${T.inkGhost}`,borderRadius:2,boxShadow:`2px 3px 12px ${T.shadow}, inset 0 0 30px rgba(139,105,20,0.02)`,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,right:0,width:40,height:40,background:"linear-gradient(135deg, transparent 50%, rgba(44,36,22,0.03) 50%)",pointerEvents:"none"}} />
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
                <Stamp color={vibeColor}>{VIBE_ROUTES[vibeKey]?.label}</Stamp>
                {route.isReal?<Stamp color={T.teal}>REAL PLACES</Stamp>:route.isPioneer?<Stamp color={T.gold}>PIONEER MODE</Stamp>:<Stamp color={T.inkFaint}>NO DATA</Stamp>}
                {route.isReal&&route.picks?.some(p=>p.aiEnhanced)&&<Stamp color={T.gold}>AI-WRITTEN</Stamp>}
              </div>
              <h2 style={{fontSize:32,fontWeight:700,color:T.ink,letterSpacing:-0.5,marginBottom:6,fontFamily:"'Caveat',cursive",transform:"rotate(-0.5deg)"}}>{route.name}</h2>
              <p style={{fontSize:16,color:T.inkLight,fontFamily:"'Caveat',cursive",fontWeight:600}}>
                <span style={{color:vibeColor}}>◉ {startLabel}</span><span style={{margin:"0 8px",color:T.inkGhost,fontFamily:"'Courier Prime',monospace",fontSize:12}}>→</span><span style={{color:T.accent}}>{dest}</span>
              </p>
              {route.picks.length>0&&(
                <div style={{display:"flex",gap:20,marginTop:16,paddingTop:16,borderTop:`1px dashed ${T.inkGhost}`}}>
                  <div><span style={{fontSize:10,fontFamily:"'Courier Prime',monospace",color:T.inkFaint}}>EFFICIENT</span><div style={{fontSize:16,fontFamily:"'Courier Prime',monospace",color:T.inkGhost,textDecoration:"line-through"}}>{route.baseDist} km</div></div>
                  <div><span style={{fontSize:10,fontFamily:"'Courier Prime',monospace",color:vibeColor}}>ADVENTURE</span><div style={{fontSize:16,fontFamily:"'Courier Prime',monospace",color:T.ink,fontWeight:700}}>{route.routeDist} km</div></div>
                  <div style={{marginLeft:"auto",textAlign:"right"}}><span style={{fontSize:10,fontFamily:"'Courier Prime',monospace",color:T.accent}}>EXTRA TIME</span><div style={{fontSize:16,fontFamily:"'Courier Prime',monospace",color:T.accent,fontWeight:700}}>+{route.extraMin} min</div></div>
                </div>
              )}
              {route.picks.length>0&&(
                <div style={{marginTop:14}}>
                  <div style={{height:3,background:T.inkGhost,borderRadius:1,overflow:"hidden"}}><div style={{height:"100%",background:vibeColor,borderRadius:1,transition:"width 0.5s",width:`${(Object.keys(proofs).length/route.picks.length)*100}%`}} /></div>
                  <p style={{fontSize:10,fontFamily:"'Courier Prime',monospace",color:T.inkFaint,marginTop:6}}>{Object.keys(proofs).length} photos · {route.picks.length} stops</p>
                </div>
              )}
            </div>

            {/* Map */}
            {route.picks.length>0&&<div style={{marginBottom:24,borderRadius:3,overflow:"hidden",border:`1.5px solid ${T.inkGhost}`,boxShadow:`0 2px 8px ${T.shadow}`}}><RouteMap discoveries={route.picks} active={activeDisc} startLabel={startLabel} vibeColor={vibeColor} unlockedCount={route.picks.length} /></div>}

            {/* Pioneer */}
            {route.isPioneer&&(
              <div style={{padding:"28px",marginBottom:24,background:T.goldSoft,border:`1.5px dashed ${T.gold}`,borderRadius:3,animation:"fadeIn 0.5s ease"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
                  <span style={{fontSize:36}}>🏴‍☠️</span>
                  <div>
                    <h3 style={{fontSize:20,fontWeight:900,color:T.gold,fontStyle:"italic",marginBottom:8}}>Pioneer Mode</h3>
                    <p style={{fontSize:14,color:T.inkLight,fontFamily:"'Courier Prime',monospace",lineHeight:1.8,marginBottom:14}}>
                      {!getSC()||!destCoords?"We need coordinates to search. Pick both locations from the dropdown suggestions.":"OpenStreetMap has nothing mapped between these points. You're in uncharted territory."}
                    </p>
                    <p style={{fontSize:14,color:T.gold,fontFamily:"'Courier Prime',monospace",lineHeight:1.8,fontWeight:700}}>
                      {!getSC()||!destCoords?"↩ Go back and select from the suggestions.":"Walk 15 minutes in any direction. Find something. Take a photo. You're the cartographer now."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Discoveries */}
            {route.picks.length>0&&(
              <div style={{marginBottom:12}}>
                <p style={{fontSize:11,fontFamily:"'Courier Prime',monospace",color:T.inkFaint,letterSpacing:2,fontWeight:700,marginBottom:14}}>{route.picks.length} DISCOVERIES · TAP TO EXPAND</p>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {route.picks.map((d,i)=><DiscoveryCard key={i} discovery={d} index={i} isActive={activeDisc===i} proofImage={proofs[i]} onClick={()=>setActiveDisc(activeDisc===i?null:i)} onProofCapture={(img)=>setProofs(prev=>({...prev,[i]:img}))} />)}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{display:"flex",gap:12,marginTop:28}}>
              <button className="hd-alt" onClick={handleReshuffle} style={{flex:1,padding:"16px",fontSize:15,fontWeight:700,fontFamily:"'Playfair Display',serif",background:"transparent",color:vibeColor,border:`2.5px solid ${vibeColor}`,cursor:"pointer",minHeight:54,transform:"rotate(0.4deg)",boxShadow:`2px 3px 0px ${vibeColor}30`}}>↻ Reshuffle</button>
              <button className="hd" onClick={handleReset} style={{flex:1,padding:"16px",fontSize:15,fontWeight:700,fontFamily:"'Playfair Display',serif",background:T.ink,color:T.paper,border:`2.5px solid ${T.ink}`,cursor:"pointer",minHeight:54,transform:"rotate(-0.3deg)",boxShadow:`2px 3px 0px ${T.inkGhost}`}}>← New Route</button>
            </div>

            <div style={{marginTop:28,padding:"14px 18px",borderLeft:`3px solid ${T.accent}`,fontFamily:"'Courier Prime',monospace",fontSize:12,color:T.inkFaint,lineHeight:1.8,fontStyle:"italic"}}>
              🗺️ This route exists only on your device. No server. No backup. Close this tab and it's gone — like a real memory.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
