import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './style-1.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey && !supabaseKey.includes('COLOQUE_AQUI')
  ? createClient(supabaseUrl, supabaseKey) : null;

const categories = ['Veículos','Imóveis','Emprego','Telemóveis','Computadores','Casa e Jardim','Moda','Serviços','Agricultura','Outros'];
const blankAd = { title:'', category:'Veículos', price:'', currency:'MZN', country:'Moçambique', city:'', phone:'', contact_email:'', description:'' };

function App() {
  const [session, setSession] = useState(null);
  const [ads, setAds] = useState([]);
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [category, setCategory] = useState('Todas');
  const [view, setView] = useState('home');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [form, setForm] = useState(blankAd);
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    if (!supabase) {
      setNotice('A ligação ao Supabase ainda precisa de ser configurada no alojamento.');
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, current) => setSession(current));
    loadAds();
    return () => subscription.unsubscribe();
  }, []);

  async function loadAds() {
    if (!supabase) return;
    const { data, error } = await supabase.from('ads').select('*').eq('status','active').order('created_at',{ ascending:false });
    if (error) setNotice(error.message);
    else setAds(data || []);
  }

  async function authenticate(mode) {
    if (!supabase) { setNotice('Supabase não está configurado.'); return; }
    setBusy(true);
    const result = mode === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) setNotice(result.error.message);
    else {
      setSession(result.data.session);
      setNotice(mode === 'signup' ? 'Registo enviado. Verifica o teu email, se for solicitado.' : 'Sessão iniciada.');
      setView('home');
    }
  }

  async function publish(event) {
    event.preventDefault();
    if (!supabase || !session) { setNotice('Inicia sessão antes de publicar.'); return; }
    if (photos.length > 15) { setNotice('O máximo permitido é 15 fotografias.'); return; }
    setBusy(true);
    const imageUrls = [];
    for (const file of photos) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${session.user.id}/${Date.now()}-${safeName}`;
      const upload = await supabase.storage.from('ads-images').upload(path, file);
      if (upload.error) { setBusy(false); setNotice(upload.error.message); return; }
      imageUrls.push(supabase.storage.from('ads-images').getPublicUrl(path).data.publicUrl);
    }
    const { error } = await supabase.from('ads').insert({
      ...form, price: form.price ? Number(form.price) : null,
      user_id: session.user.id, status: 'active', images: imageUrls
    });
    setBusy(false);
    if (error) setNotice(error.message);
    else {
      setNotice('Anúncio publicado.');
      setForm(blankAd); setPhotos([]); setView('home'); loadAds();
    }
  }

  const filtered = useMemo(() => ads.filter(ad =>
    (category === 'Todas' || ad.category === category) &&
    (!country || String(ad.country || '').toLowerCase().includes(country.toLowerCase())) &&
    (!query || `${ad.title} ${ad.description} ${ad.city || ''}`.toLowerCase().includes(query.toLowerCase()))
  ), [ads, category, country, query]);

  return <>
    <header>
      <a className="brand" onClick={() => setView('home')}>GLOBAL <b>ANÚNCIOS GL</b></a>
      <nav>
        <button onClick={() => setView('home')}>Início</button>
        <button onClick={() => setView('publish')}>Publicar anúncio</button>
        <button onClick={() => setView('account')}>{session ? 'A minha conta' : 'Entrar / Registar'}</button>
      </nav>
    </header>
    <main>
      <section className="hero">
        <p className="eyebrow">O mercado é global</p>
        <h1>Encontre. Anuncie. <span>Faça crescer.</span></h1>
        <p>Classificados e publicidade para pessoas e empresas, em todo o mundo.</p>
        <button className="primary" onClick={() => setView('publish')}>Publicar anúncio grátis</button>
      </section>

      {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice('')}>Fechar</button></div>}

      {view === 'account' && <section className="panel">
        <h2>A tua conta</h2>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="Palavra-passe" value={password} onChange={e => setPassword(e.target.value)} />
        <div className="actions">
          <button className="primary" disabled={busy} onClick={() => authenticate('signin')}>Entrar</button>
          <button disabled={busy} onClick={() => authenticate('signup')}>Criar conta</button>
          {session && <button onClick={async () => { await supabase.auth.signOut(); setSession(null); }}>Sair</button>}
        </div>
      </section>}

      {view === 'publish' && <section className="panel">
        <h2>Publicar anúncio</h2>
        {!session ? <><p>Entra ou cria uma conta para publicar.</p><button className="primary" onClick={() => setView('account')}>Entrar / Registar</button></> :
        <form onSubmit={publish}>
          <input required placeholder="Título do anúncio" value={form.title} onChange={e => setForm({...form,title:e.target.value})} />
          <div className="two">
            <select value={form.category} onChange={e => setForm({...form,category:e.target.value})}>{categories.map(c => <option key={c}>{c}</option>)}</select>
            <input type="number" placeholder="Preço" value={form.price} onChange={e => setForm({...form,price:e.target.value})} />
          </div>
          <div className="two">
            <input placeholder="País" value={form.country} onChange={e => setForm({...form,country:e.target.value})} />
            <input placeholder="Cidade" value={form.city} onChange={e => setForm({...form,city:e.target.value})} />
          </div>
          <div className="two">
            <input placeholder="Telefone / WhatsApp" value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} />
            <input type="email" placeholder="Email de contacto" value={form.contact_email} onChange={e => setForm({...form,contact_email:e.target.value})} />
          </div>
          <textarea required placeholder="Descrição" value={form.description} onChange={e => setForm({...form,description:e.target.value})} />
          <label>Fotografias (máximo 15)<input type="file" accept="image/*" multiple onChange={e => setPhotos(Array.from(e.target.files || []).slice(0,15))} /></label>
          <p>{photos.length} fotografia(s) selecionada(s)</p>
          <button className="primary" disabled={busy}>{busy ? 'A publicar...' : 'Publicar anúncio'}</button>
        </form>}
      </section>}

      {view === 'home' && <>
        <section className="search">
          <input placeholder="O que procura?" value={query} onChange={e => setQuery(e.target.value)} />
          <input placeholder="País" value={country} onChange={e => setCountry(e.target.value)} />
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option>Todas</option>{categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </section>
        <section>
          <div className="sectionhead"><div><p className="eyebrow">Explore oportunidades</p><h2>Categorias</h2></div></div>
          <div className="categories">{categories.map((c,i) => <button key={c} onClick={() => setCategory(c)}><span>{['🚗','🏠','💼','📱','💻','🪴','👕','🛠️','🌾','🛍️'][i]}</span>{c}</button>)}</div>
        </section>
        <section>
          <div className="sectionhead"><div><p className="eyebrow">Novas oportunidades</p><h2>Anúncios recentes</h2></div><small>{filtered.length} anúncio(s)</small></div>
          <div className="ads">{filtered.map(ad => <article className="ad" key={ad.id} onClick={() => setSelected(ad)}>
            <div className="adimage">{ad.images?.[0] ? <img src={ad.images[0]} alt="" /> : <span>GLOBAL GL</span>}</div>
            <div className="adbody"><small>{ad.category} · {ad.city || ad.country}</small><h3>{ad.title}</h3><strong>{ad.price ? `${ad.price} ${ad.currency || ''}` : 'Preço sob consulta'}</strong></div>
          </article>)}</div>
          {!filtered.length && <p className="empty">Ainda não há anúncios publicados. Sê o primeiro a anunciar!</p>}
        </section>
      </>}
    </main>
    <footer><b>GLOBAL ANÚNCIOS GL</b><span>Classificados e publicidade sem fronteiras.</span><small>Versão inicial · Pagamentos ainda não ativados</small></footer>
    {selected && <div className="overlay" onClick={() => setSelected(null)}><div className="modal" onClick={e => e.stopPropagation()}>
      <button className="close" onClick={() => setSelected(null)}>Fechar</button>
      {selected.images?.map((src,i) => <img key={i} className="detailimg" src={src} alt="" />)}
      <p className="eyebrow">{selected.category} · {selected.country}</p><h2>{selected.title}</h2>
      <h3>{selected.price ? `${selected.price} ${selected.currency || ''}` : 'Preço sob consulta'}</h3>
      <p>{selected.description}</p><p>{selected.city} · {selected.phone}</p>
    </div></div>}
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
