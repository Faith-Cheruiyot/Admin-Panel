'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpRight, ArrowRight, ArrowLeft, LayoutDashboard, Image as ImageIcon, Users, ThumbsUp, ThumbsDown, ShieldCheck, Search, Plus, ChevronDown, ChevronRight, Sparkles, LogOut, X, Pencil, Trash2, RefreshCw, Upload, MessageSquare, MoreHorizontal, Check, LockKeyhole, Menu, Activity } from 'lucide-react';

type Item = { id:string; kind:'caption'|'photo'; caption:string; prompt:string; model:string; created_at:string; created_by:string; author:string; upvotes:number; downvotes:number; image_path?:string; imageUrl?:string; width?:number; height?:number; [key:string]:any };
type Props = { view:string; initial:any; account:{name:string;email:string} };
const names:Record<string,string> = { overview:'Overview',media:'AI media',profiles:'Users & profiles',ratings:'Votes & ratings',access:'Access & security' };
const nav = [{id:'overview',icon:LayoutDashboard},{id:'media',icon:ImageIcon},{id:'profiles',icon:Users},{id:'ratings',icon:ThumbsUp}];
const format=(n:number)=>new Intl.NumberFormat('en-US').format(n || 0);
const date=(value:string)=>new Date(value.length===10?`${value}T12:00:00Z`:value).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/New_York'});
const initials=(value:string)=>value.split(' ').filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase()||'?';

async function api(url:string,options?:RequestInit) {
  const response=await fetch(url,{...options,cache:'no-store'});
  const data:any=await response.json();
  if(response.status===401) { window.location.href='/login'; throw new Error('Your session has expired.'); }
  if(response.status===403) { window.location.href='/login?error=access'; throw new Error('Superadmin access is required.'); }
  if(!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function useRecords(view:string,search:string,filter:string,page:number,version:number) {
  const [result,setResult]=useState<{items:any[];total:number}>({items:[],total:0});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!['media','profiles','ratings'].includes(view)) return;
    const controller=new AbortController();
    setLoading(true);setError('');
    const timer=setTimeout(()=>{
      api(`/api/admin/${view}?${new URLSearchParams({search,filter,page:String(page)})}`,{signal:controller.signal})
        .then(setResult).catch(e=>{if(e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    },250);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[view,search,filter,page,version]);
  return { ...result,loading,error };
}

export default function AdminApp({view,initial,account}:Props) {
  const router=useRouter();
  const query=useSearchParams();
  const querySearch=query.get('search')||'';
  const [dashboard,setDashboard]=useState(initial);
  const [days,setDays]=useState(30);
  const [chartMode,setChartMode]=useState('media');
  const [search,setSearch]=useState(query.get('search')||'');
  const [filter,setFilter]=useState('all');
  const [page,setPage]=useState(1);
  const [version,setVersion]=useState(0);
  const [refreshing,setRefreshing]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const [editor,setEditor]=useState<Item|'new'|null>(null);
  const [detail,setDetail]=useState<any>(null);
  const [deleting,setDeleting]=useState<Item|null>(null);
  const [busy,setBusy]=useState(false);
  const [mobileNav,setMobileNav]=useState(false);
  const records=useRecords(view,search,filter,page,version);
  useEffect(()=>{setSearch(querySearch);setFilter('all');setPage(1);setDetail(null);setMobileNav(false);},[view,querySearch]);
  useEffect(()=>{if(notice){const timer=setTimeout(()=>setNotice(''),7000);return ()=>clearTimeout(timer);}},[notice]);
  async function refresh(nextDays=days) {
    setRefreshing(true);setError('');
    try {setDashboard(await api(`/api/admin/dashboard?days=${nextDays}`));setVersion(v=>v+1);}
    catch(e){setError((e as Error).message);} finally {setRefreshing(false);}
  }
  async function saved() {setEditor(null);setNotice('Media saved. The Humor Project is up to date.');await refresh();}
  async function remove() {
    if(!deleting)return;
    setBusy(true);setError('');
    try {const result=await api(`/api/admin/media/${deleting.id}?kind=${deleting.kind}`,{method:'DELETE'});setDeleting(null);setDetail(null);setNotice(result.warning||'Media and its associated votes have been deleted.');await refresh();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  function globalSearch(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value=String(new FormData(event.currentTarget).get('q')||'').trim();
    router.push(`/admin/media?search=${encodeURIComponent(value)}`);
  }
  const total=dashboard.totals;
  const approval=total.votes ? Math.round(total.upvotes/total.votes*100):0;

  return <div className="app-shell">
    {mobileNav&&<button className="sidebar-backdrop" aria-label="Close navigation" onClick={()=>setMobileNav(false)}/>}
    <aside className={`sidebar ${mobileNav?'is-open':''}`}>
      <Link href="/admin" className="brand"><span className="brand-mark">h<span>.</span></span><span>humor<span className="brand-hq">HQ</span></span></Link>
      <div className="workspace"><span className="workspace-icon"><Sparkles size={17}/></span><div><strong>The Humor Project</strong><span>Admin workspace</span></div><span className="live-dot"/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation">{nav.map(({id,icon:Icon})=><Link key={id} className={`nav-link ${view===id?'active':''}`} href={id==='overview'?'/admin':`/admin/${id}`}><Icon size={19}/><span>{names[id]}</span>{id==='media'&&<span className="nav-count">{total.media}</span>}{view===id&&<span className="nav-active-dot"/>}</Link>)}</nav>
      <div className="nav-label management-label">MANAGEMENT</div>
      <Link className={`nav-link ${view==='access'?'active':''}`} href="/admin/access"><ShieldCheck size={19}/><span>Access & security</span></Link>
      <div className="sidebar-bottom"><div className="private-note"><LockKeyhole size={16}/><div><strong>A private little corner.</strong><p>Google verified.<br/>Superadmins only.</p></div></div><div className="account"><span className="avatar">{initials(account.name)}</span><div><strong>{account.name}</strong><span>Superadmin <span className="tiny-dot"/></span></div><form action="/auth/logout" method="post"><button className="icon-button" title="Sign out" aria-label="Sign out"><LogOut size={17}/></button></form></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={()=>setMobileNav(true)}><Menu size={20}/></button><span>Workspace</span><ChevronRight size={14}/><strong>{names[view]}</strong></div><div className="topbar-right"><form className="global-search" onSubmit={globalSearch}><Search size={16}/><input name="q" aria-label="Search media" placeholder="Search anything…" maxLength={200}/><kbd>↵</kbd></form><span className="protected"><ShieldCheck size={14}/> Protected workspace</span></div></header>
      <main className="main-content">
        <div className="page-heading"><div><div className="eyebrow">THE HUMOR PROJECT <span>/</span> CONTROL ROOM</div><h1>{view==='overview'?'Let’s see what’s funny.':names[view]}{view==='overview'&&<span className="heading-spark">✳</span>}</h1><p>{({overview:'A pulse on the punchlines, the people, and everything in between.',media:'One home for every AI caption and photo meme.',profiles:'Meet the people bringing a little more laughter.',ratings:'Every thumbs up, every thumbs down. The audience has spoken.',access:'A secure workspace starts with the right people.'} as any)[view]}</p></div><div className="heading-actions"><button className={`icon-button refresh-button ${refreshing?'spinning':''}`} onClick={()=>refresh()} disabled={refreshing} aria-label="Refresh data"><RefreshCw size={17}/></button>{view==='overview'&&<label className="period-select"><span className="sr-only">Date range</span><select value={days} onChange={e=>{const d=Number(e.target.value);setDays(d);refresh(d);}}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select><ChevronDown size={14}/></label>}<button className="button primary" onClick={()=>setEditor('new')}><Plus size={17}/>Add media</button></div></div>
        {(error||notice)&&<div role={error?'alert':'status'} className={`notice ${error?'error':''}`}>{error?<Activity size={17}/>:<Check size={17}/>}<span>{error||notice}</span><button aria-label="Dismiss" className="icon-button" onClick={()=>{setError('');setNotice('');}}><X size={15}/></button></div>}
        {view==='overview'&&<>
          <section className="welcome-banner"><div><div className="banner-label"><span className="live-dot"/> LIVE FROM YOUR DATABASE</div><h2>Serious insights.<br/><span>Unserious content.</span></h2><p>Your community has created <strong>{total.media} pieces of humor.</strong><br/>Let’s make the next one a good one.</p><Link href="/admin/media">Explore the media library <ArrowUpRight size={17}/></Link></div><div className="banner-art" aria-hidden="true"><span className="art-star star-one">✳</span><span className="art-star star-two">✧</span><div className="smiley big"><i/><i/><b/></div><div className="smiley small"><i/><i/><b/></div><span className="art-orbit"/><span className="art-dot"/><span className="art-squiggle">〰</span><span className="art-note">good things<br/>are growing.</span></div><span className="banner-index">01 — OVERVIEW</span></section>
          <section className="stat-grid" aria-label="All-time statistics"><Stat label="Total users" value={format(total.users)} icon={<Users size={18}/>} sub={`${dashboard.period.users} joined in this period`} tone="mint"/><Stat label="AI creations" value={format(total.media)} icon={<Sparkles size={18}/>} sub={`${dashboard.period.media} created in this period`} tone="lilac"/><Stat label="Audience approval" value={total.votes?`${approval}%`:'—'} icon={<ThumbsUp size={18}/>} sub={total.votes?`${total.upvotes} of ${total.votes} votes are positive`:'Waiting for the first vote'} tone="peach"/><Stat label="Total votes" value={format(total.votes)} icon={<MessageSquare size={18}/>} sub={`${total.creators} creators making people smile`} tone="yellow"/></section>
          <div className="analytics-row"><section className="panel chart-panel"><div className="panel-heading"><div><h3>The laughter curve <span className="subtle-dot"/></h3><p>A little creativity, day by day.</p></div><div className="segmented"><button className={chartMode==='media'?'selected':''} onClick={()=>setChartMode('media')}>Creations</button><button className={chartMode==='votes'?'selected':''} onClick={()=>setChartMode('votes')}>Votes</button></div></div><div className="chart-summary"><strong>{format(chartMode==='media'?dashboard.period.media:dashboard.period.votes)}</strong><span>{chartMode==='media'?'new creations':'audience votes'}<br/>in the last {days} days</span><div className="chart-legend"><i/>{chartMode==='media'?'AI media':'Votes'}</div></div><ActivityChart timeline={dashboard.timeline} mode={chartMode}/></section>
          <section className="panel vibe-panel"><div className="panel-heading"><div><h3>The vibe check</h3><p>How the humor is landing. All time.</p></div><ThumbsUp size={18} className="muted-icon"/></div><div className="approval-ring" style={{'--approval':`${approval}%`} as React.CSSProperties}><div><span>{total.votes?`${approval}%`:'—'}</span><small>approval rate</small><span className="ring-face">{approval>=50?'☺':'☻'}</span></div></div><div className="vote-breakdown"><span><i className="positive-dot"/>Upvotes<strong>{total.upvotes}</strong></span><span><i className="negative-dot"/>Downvotes<strong>{total.downvotes}</strong></span></div><Link className="panel-bottom-link" href="/admin/ratings">See what people think <ArrowRight size={16}/></Link></section></div>
          <div className="lower-row"><section className="panel leaderboard"><div className="panel-heading"><div><h3>The crowd favorites <span>✦</span></h3><p>Ranked by net votes. The good stuff rises.</p></div><Link className="text-link" href="/admin/media">View all <ArrowUpRight size={14}/></Link></div><div className="leaderboard-label"><span>CREATION</span><span>VOTES</span><span>NET SCORE</span></div>{dashboard.leaderboard.map((item:Item,index:number)=><button className="leaderboard-row" key={item.id} onClick={()=>setDetail(item)}><span className="rank">{String(index+1).padStart(2,'0')}</span><MediaThumb item={item}/><div className="leaderboard-title"><strong>{item.caption}</strong><span>{item.author} <i>·</i> {item.kind==='photo'?'Photo meme':'AI caption'}</span></div><span className="compact-votes"><ThumbsUp size={12}/>{item.upvotes}<ThumbsDown size={12}/>{item.downvotes}</span><span className="score">{item.upvotes-item.downvotes>0?'+':''}{item.upvotes-item.downvotes}</span><ChevronRight size={14}/></button>)}{!dashboard.leaderboard.length&&<Empty text="Your first creation belongs here."/>}</section>
          <section className="insight-card"><div className="insight-eyebrow"><Sparkles size={15}/> A LITTLE PERSPECTIVE</div><span className="insight-asterisk">✳</span><h3>{dashboard.divisive?'Comedy is subjective.':'Room for a reaction.'}</h3><p>{dashboard.divisive?'This one is splitting the room. Equal parts laughter and raised eyebrows.':`${total.unrated} creations haven’t received a vote yet. Every great joke deserves an audience.`}</p>{dashboard.divisive&&<blockquote>“{dashboard.divisive.caption}”</blockquote>}<Link href={dashboard.divisive?'/admin/ratings':'/admin/media'}>{dashboard.divisive?'Explore the reactions':'Find the hidden gems'} <ArrowUpRight size={17}/></Link><div className="insight-footer">HUMOR IS HUMAN. EVEN WHEN IT’S AI.</div></section></div>
          <section className="panel recent-panel"><div className="panel-heading"><div><h3>Fresh off the prompt</h3><p>The latest additions to the humor universe.</p></div><Link className="text-link" href="/admin/media">Media library <ArrowUpRight size={14}/></Link></div><div className="recent-list">{dashboard.recent.map((item:Item)=><div className="recent-item" key={item.id}><span className={`activity-icon ${item.kind==='photo'?'lilac':'mint'}`}>{item.kind==='photo'?<ImageIcon size={16}/>:<MessageSquare size={16}/>}</span><div><strong>{item.author} <span>added {item.kind==='photo'?'a photo meme':'an AI caption'}</span></strong><p>{item.caption}</p></div><time>{date(item.created_at)}</time></div>)}</div></section>
        </>}
        {['media','profiles','ratings'].includes(view)&&<>
          <div className="collection-summary"><span className="collection-number">{format(view==='media'?total.media:view==='profiles'?total.users:total.votes)}</span><div><strong>{view==='media'?'moments of AI creativity':view==='profiles'?'people in the community':'reactions and counting'}</strong><p>{view==='media'?'Captions, photo memes, and little sparks of genius.':view==='profiles'?'Profiles are available to read. Roles are managed securely in the database.':'Individual votes are read only. Approval is calculated from upvotes and downvotes.'}</p></div><span className="collection-doodle">{view==='profiles'?'☺':view==='media'?'✳':'✦'}</span></div>
          <section className="panel collection-panel"><div className="collection-toolbar"><div className="filter-tabs">{(view==='media'?[['all','All media'],['caption','AI captions'],['photo','Photo memes']]:view==='ratings'?[['all','All reactions'],['up','Upvotes'],['down','Downvotes']]:[['all','All profiles']]).map(([id,label])=><button key={id} className={filter===id?'active':''} onClick={()=>{setFilter(id);setPage(1);}}>{label}</button>)}</div><label className="list-search"><Search size={16}/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} maxLength={200} placeholder={view==='profiles'?'Search people…':view==='ratings'?'Search votes or captions…':'Search captions or models…'} aria-label={`Search ${names[view]}`}/>{search&&<button className="icon-button" onClick={()=>setSearch('')} aria-label="Clear search"><X size={14}/></button>}</label></div>
          {records.loading?<div className="loading-state"><RefreshCw className="spin" size={20}/><span>Gathering the good stuff…</span></div>:records.error?<div className="empty-state" role="alert"><p>{records.error}</p><button className="button" onClick={()=>setVersion(v=>v+1)}>Try again</button></div>:!records.items.length?<Empty text={search?'No results. Try another search.':'Nothing here just yet.'}/>:view==='media'?<div className="media-grid">{records.items.map((item:Item)=><article className="media-card" key={item.id}><button className={`media-preview ${item.kind}`} onClick={()=>setDetail(item)}>{item.imageUrl?<img src={item.imageUrl} alt={item.caption}/>:<><span className="quote-mark">“</span><p>{item.caption}</p><span className="caption-flower">✳</span></>}<span className="type-badge">{item.kind==='photo'?<ImageIcon size={11}/>:<Sparkles size={11}/>} {item.kind==='photo'?'Photo meme':'AI caption'}</span></button><div className="media-card-content"><div className="media-author"><span className="mini-avatar">{initials(item.author)}</span><span>{item.author}</span><time>{date(item.created_at)}</time></div><h3>{item.caption}</h3><div className="media-model">{item.model}</div><div className="media-card-footer"><span><ThumbsUp size={13}/>{item.upvotes}<ThumbsDown size={13}/>{item.downvotes}</span><div><button className="icon-button" aria-label={`Edit ${item.caption}`} onClick={()=>setEditor(item)}><Pencil size={15}/></button><button className="icon-button danger-icon" aria-label={`Delete ${item.caption}`} onClick={()=>{setError('');setDeleting(item);}}><Trash2 size={15}/></button></div></div></div></article>)}</div>:<div className="table-scroll"><table><thead><tr>{(view==='profiles'?['NAME','USER ID','JOINED','ROLE','']:['REACTION','CREATION','VOTER','DATE','']).map((label,i)=><th key={i}>{label}</th>)}</tr></thead><tbody>{records.items.map((item:any)=>view==='profiles'?<tr key={item.id}><td><button className="person-cell" onClick={()=>setDetail({...item,profile:true})}><span className="avatar">{initials([item.first_name,item.last_name].join(' '))}</span><strong>{[item.first_name,item.last_name].filter(Boolean).join(' ')||'Unnamed member'}</strong></button></td><td><span className="mono muted">{item.user_id?.slice(0,8)||'Unlinked'}…</span></td><td>{date(item.created_at)}</td><td><span className={`role-badge ${item.is_superadmin?'admin':''}`}>{item.is_superadmin?<ShieldCheck size={12}/>:<Users size={12}/>} {item.is_superadmin?'Superadmin':'Member'}</span></td><td><button className="icon-button" aria-label="View profile" onClick={()=>setDetail({...item,profile:true})}><ArrowUpRight size={16}/></button></td></tr>:<tr key={item.id}><td><span className={`reaction ${item.value===1?'up':'down'}`}>{item.value===1?<ThumbsUp size={14}/>:<ThumbsDown size={14}/>} {item.value===1?'Upvote':'Downvote'}</span></td><td className="vote-caption"><strong>{item.caption}</strong><span>{item.kind==='photo'?'Photo meme':'AI caption'}</span></td><td><div className="voter"><span className="mini-avatar">{initials(item.voter)}</span>{item.voter}</div></td><td>{date(item.created_at)}</td><td><button className="icon-button" aria-label="View reaction" onClick={()=>setDetail({...item,vote:true})}><ArrowUpRight size={16}/></button></td></tr>)}</tbody></table></div>}
          {!records.loading&&!records.error&&<div className="pagination"><span>{records.total?`${(page-1)*(view==='media'?12:20)+1}–${Math.min(page*(view==='media'?12:20),records.total)}`:'0'} of {records.total} {view==='media'?'creations':view==='profiles'?'profiles':'reactions'}</span><div><button className="button small-button" disabled={page===1} onClick={()=>setPage(p=>p-1)}><ArrowLeft size={13}/>Previous</button><span>Page {page}</span><button className="button small-button" disabled={page*(view==='media'?12:20)>=records.total} onClick={()=>setPage(p=>p+1)}>Next<ArrowRight size={13}/></button></div></div>}</section>
        </>}
        {view==='access'&&<section className="access-layout"><div className="panel access-panel"><span className="access-shield"><ShieldCheck size={32}/></span><span className="status-pill"><span className="live-dot"/>Access verified</span><h2>Good humor.<br/>Strong boundaries.</h2><p>Every admin page and data request requires a verified Google session and an active superadmin role in the Humor Project database.</p><div className="security-list">{['Google OAuth sign-in with PKCE','Live profiles.is_superadmin check','Database row-level security','No public role assignment','Read-only profiles and individual votes'].map(item=><div key={item}><Check size={16}/>{item}</div>)}</div></div><div className="panel account-panel"><h3>Your access</h3><dl><dt>Signed in as</dt><dd>{account.name}</dd><dt>Google account</dt><dd>{account.email}</dd><dt>Role</dt><dd><span className="role-badge admin"><ShieldCheck size={13}/>Superadmin</span></dd><dt>Database</dt><dd>Humor Project</dd></dl><div className="access-help"><LockKeyhole size={20}/><h4>How the first admin gets in</h4><p>A trusted database administrator assigns the first role directly in Supabase. The application cannot grant this role, so a new user can never promote themselves.</p></div><form action="/auth/logout" method="post"><button className="button"><LogOut size={16}/>Sign out of this workspace</button></form></div></section>}
        <footer className="page-footer"><span><span className="live-dot"/> Connected to Humor Project</span><span>A little more insight. A little more laughter. <span>✳</span></span></footer>
      </main>
    </div>
    {editor&&<MediaEditor item={editor} close={()=>setEditor(null)} saved={saved}/>}
    {deleting&&<Modal title="Retire this punchline?" close={()=>{if(!busy)setDeleting(null);}}><div className="delete-icon"><Trash2 size={24}/></div><p className="modal-description">This will permanently delete this {deleting.kind==='photo'?'photo meme and its stored image':'caption'}, along with its votes, from the Humor Project.</p><blockquote className="delete-quote">{deleting.caption}</blockquote>{error&&<p className="field-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button" disabled={busy} onClick={()=>setDeleting(null)}>Keep it</button><button className="button danger" disabled={busy} onClick={remove}>{busy?'Deleting…':'Delete permanently'}</button></div></Modal>}
    {detail&&<Modal title={detail.profile?'Profile details':detail.vote?'Reaction details':'A closer look'} close={()=>setDetail(null)}>{detail.profile?<><div className="profile-detail"><span className="avatar large-avatar">{initials([detail.first_name,detail.last_name].join(' '))}</span><h3>{[detail.first_name,detail.last_name].filter(Boolean).join(' ')||'Unnamed member'}</h3><span className={`role-badge ${detail.is_superadmin?'admin':''}`}>{detail.is_superadmin?'Superadmin':'Member'}</span></div><dl className="detail-list"><dt>Profile ID</dt><dd>{detail.id}</dd><dt>User ID</dt><dd>{detail.user_id||'Unlinked profile'}</dd><dt>Joined</dt><dd>{date(detail.created_at)}</dd></dl><p className="read-only-note"><LockKeyhole size={13}/> Profiles are read only in this workspace.</p></>:detail.vote?<><span className={`reaction ${detail.value===1?'up':'down'}`}>{detail.value===1?<ThumbsUp size={16}/>:<ThumbsDown size={16}/>} {detail.value===1?'Upvote':'Downvote'}</span><blockquote className="detail-caption">{detail.caption}</blockquote><dl className="detail-list"><dt>Voter</dt><dd>{detail.voter}</dd><dt>Cast on</dt><dd>{date(detail.created_at)}</dd><dt>Vote ID</dt><dd>{detail.id}</dd><dt>Creation ID</dt><dd>{detail.generation_id}</dd></dl><p className="read-only-note"><LockKeyhole size={13}/> Individual votes cannot be changed here.</p></>:<>{detail.imageUrl&&<img className="detail-image" src={detail.imageUrl} alt={detail.caption}/>}<blockquote className="detail-caption">“{detail.caption}”</blockquote><dl className="detail-list"><dt>Creator</dt><dd>{detail.author}</dd><dt>Created</dt><dd>{date(detail.created_at)}</dd><dt>AI model</dt><dd>{detail.model}</dd><dt>Audience</dt><dd>{detail.upvotes} upvotes · {detail.downvotes} downvotes</dd>{detail.prompt&&<><dt>{detail.kind==='photo'?'Context':'Prompt'}</dt><dd>{detail.prompt}</dd></>}</dl><div className="modal-actions"><button className="button" onClick={()=>{setDeleting(detail);setDetail(null);}}><Trash2 size={15}/>Delete</button><button className="button primary" onClick={()=>{setEditor({...detail,prompt:detail.prompt||detail.context||''});setDetail(null);}}><Pencil size={15}/>Edit media</button></div></>}</Modal>}
  </div>;
}

function Stat({label,value,icon,sub,tone}:{label:string;value:string;icon:ReactNode;sub:string;tone:string}) {return <article className="stat-card"><div><span>{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><strong>{value}</strong><p><span className="stat-trend">↗</span>{sub}</p></article>;}
function Empty({text}:{text:string}) {return <div className="empty-state"><span>✳</span><h3>{text}</h3><p>A little inspiration goes a long way.</p></div>;}
function MediaThumb({item}:{item:Item}) {return <span className={`media-thumb ${item.kind}`}>{item.imageUrl?<img src={item.imageUrl} alt=""/>:<MessageSquare size={19}/>}</span>;}

function ActivityChart({timeline,mode}:{timeline:any[];mode:string}) {
  const [hover,setHover]=useState<number|null>(null);
  const values=timeline.map(item=>mode==='media'?item.captions+item.photos:item.votes);
  const max=Math.max(...values,4);
  const width=720,height=170,pad=8;
  const points=values.map((v,i)=>({x:pad+i*(width-pad*2)/Math.max(values.length-1,1),y:height-10-(v/max)*(height-25)}));
  const line=points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ');
  const area=`${line} L${width-pad},${height} L${pad},${height} Z`;
  const id=useId().replaceAll(':','');
  return <div className="activity-chart"><div className="chart-y-labels"><span>{max}</span><span>{Math.round(max/2)}</span><span>0</span></div><div className="chart-canvas"><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Daily ${mode==='media'?'creations':'votes'}: ${values.join(', ')}`}><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9dba6b" stopOpacity=".38"/><stop offset="100%" stopColor="#b9ce95" stopOpacity=".03"/></linearGradient></defs>{[15,85,160].map(y=><line key={y} x1="0" x2={width} y1={y} y2={y} stroke="#e8eae4" strokeDasharray="3 5"/>)}<path d={area} fill={`url(#${id})`}/><path d={line} fill="none" stroke="#7e9e4e" strokeWidth="2.7" vectorEffect="non-scaling-stroke"/>{hover!==null&&<><line x1={points[hover].x} x2={points[hover].x} y1="0" y2={height} stroke="#8b9d70" strokeDasharray="3 3"/><circle cx={points[hover].x} cy={points[hover].y} r="5" fill="#7e9e4e" stroke="white" strokeWidth="3"/></>}</svg><div className="chart-hit-areas">{timeline.map((item,i)=><button key={item.day} aria-label={`${item.day}: ${values[i]} ${mode}`} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(i)} onBlur={()=>setHover(null)}/>)}</div>{hover!==null&&<div className="chart-tooltip" style={{left:`${Math.min(Math.max(hover/(timeline.length-1)*100,10),80)}%`}}>{date(timeline[hover].day)}<strong>{values[hover]} {mode==='media'?'creations':'votes'}</strong></div>}<div className="chart-x-labels">{[0,Math.floor((timeline.length-1)/4),Math.floor((timeline.length-1)/2),Math.floor((timeline.length-1)*3/4),timeline.length-1].map((i,j)=><span key={j}>{new Date(`${timeline[i].day}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/New_York'})}</span>)}</div></div></div>;
}

function Modal({title,children,close}:{title:string;children:ReactNode;close:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  const id=useId();
  useEffect(()=>{const dialog=ref.current;dialog?.showModal();return ()=>dialog?.close();},[]);
  return <dialog className="modal" ref={ref} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===ref.current)close();}} aria-labelledby={id}><div className="modal-heading"><div><span className="eyebrow">HUMOR HQ</span><h2 id={id}>{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={20}/></button></div>{children}</dialog>;
}

function MediaEditor({item,close,saved}:{item:Item|'new';close:()=>void;saved:()=>Promise<void>}) {
  const isNew=item==='new';
  const [kind,setKind]=useState(isNew?'caption':item.kind);
  const [caption,setCaption]=useState(isNew?'':item.caption);
  const [prompt,setPrompt]=useState(isNew?'':item.prompt||item.context||'');
  const [model,setModel]=useState(isNew?'gemini-3.5-flash-lite':item.model);
  const [file,setFile]=useState<File|null>(null);
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  async function submit(event:FormEvent) {
    event.preventDefault();setSaving(true);setError('');
    try {
      const input:any={kind,caption,prompt,model};
      if(isNew&&kind==='photo') {
        if(!file)throw new Error('Choose a photo to upload.');
        if(file.size>5*1024*1024)throw new Error('Images must be 5 MB or smaller.');
        const bitmap=await createImageBitmap(file);
        input.width=bitmap.width;input.height=bitmap.height;bitmap.close();
        if(input.width<128||input.height<128||input.width*input.height>25000000)throw new Error('Images must be at least 128 × 128 pixels and no more than 25 megapixels.');
        const form=new FormData();form.set('file',file);
        const upload=await api('/api/admin/upload',{method:'POST',body:form});input.image_path=upload.path;
      }
      await api(isNew?'/api/admin/media':`/api/admin/media/${item.id}`,{method:isNew?'POST':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
      await saved();
    } catch(e){setError((e as Error).message);}finally{setSaving(false);}
  }
  return <Modal title={isNew?'Make room for a new creation.':'Fine-tune the funny.'} close={()=>{if(!saving)close();}}><p className="modal-description">{isNew?'Add existing AI-generated content to the Humor Project.':'Update the caption, context, or model for this creation.'}</p><form onSubmit={submit} className="editor-form">{isNew&&<fieldset className="kind-picker"><legend>Media type</legend><button type="button" className={kind==='caption'?'selected':''} onClick={()=>setKind('caption')}><MessageSquare size={19}/><span>AI caption</span>{kind==='caption'&&<Check size={15}/>}</button><button type="button" className={kind==='photo'?'selected':''} onClick={()=>setKind('photo')}><ImageIcon size={19}/><span>Photo meme</span>{kind==='photo'&&<Check size={15}/>}</button></fieldset>}{isNew&&kind==='photo'&&<label className="upload-field"><Upload size={24}/><strong>{file?file.name:'Choose your image'}</strong><span>JPEG, PNG or WebP · up to 5 MB · 128px minimum</span><input type="file" accept="image/jpeg,image/png,image/webp" required onChange={e=>setFile(e.target.files?.[0]||null)}/></label>}<label>Caption <span className="required">*</span><textarea value={caption} onChange={e=>setCaption(e.target.value)} maxLength={kind==='photo'?180:300} required rows={3} placeholder="Every great image has a punchline…"/><small>{caption.length}/{kind==='photo'?180:300} characters</small></label><label>{kind==='photo'?'Context':'Original prompt'} {kind==='caption'&&<span className="required">*</span>}<textarea value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={500} minLength={kind==='caption'?5:undefined} required={kind==='caption'} rows={2} placeholder={kind==='photo'?'A little background (optional)':'The prompt that inspired this caption'}/></label><label>AI model <span className="required">*</span><input value={model} onChange={e=>setModel(e.target.value)} required maxLength={120}/></label>{error&&<p role="alert" className="field-error">{error}</p>}<div className="modal-actions"><button type="button" className="button" disabled={saving} onClick={close}>Cancel</button><button className="button primary" disabled={saving}>{saving?<RefreshCw className="spin" size={16}/>:<Check size={16}/>} {saving?'Saving…':isNew?'Add to library':'Save changes'}</button></div></form></Modal>;
}
