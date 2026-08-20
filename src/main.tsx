
import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Bell, Check, ChevronDown, Clock, Film, LogOut, Plus, Search, Settings, Trash2, Tv, X} from 'lucide-react';
import './styles.css';

type Kind='movie'|'tv';

type Title={
  id:string;
  name:string;
  kind:Kind;
  year:number;
  poster:string;
  backdrop:string;
  overview:string;
};

type Profile={
  id:string;
  name:string;
  avatar:string;
};

type State={
  watched:string[];
  watchlist:string[];
  rewatch:string[];
};

type Reminder={
  id:string;
  profileId:string;
  titleId:string;
  date:string;
  time:string;
};

type Scheduled={
  id:string;
  profileId:string;
  titleId:string;
  date:string;
  time:string;
  message:string;
};

/* --------------------------------------------------
   MOCK LIBRARY
-------------------------------------------------- */

const mock:Title[]=[
 {
  id:'matrix',
  name:'The Matrix',
  kind:'movie',
  year:1999,
  poster:'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
  backdrop:'https://image.tmdb.org/t/p/w1280/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg',
  overview:'A hacker discovers that the world he knows is an elaborate simulation.'
 },
 {
  id:'interstellar',
  name:'Interstellar',
  kind:'movie',
  year:2014,
  poster:'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
  backdrop:'https://image.tmdb.org/t/p/w1280/xJHokMbljvjADYdit5fK5QTB1lx.jpg',
  overview:'Explorers travel through a wormhole in space in an attempt to ensure humanity’s survival.'
 },
 {
  id:'the-bear',
  name:'The Bear',
  kind:'tv',
  year:2022,
  poster:'https://image.tmdb.org/t/p/w500/sHFlbKS3WLqMnpAcZsVv0M9w5sR.jpg',
  backdrop:'https://image.tmdb.org/t/p/w1280/7C2j9rA0j3xqVhX0vJvX4q5t6uI.jpg',
  overview:'A young chef returns to Chicago to run his family sandwich shop.'
 },
 {
  id:'succession',
  name:'Succession',
  kind:'tv',
  year:2018,
  poster:'https://image.tmdb.org/t/p/w500/7HW47XbkNQ5fiwQFYGqwR5f7k4s.jpg',
  backdrop:'https://image.tmdb.org/t/p/w1280/8Y4i1M8i1fV0G0xY7z8gq2vWqKp.jpg',
  overview:'A powerful family faces an uncertain future as control of their media empire is contested.'
 },
 {
  id:'spirited-away',
  name:'Spirited Away',
  kind:'movie',
  year:2001,
  poster:'https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg',
  backdrop:'https://image.tmdb.org/t/p/w1280/AbC2D3e4F5g6H7i8J9k0L1m2N3o.jpg',
  overview:'A young girl enters a mysterious spirit world and must find her way home.'
 },
 {
  id:'severance',
  name:'Severance',
  kind:'tv',
  year:2022,
  poster:'https://image.tmdb.org/t/p/w500/l9x7pZ5mKQ8r5H0q7tYv2W3x4aB.jpg',
  backdrop:'https://image.tmdb.org/t/p/w1280/l9x7pZ5mKQ8r5H0q7tYv2W3x4aB.jpg',
  overview:'Employees undergo a procedure that separates their work and personal memories.'
 }
];

const initialProfiles:Profile[]=[
 {id:'admin',name:'Admin',avatar:'👑'},
 {id:'sarah',name:'Sarah',avatar:'🌸'},
 {id:'john',name:'John',avatar:'🎬'}
];

const initialState:Record<string,State>={
 admin:{
  watched:['matrix'],
  watchlist:['interstellar','the-bear'],
  rewatch:['matrix']
 },
 sarah:{
  watched:['the-bear'],
  watchlist:['matrix','severance'],
  rewatch:['the-bear']
 },
 john:{
  watched:['succession'],
  watchlist:['spirited-away','interstellar'],
  rewatch:[]
 }
};

const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);

function useStored<T>(key:string,fallback:T){
 const [v,setV]=useState<T>(()=>{ 
  try{
   return JSON.parse(localStorage.getItem(key)||'null')??fallback
  }catch{
   return fallback
  }
 });

 useEffect(()=>{
  localStorage.setItem(key,JSON.stringify(v))
 },[key,v]);

 return [v,setV] as const
}

/* --------------------------------------------------
   TMDB SERVICE
-------------------------------------------------- */

async function searchTMDB(query:string):Promise<Title[]>{

 if(!query.trim()) return [];

 const response=await fetch(
  `/api/tmdb/search?query=${encodeURIComponent(query)}&type=multi`
 );

 if(!response.ok){
  throw new Error('TMDB search failed');
 }

 const data=await response.json();

 return (data.results||[])
  .filter((item:any)=>item.media_type==='movie'||item.media_type==='tv')
  .map((item:any):Title=>{

   const kind:Kind=item.media_type==='tv'?'tv':'movie';

   const date=kind==='movie'
    ?item.release_date
    :item.first_air_date;

   return {
    id:`tmdb-${kind}-${item.id}`,
    name:kind==='movie'?item.title:item.name,
    kind,
    year:date?Number(date.slice(0,4)):0,
    poster:item.poster_path
     ?`https://image.tmdb.org/t/p/w500${item.poster_path}`
     :'https://placehold.co/500x750/171717/ffffff?text=No+Poster',
    backdrop:item.backdrop_path
     ?`https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
     :'',
    overview:item.overview||''
   };
  });
}

/* --------------------------------------------------
   APP
-------------------------------------------------- */

function App(){

 const [library,setLibrary]=useStored<Title[]>('sx-library',mock);
 const [profiles,setProfiles]=useStored<Profile[]>('sx-profiles',initialProfiles);
 const [states,setStates]=useStored<Record<string,State>>('sx-states',initialState);
 const [reminders,setReminders]=useStored<Reminder[]>('sx-reminders',[]);
 const [scheduled,setScheduled]=useStored<Scheduled[]>('sx-scheduled',[]);
 const [hero,setHero]=useStored<Title>('sx-hero',mock[1]);

 const [profileId,setProfileId]=useState('admin');
 const [tab,setTab]=useState<'library'|'rewatch'>('library');
 const [filter,setFilter]=useState<'all'|'watchlist'|'watched'>('all');
 const [kind,setKind]=useState<'all'|Kind>('all');
 const [q,setQ]=useState('');

 const [showProfile,setShowProfile]=useState(false);
 const [showAdd,setShowAdd]=useState(false);
 const [showReco,setShowReco]=useState(true);
 const [showReminder,setShowReminder]=useState<Title|null>(null);
 const [showSchedule,setShowSchedule]=useState<Title|null>(null);
 const [showHero,setShowHero]=useState(false);
 const [editing,setEditing]=useState<Profile|null>(null);
 const [menu,setMenu]=useState(false);

 const isAdmin=profileId==='admin';
 const p=profiles.find(x=>x.id===profileId)||profiles[0];

 const st=states[profileId]||{
  watched:[],
  watchlist:[],
  rewatch:[]
 };

 const visible=useMemo(
  ()=>library
   .filter(t=>t.name.toLowerCase().includes(q.toLowerCase()))
   .filter(t=>kind==='all'||t.kind===kind)
   .filter(
    t=>tab==='rewatch'
     ?st.rewatch.includes(t.id)
     :filter==='all'
      ||(filter==='watched'
       ?st.watched.includes(t.id)
       :st.watchlist.includes(t.id))
   ),
  [library,q,kind,tab,filter,st]
 );

 const rec=
  library.find(t=>st.watchlist.includes(t.id)&&!st.watched.includes(t.id))
  ||library.find(t=>!st.watched.includes(t.id));

 const updateState=(fn:(s:State)=>State)=>
  setStates({
   ...states,
   [profileId]:fn(st)
  });

 const toggle=(arr:keyof State,id:string)=>
  updateState(
   s=>({
    ...s,
    [arr]:s[arr].includes(id)
     ?s[arr].filter(x=>x!==id)
     :[...s[arr],id]
   })
  );

 const removeTitle=(id:string)=>{

  setLibrary(
   library.filter(t=>t.id!==id)
  );

  const ns={...states};

  Object.keys(ns).forEach(k=>{
   ns[k]={
    watched:ns[k].watched.filter(x=>x!==id),
    watchlist:ns[k].watchlist.filter(x=>x!==id),
    rewatch:ns[k].rewatch.filter(x=>x!==id)
   }
  });

  setStates(ns);

  setReminders(
   reminders.filter(r=>r.titleId!==id)
  );

  setScheduled(
   scheduled.filter(r=>r.titleId!==id)
  );
 };

 const addProfile=(name:string,avatar:string)=>{

  const np={
   id:uid(),
   name:name||'New Profile',
   avatar:avatar||'🙂'
  };

  setProfiles([...profiles,np]);

  setStates({
   ...states,
   [np.id]:{
    watched:[],
    watchlist:[],
    rewatch:[]
   }
  });

  setEditing(null);
 };

 return <div className="app">

  <header>
   <div className="logo">
    STREAM<span>IX</span>
   </div>

   <div className="header-right">

    <button
     className="profile-pill"
     onClick={()=>setShowProfile(true)}
    >
     <span>{p.avatar}</span>
     {p.name}
     <ChevronDown size={16}/>
    </button>

    {isAdmin&&
     <button
      className="admin-badge"
      onClick={()=>setMenu(!menu)}
     >
      ADMIN
     </button>
    }

    {menu&&isAdmin&&
     <div className="admin-menu">

      <button onClick={()=>setShowAdd(true)}>
       <Plus/> Add title
      </button>

      <button onClick={()=>setShowHero(true)}>
       <Settings/> Edit hero
      </button>

     </div>
    }

   </div>
  </header>

  <section
   className="hero"
   style={{
    backgroundImage:
     `linear-gradient(90deg,rgba(0,0,0,.92),rgba(0,0,0,.15)),url(${hero.backdrop})`
   }}
  >

   <div className="hero-content">

    <div className="eyebrow">
     FEATURED
    </div>

    <h1>{hero.name}</h1>

    <p>
     {hero.year} · {hero.kind==='movie'?'Movie':'TV Show'}
    </p>

    {isAdmin&&
     <button
      className="ghost"
      onClick={()=>setShowHero(true)}
     >
      Edit Hero
     </button>
    }

   </div>

  </section>

  <main>

   <div className="switch">

    <button
     className={tab==='library'?'active':''}
     onClick={()=>{
      setTab('library');
      setFilter('all')
     }}
    >
     Library
    </button>

    <button
     className={tab==='rewatch'?'active':''}
     onClick={()=>setTab('rewatch')}
    >
     {p.name}'s Re-watch
    </button>

   </div>

   {tab==='library'&&
    <>
     <div className="toolbar">

      <div className="filters">

       <button
        className={filter==='all'?'selected':''}
        onClick={()=>setFilter('all')}
       >
        All
       </button>

       <button
        className={filter==='watchlist'?'selected':''}
        onClick={()=>setFilter('watchlist')}
       >
        Watchlist
       </button>

       <button
        className={filter==='watched'?'selected':''}
        onClick={()=>setFilter('watched')}
       >
        Watched
       </button>

      </div>

      <div className="search">

       <Search size={18}/>

       <input
        value={q}
        onChange={e=>setQ(e.target.value)}
        placeholder="Search library"
       />

      </div>

     </div>

     <div className="format">

      <button
       className={kind==='all'?'selected':''}
       onClick={()=>setKind('all')}
      >
       All
      </button>

      <button
       className={kind==='movie'?'selected':''}
       onClick={()=>setKind('movie')}
      >
       <Film size={15}/> Movies
      </button>

      <button
       className={kind==='tv'?'selected':''}
       onClick={()=>setKind('tv')}
      >
       <Tv size={15}/> TV
      </button>

     </div>
    </>
   }

   <div className="grid">

    {visible.map(t=>
     <Card
      key={t.id}
      t={t}
      st={st}
      isAdmin={isAdmin}
      onWatch={()=>toggle('watched',t.id)}
      onList={()=>toggle('watchlist',t.id)}
      onRewatch={()=>toggle('rewatch',t.id)}
      onRemove={()=>removeTitle(t.id)}
      onReminder={()=>setShowReminder(t)}
      onSchedule={()=>setShowSchedule(t)}
     />
    )}

    {!visible.length&&
     <div className="empty">
      Nothing here yet.
     </div>
    }

   </div>

  </main>

  {showReco&&rec&&
   <Modal
    title="Today's Reco"
    onClose={()=>setShowReco(false)}
   >
    <div className="reco">

     <img src={rec.poster}/>

     <div>

      <h2>{rec.name}</h2>

      <p>
       {rec.year} · {rec.kind==='movie'?'Movie':'TV Show'}
      </p>

      <p>{rec.overview}</p>

      <button
       className="pink"
       onClick={()=>{
        toggle('watchlist',rec.id);
        setShowReco(false)
       }}
      >
       Add to Watchlist
      </button>

     </div>

    </div>
   </Modal>
  }

  {showProfile&&
   <Modal
    title="Profiles"
    onClose={()=>setShowProfile(false)}
   >

    <div className="profiles">

     {profiles.map(x=>
      <div
       className="profile-row"
       key={x.id}
      >

       <button
        onClick={()=>{
         setProfileId(x.id);
         setShowProfile(false)
        }}
        className={x.id===profileId?'current':''}
       >

        <span className="avatar">
         {x.avatar}
        </span>

        <span>{x.name}</span>

        {x.id===profileId&&
         <Check size={18}/>
        }

       </button>

       {x.id!=='admin'&&
        <button
         className="icon"
         onClick={()=>{
          setEditing(x);
          setShowProfile(false)
         }}
        >
         ✎
        </button>
       }

      </div>
     )}

     <button
      className="add-profile"
      onClick={()=>{
       setEditing({
        id:'new',
        name:'',
        avatar:'🙂'
       });
       setShowProfile(false)
      }}
     >
      <Plus/> Add Profile
     </button>

    </div>

   </Modal>
  }

  {editing&&
   <ProfileEditor
    profile={editing.id==='new'?null:editing}
    onClose={()=>setEditing(null)}
    onSave={(n,a)=>
     editing.id==='new'
      ?addProfile(n,a)
      :(setProfiles(
        profiles.map(x=>
         x.id===editing.id
          ?{...x,name:n,avatar:a}
          :x
        )
       ),setEditing(null))
    }
    onDelete={
     editing.id==='new'
      ?undefined
      :()=>{
       setProfiles(
        profiles.filter(x=>x.id!==editing.id)
       );

       const ns={...states};
       delete ns[editing.id];

       setStates(ns);
       setEditing(null);
       setProfileId('admin');
      }
    }
   />
  }

  {showAdd&&
   <AddTitle
    library={library}
    onClose={()=>setShowAdd(false)}
    onAdd={t=>setLibrary([...library,t])}
   />
  }

  {showReminder&&
   <ReminderModal
    title={showReminder}
    onClose={()=>setShowReminder(null)}
    onSave={(d,time)=>{
     setReminders([
      ...reminders,
      {
       id:uid(),
       profileId,
       titleId:showReminder.id,
       date:d,
       time
      }
     ]);

     setShowReminder(null)
    }}
   />
  }

  {showSchedule&&isAdmin&&
   <ScheduleModal
    title={showSchedule}
    profiles={profiles.filter(x=>x.id!=='admin')}
    onClose={()=>setShowSchedule(null)}
    onSave={r=>{
     setScheduled([...scheduled,r]);
     setShowSchedule(null)
    }}
   />
  }

  {showHero&&isAdmin&&
   <HeroModal
    hero={hero}
    library={library}
    onClose={()=>setShowHero(false)}
    onSave={t=>{
     setHero(t);
     setShowHero(false)
    }}
   />
  }

  <footer>

   <span>
    <Clock size={14}/>
    {reminders.filter(r=>r.profileId===profileId).length}
    reminder(s)
   </span>

   {isAdmin&&
    <span>
     {scheduled.length} scheduled reco(s)
    </span>
   }

   <button
    onClick={()=>
     alert(
      'Demo mode: connect your real auth/backend before production use.'
     )
    }
   >
    <LogOut size={14}/>
    Sign out
   </button>

  </footer>

 </div>
}

/* --------------------------------------------------
   CARD
-------------------------------------------------- */

function Card({
 t,
 st,
 isAdmin,
 onWatch,
 onList,
 onRewatch,
 onRemove,
 onReminder,
 onSchedule
}:{
 t:Title;
 st:State;
 isAdmin:boolean;
 onWatch:()=>void;
 onList:()=>void;
 onRewatch:()=>void;
 onRemove:()=>void;
 onReminder:()=>void;
 onSchedule:()=>void
}){

 return <article className="card">

  <div className="poster-wrap">

   <img
    src={t.poster}
    onError={e=>{
     e.currentTarget.src=
      'https://placehold.co/500x750/171717/ffffff?text='+
      encodeURIComponent(t.name)
    }}
   />

   <span className="kind">
    {t.kind==='movie'?'MOVIE':'TV'}
   </span>

   {isAdmin&&
    <button
     className="remove"
     onClick={onRemove}
     title="Remove title"
    >
     <Trash2 size={16}/>
    </button>
   }

  </div>

  <div className="card-body">

   <h3>{t.name}</h3>

   <p>{t.year}</p>

   <div className="actions">

    <button
     className={st.watchlist.includes(t.id)?'on':''}
     onClick={onList}
    >
     + Watchlist
    </button>

    <button
     className={st.watched.includes(t.id)?'on':''}
     onClick={onWatch}
    >
     {st.watched.includes(t.id)
      ?'✓ Watched'
      :'Mark watched'}
    </button>

   </div>

   <div className="small-actions">

    <button onClick={onRewatch}>
     ↻ Re-watch
    </button>

    <button onClick={onReminder}>
     <Bell size={14}/>
     Remind me
    </button>

    {isAdmin&&
     <button onClick={onSchedule}>
      Schedule reco
     </button>
    }

   </div>

  </div>

 </article>
}

/* --------------------------------------------------
   MODAL
-------------------------------------------------- */

function Modal({
 title,
 onClose,
 children
}:{
 title:string;
 onClose:()=>void;
 children:React.ReactNode
}){

 return <div
  className="overlay"
  onMouseDown={e=>{
   if(e.currentTarget===e.target)onClose()
  }}
 >

  <div className="modal">

   <div className="modal-head">

    <h2>{title}</h2>

    <button
     className="icon"
     onClick={onClose}
    >
     <X/>
    </button>

   </div>

   {children}

  </div>

 </div>
}

/* --------------------------------------------------
   PROFILE EDITOR
-------------------------------------------------- */

function ProfileEditor({
 profile,
 onClose,
 onSave,
 onDelete
}:{
 profile:Profile|null;
 onClose:()=>void;
 onSave:(n:string,a:string)=>void;
 onDelete?:()=>void
}){

 const [n,setN]=useState(profile?.name||'');
 const [a,setA]=useState(profile?.avatar||'🙂');

 return <Modal
  title={profile?'Edit Profile':'Add Profile'}
  onClose={onClose}
 >

  <label>
   Profile Name
   <input
    autoFocus
    value={n}
    onChange={e=>setN(e.target.value)}
   />
  </label>

  <label>
   Profile Photo

   <div className="emoji-grid">

    {['🙂','🌸','🎬','🍿','⭐','🐱','🦋','🔥'].map(x=>
     <button
      className={a===x?'picked':''}
      onClick={()=>setA(x)}
      key={x}
     >
      {x}
     </button>
    )}

   </div>

  </label>

  <label>
   Upload Photo
   <input
    type="file"
    accept="image/*"
   />
  </label>

  <button
   className="pink full"
   onClick={()=>onSave(n,a)}
  >
   Save Profile
  </button>

  {onDelete&&
   <button
    className="danger full"
    onClick={()=>
     confirm('Delete this profile?')&&onDelete()
    }
   >
    Delete Profile
   </button>
  }

 </Modal>
}

/* --------------------------------------------------
   TMDB ADD TITLE
-------------------------------------------------- */

function AddTitle({
 library,
 onClose,
 onAdd
}:{
 library:Title[];
 onClose:()=>void;
 onAdd:(t:Title)=>void
}){

 const [q,setQ]=useState('');
 const [results,setResults]=useState<Title[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');

 useEffect(()=>{

  if(!q.trim()){
   setResults([]);
   return;
  }

  const timer=setTimeout(async()=>{

   setLoading(true);
   setError('');

   try{

    const data=await searchTMDB(q);

    setResults(data);

   }catch{

    setError(
     'Unable to search TMDB right now.'
    );

   }finally{

    setLoading(false);

   }

  },400);

  return()=>clearTimeout(timer);

 },[q]);

 const available=results.filter(
  t=>!library.some(
   l=>l.id===t.id
  )
 );

 return <Modal
  title="Add Movie / TV Show"
  onClose={onClose}
 >

  <p className="muted">
   Search TMDB for movies and TV shows.
  </p>

  <div className="search wide">

   <Search size={18}/>

   <input
    autoFocus
    value={q}
    onChange={e=>setQ(e.target.value)}
    placeholder="Search movies and TV shows"
   />

  </div>

  {loading&&
   <p className="muted">
    Searching TMDB...
   </p>
  }

  {error&&
   <p className="muted">
    {error}
   </p>
  }

  <div className="result-list">

   {available.map(t=>

    <div
     className="result"
     key={t.id}
    >

     <img src={t.poster}/>

     <div>

      <b>{t.name}</b>

      <span>
       {t.year} ·
       {t.kind==='movie'
        ?' Movie'
        :' TV Show'}
      </span>

     </div>

     <button
      className="pink add"
      onClick={()=>{
       onAdd(t);
       setResults(
        results.filter(
         x=>x.id!==t.id
        )
       );
      }}
     >
      + Add
     </button>

    </div>

   )}

  </div>

 </Modal>
}

/* --------------------------------------------------
   REMINDER
-------------------------------------------------- */

function ReminderModal({
 title,
 onClose,
 onSave
}:{
 title:Title;
 onClose:()=>void;
 onSave:(d:string,t:string)=>void
}){

 const [d,setD]=useState('');
 const [t,setT]=useState('19:00');

 return <Modal
  title="Remind Me"
  onClose={onClose}
 >

  <p>
   Set a reminder for <b>{title.name}</b>.
  </p>

  <label>
   Date
   <input
    type="date"
    value={d}
    onChange={e=>setD(e.target.value)}
   />
  </label>

  <label>
   Time
   <input
    type="time"
    value={t}
    onChange={e=>setT(e.target.value)}
   />
  </label>

  <button
   className="pink full"
   disabled={!d}
   onClick={()=>onSave(d,t)}
  >
   Save Reminder
  </button>

  <p className="muted">
   Browser calendar/push notifications require
   additional integration. The reminder is saved
   locally in this demo.
  </p>

 </Modal>
}

/* --------------------------------------------------
   SCHEDULE RECOMMENDATION
-------------------------------------------------- */

function ScheduleModal({
 title,
 profiles,
 onClose,
 onSave
}:{
 title:Title;
 profiles:Profile[];
 onClose:()=>void;
 onSave:(r:Scheduled)=>void
}){

 const [pid,setPid]=useState(profiles[0]?.id||'');
 const [d,setD]=useState('');
 const [t,setT]=useState('19:00');
 const [m,setM]=useState('How about this one?');

 return <Modal
  title="Schedule Personal Recommendation"
  onClose={onClose}
 >

  <label>
   Profile

   <select
    value={pid}
    onChange={e=>setPid(e.target.value)}
   >

    {profiles.map(p=>
     <option
      value={p.id}
      key={p.id}
     >
      {p.name}
     </option>
    )}

   </select>

  </label>

  <label>
   Date
   <input
    type="date"
    value={d}
    onChange={e=>setD(e.target.value)}
   />
  </label>

  <label>
   Time
   <input
    type="time"
    value={t}
    onChange={e=>setT(e.target.value)}
   />
  </label>

  <label>
   Message

   <textarea
    value={m}
    onChange={e=>setM(e.target.value)}
   />

  </label>

  <button
   className="pink full"
   disabled={!pid||!d}
   onClick={()=>
    onSave({
     id:uid(),
     profileId:pid,
     titleId:title.id,
     date:d,
     time:t,
     message:m
    })
   }
  >
   Schedule
  </button>

 </Modal>
}

/* --------------------------------------------------
   HERO
-------------------------------------------------- */

function HeroModal({
 hero,
 library,
 onClose,
 onSave
}:{
 hero:Title;
 library:Title[];
 onClose:()=>void;
 onSave:(t:Title)=>void
}){

 const [id,setId]=useState(hero.id);

 return <Modal
  title="Edit Hero"
  onClose={onClose}
 >

  <p>
   <b>
    Recommended image size: 1600 × 600 px
   </b>
   <br/>
   Aspect ratio: approximately 8:3
   <br/>
   Format: JPG or PNG
   <br/>
   Recommended file size: under 2 MB
  </p>

  <label>
   Hero title

   <select
    value={id}
    onChange={e=>setId(e.target.value)}
   >

    {library.map(t=>
     <option
      key={t.id}
      value={t.id}
     >
      {t.name}
     </option>
    )}

   </select>

  </label>

  <p className="muted">
   For the final version, the hero can use an
   uploaded image or a secure media URL.
   It will crop responsively for desktop and mobile.
  </p>

  <button
   className="pink full"
   onClick={()=>
    onSave(
     library.find(x=>x.id===id)||hero
    )
   }
  >
   Save Hero
  </button>

 </Modal>
}

createRoot(
 document.getElementById('root')!
).render(<App/>);
