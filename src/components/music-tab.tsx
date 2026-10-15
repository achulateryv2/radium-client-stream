import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, Check, ExternalLink, Heart, Home, Library, Menu, Music2, Play, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account";
import { track } from "@/lib/track";
import { parseSpotifyLink, spotifyPicks, spotifyUrl, type SpotifyItem } from "@/lib/spotify";

export function MusicTab() {
  const { user } = useAccount();
  const [view, setView] = useState<"home" | "search" | "liked">("home");
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState<SpotifyItem>(spotifyPicks[0] ?? { id: "", type: "playlist", title: "Spotify", subtitle: "" });
  const [recent, setRecent] = useState<SpotifyItem[]>([]);
  const [liked, setLiked] = useState<SpotifyItem[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [details, setDetails] = useState(true);
  const [error, setError] = useState("");
  const [playerReady, setPlayerReady] = useState(false);
  const [playerFailed, setPlayerFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const storageKey = `radium-spotify:${user?.id ?? "guest"}`;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as { liked?: SpotifyItem[]; recent?: SpotifyItem[] };
      const valid = (items: unknown): SpotifyItem[] => Array.isArray(items) ? items.filter((item) => item && typeof item.title === "string" && parseSpotifyLink(spotifyUrl(item))).slice(0, 30) : [];
      setLiked(valid(saved.liked)); setRecent(valid(saved.recent));
    } catch { /* Empty library when storage is unavailable. */ }
  }, [storageKey]);
  useEffect(() => {
    if (playerReady) return;
    const timeout = setTimeout(() => setPlayerFailed(true), 15000);
    return () => clearTimeout(timeout);
  }, [current.id, playerReady]);
  const persist = (nextLiked: SpotifyItem[], nextRecent: SpotifyItem[]) => {
    try { localStorage.setItem(storageKey, JSON.stringify({ liked: nextLiked, recent: nextRecent })); } catch { /* Browsing still works without storage. */ }
  };
  const pick = (item: SpotifyItem) => {
    if (item.id !== current.id) { setPlayerReady(false); setPlayerFailed(false); }
    setCurrent(item); setError("");
    const next = [item, ...recent.filter((old) => old.id !== item.id)].slice(0, 30);
    setRecent(next); persist(liked, next);
    track("music", item.title, { source: "spotify", url: spotifyUrl(item), spotifyId: item.id });
  };
  const toggleLike = (item: SpotifyItem) => {
    const active = liked.some((old) => old.id === item.id);
    const next = active ? liked.filter((old) => old.id !== item.id) : [item, ...liked];
    setLiked(next); persist(next, recent);
    track("music", item.title, { source: "spotify", preference: active ? "unlike" : "like", url: spotifyUrl(item) });
  };
  const search = () => { setView("search"); setTimeout(() => input.current?.focus(), 0); };
  const submit = () => {
    const value = query.trim(); if (!value) return;
    track("search", value, { source: "spotify" });
    const item = parseSpotifyLink(value);
    if (item) { pick(item); return; }
    if (/^https?:\/\//.test(value)) { setError("Paste a Spotify track, album, artist, podcast or playlist link."); return; }
    setView("search"); setError("");
  };
  const results = (view === "liked" ? liked : spotifyPicks).filter((item) => view !== "search" || `${item.title} ${item.subtitle}`.toLowerCase().includes(query.toLowerCase()));
  const isLiked = liked.some((item) => item.id === current.id);
  const art = (item: SpotifyItem, className = "") => item.artwork ? <img src={item.artwork} alt={item.title} className={className} loading="lazy" /> : <div className={`spotify-placeholder ${className}`}><Music2 size={32} /></div>;
  const card = (item: SpotifyItem) => <Button variant="ghost" className="spotify-card" key={item.id} onClick={() => pick(item)} aria-label={`Play ${item.title}`}>
    <div className="spotify-card-art">{art(item)}<span className="spotify-play"><Play fill="currentColor" size={22} /></span></div>
    <strong>{item.title}</strong><span>{item.subtitle}</span>
  </Button>;

  return <div className={`spotify-shell ${collapsed ? "is-collapsed" : ""} ${details ? "" : "hide-details"}`}>
    <aside className="spotify-sidebar">
      <div className="spotify-navigation">
        <div className="spotify-brand"><span className="spotify-mark" aria-hidden>≋</span>{!collapsed && <strong>Spotify</strong>}<Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} title={collapsed ? "Expand library" : "Collapse library"} aria-label={collapsed ? "Expand library" : "Collapse library"}><Menu /></Button></div>
        <Button variant="ghost" className={`spotify-nav ${view === "home" ? "active" : ""}`} onClick={() => { setView("home"); setQuery(""); }} title="Home"><Home />{!collapsed && "Home"}</Button>
        <Button variant="ghost" className={`spotify-nav ${view === "search" ? "active" : ""}`} onClick={search} title="Search"><Search />{!collapsed && "Search"}</Button>
      </div>
      <div className="spotify-library">
        <div className="spotify-library-heading"><Library />{!collapsed && <strong>Your Library</strong>}{!collapsed && <Button variant="ghost" size="icon" onClick={search} title="Add a Spotify link" aria-label="Add a Spotify link"><Plus /></Button>}</div>
        {!collapsed && <div className="spotify-chips"><Button variant="ghost" onClick={() => { setView("home"); setQuery(""); }}>Playlists</Button><Button variant="ghost" onClick={() => setView("liked")}>Liked</Button></div>}
        <Button variant="ghost" className="spotify-library-item" onClick={() => setView("liked")} title="Liked music"><span className="spotify-liked-art"><Heart fill="currentColor" /></span>{!collapsed && <span><strong>Liked music</strong><small>{liked.length} saved</small></span>}</Button>
        {[...liked, ...spotifyPicks.filter((item) => !liked.some((old) => old.id === item.id))].map((item) => <Button key={item.id} variant="ghost" className="spotify-library-item" onClick={() => pick(item)} title={item.title}>{art(item)}{!collapsed && <span><strong>{item.title}</strong><small>Playlist · Spotify</small></span>}</Button>)}
      </div>
    </aside>

    <main className="spotify-main">
      <header className="spotify-main-header"><div className="flex items-center gap-2"><Button variant="ghost" size="icon" title="Home" aria-label="Music home" onClick={() => { setView("home"); setQuery(""); }}><ArrowLeft /></Button><Button variant="ghost" size="icon" title="Search" aria-label="Music search" onClick={search}><ArrowRight /></Button></div><div className="flex items-center gap-2"><Button variant="ghost" size="icon" title="Now playing" aria-label="Toggle now playing" onClick={() => setDetails(!details)}><Music2 /></Button><span className="spotify-avatar" title={user?.username}>{user?.username.slice(0, 1).toUpperCase() ?? "R"}</span></div></header>
      <div className="spotify-main-content">
        <h1>{view === "home" ? "Made for your day" : view === "liked" ? "Liked music" : "Search"}</h1>
        <form className="spotify-search" onSubmit={(event) => { event.preventDefault(); submit(); }}><Search size={18} /><input ref={input} aria-label="Search Spotify or paste a link" placeholder="Search playlists or paste a Spotify link" value={query} onChange={(event) => { setQuery(event.target.value); setView("search"); }} /><Button variant="ghost" size="icon" type="submit" title="Open Spotify link" aria-label="Open Spotify link"><ArrowRight /></Button></form>
        {error && <p role="alert" className="spotify-error">{error}</p>}
        {view === "home" && <div className="spotify-shortcuts">{spotifyPicks.map((item) => <Button variant="ghost" key={item.id} onClick={() => pick(item)}>{art(item)}<strong>{item.title}</strong><Play size={16} /></Button>)}</div>}
        {view === "search" && query.trim() && !/^https?:/.test(query) && <a className="spotify-search-external" href={`https://open.spotify.com/search/${encodeURIComponent(query.trim())}`} target="_blank" rel="noopener noreferrer" onClick={() => track("search", query, { source: "spotify" })}>Search “{query}” on Spotify <ExternalLink size={15} /></a>}
        {view === "home" && recent.length > 0 && <section className="spotify-shelf"><h2>Recently played</h2><div className="spotify-cards">{recent.slice(0, 4).map(card)}</div></section>}
        <section className="spotify-shelf"><div className="spotify-shelf-heading"><h2>{view === "liked" ? "Your collection" : view === "search" ? "Playlists" : "Popular playlists"}</h2><span>{results.length} playlists</span></div><div className="spotify-cards">{results.map(card)}</div>{results.length === 0 && <p className="spotify-empty">{view === "liked" ? "Your saved music will appear here." : "No matching playlists."}</p>}</section>
        {view === "home" && <section className="spotify-shelf"><h2>Unwind & recharge</h2><div className="spotify-cards">{spotifyPicks.filter((item) => ["Chill Hits", "Indie Pop", "All Out 2010s"].includes(item.title)).map(card)}</div></section>}
      </div>
    </main>

    {details && <aside className="spotify-now"><div className="spotify-now-heading"><strong>Now playing</strong><Button variant="ghost" size="icon" aria-label="Close now playing" title="Close now playing" onClick={() => setDetails(false)}><X /></Button></div>{art(current, "spotify-now-art")}<div className="spotify-now-title"><div><h2>{current.title}</h2><p>{current.subtitle}</p></div><Button variant="ghost" size="icon" title={isLiked ? "Remove from liked music" : "Save music"} aria-label={isLiked ? "Remove from liked music" : "Save music"} onClick={() => toggleLike(current)} className={isLiked ? "spotify-saved" : ""}>{isLiked ? <Check /> : <Heart />}</Button></div><div className="spotify-about"><h3>On Spotify</h3><p>{current.type === "playlist" ? "Playlist" : current.type} · Spotify</p><a href={spotifyUrl(current)} target="_blank" rel="noopener noreferrer">Open in Spotify <ExternalLink size={14} /></a></div></aside>}

    <footer className="spotify-player"><div className="spotify-player-summary">{art(current)}<div><strong>{current.title}</strong><small>Spotify</small></div><Button variant="ghost" size="icon" aria-label={isLiked ? "Unsave current music" : "Save current music"} title={isLiked ? "Unsave" : "Save"} onClick={() => toggleLike(current)} className={isLiked ? "spotify-saved" : ""}><Heart fill={isLiked ? "currentColor" : "none"} /></Button></div><div className="spotify-embed-wrap">{!playerReady && <span className="spotify-player-status">{playerFailed ? "Spotify is taking longer than usual." : "Loading Spotify…"}</span>}<iframe key={current.id} title="Spotify player" src={`https://open.spotify.com/embed/${current.type}/${current.id}?utm_source=radium&theme=0`} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" onLoad={() => { setPlayerReady(true); setPlayerFailed(false); }} onError={() => setPlayerFailed(true)} /></div><a className="spotify-player-open" href={spotifyUrl(current)} title="Open in Spotify" target="_blank" rel="noopener noreferrer"><ExternalLink size={18} /><span>Spotify</span><ArrowDown size={12} /></a></footer>
  </div>;
}
