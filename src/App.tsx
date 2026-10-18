import { useEffect, useState } from 'react';
import { Eta } from './eta/Eta.tsx';
import { StationPlace } from './components/ui.tsx';
import { YourModelPanel } from './components/YourModelPanel.tsx';
import { DayPage } from './course/DayPage.tsx';
import { DAYS, dayOf, readiness, STATION_ORDER, STATION_PLACE } from './course/days.ts';
import { Home } from './course/Home.tsx';
import { CardsPage } from './course/cards.tsx';
import { ComparePage } from './course/Compare.tsx';
import { MapPage } from './course/map/MapPage.tsx';
import { Workbench } from './model/Workbench.tsx';
import { Studio } from './studio/Studio.tsx';
import { doneSet, useYourModel } from './state.ts';
import { stationById } from './stations/registry.ts';

/** #/day/2#r → route "day/2", anchor "r"; #/model?task=… keeps its query for the studio. */
function parse() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, anchor] = raw.split('#');
  return { route: path.split('?')[0] || 'start', anchor: anchor ?? null };
}

export function App() {
  const course = useYourModel();
  const { model, update, practice, updatePractice, track, setTrack, steps, setStep } = course;
  const [{ route, anchor }, setLoc] = useState(parse);
  const [done, setDone] = useState(doneSet);
  useEffect(() => {
    const onHash = () => setLoc(parse());
    const onDone = () => setDone(doneSet());
    window.addEventListener('hashchange', onHash);
    window.addEventListener('eta-done', onDone);
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('eta-done', onDone); };
  }, []);
  // land at the anchor, or at the top of a new page
  useEffect(() => {
    if (route === 'model') return;
    // scripted days load their R outputs first: retry until the anchor exists (up to ~2 s)
    let tries = 0, t: ReturnType<typeof setTimeout>;
    const go = () => {
      const el = anchor ? document.getElementById(anchor) : null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else if (anchor && tries++ < 20) t = setTimeout(go, 100);
      else window.scrollTo({ top: 0 });
    };
    t = setTimeout(go, 30);
    return () => clearTimeout(t);
  }, [route, anchor]);
  // remember where the learner was, so the studio can send them back
  useEffect(() => { if (route !== 'model' && route !== 'model-classic') sessionStorage.setItem('eta-lab.back', route); }, [route]);

  if (route === 'model') return (
    <Studio project={model} practice={practice} updateProject={update} updatePractice={updatePractice}
      track={track} setTrack={setTrack} steps={steps} back={sessionStorage.getItem('eta-lab.back') ?? 'start'} />
  );

  const station = stationById(route);
  const place = station ? STATION_PLACE[station.id] : undefined;
  const dayN = route.startsWith('day/') ? Number(route.slice(4)) : place?.day ?? null;
  const day = dayN !== null && !Number.isNaN(dayN) ? dayOf(dayN) : null;   // Day 0 is a day too
  const onBench = route === 'model-classic';
  const i = station ? STATION_ORDER.indexOf(station.id) : -1;
  const prev = i > 0 ? stationById(STATION_ORDER[i - 1]) : null, next = i >= 0 ? stationById(STATION_ORDER[i + 1] ?? '') : null;
  const label = (id: string) => STATION_PLACE[id]?.label ?? '';

  let body;
  if (station) {
    const Body = station.component;
    body = (
      <StationPlace.Provider value={place ? `Day ${place.day} · ${place.label}` : null}>
        <Body model={model} />
        <div className="next">
          {prev ? <a className="btn" href={`#/${prev.id}`}>← {label(prev.id)} · {prev.title}</a> : <span />}
          {place && <a className="btn" href={`#/day/${place.day}#${place.day >= 1 && place.day <= 5 ? 'deeper' : 'understand'}`}>Back to Day {place.day}</a>}
          {next && <a className="btn primary" href={`#/${next.id}`}>{label(next.id)} · {next.title} →</a>}
        </div>
      </StationPlace.Provider>
    );
  } else if (route.startsWith('day/') && day) {
    body = <DayPage day={day} project={model} practice={practice} steps={steps} setStep={setStep} updateProject={update} setTrack={setTrack} done={done} />;
  } else if (route === 'map') {
    body = <MapPage />;
  } else if (route === 'compare') {
    body = <ComparePage />;
  } else if (route === 'cards' || route.startsWith('cards/')) {
    body = <CardsPage day={route.startsWith('cards/') ? Number(route.slice(6)) : undefined} />;
  } else if (onBench) {
    body = <Workbench model={model} update={update} />;
  } else {
    body = <Home project={model} steps={steps} setTrack={setTrack} />;
  }

  return (
    <>
      <header className="top">
        <a className="brand" href="#/start"><Eta size={40} mood="neutral" />η Lab</a>
        <span className="tag">a sandbox for structural equation modeling</span>
      </header>
      <div className="shell">
        <aside className="side" aria-label="Course">
          <nav>
            <ul className="stations">
              <li><a href="#/start" className={route === 'start' ? 'on' : ''}><span className="num">η</span>Start</a></li>
              <li><a href="#/map" className={route === 'map' ? 'on' : ''}><span className="num">◎</span>The map of SEM</a></li>
              <li><a href="#/cards" className={route.startsWith('cards') ? 'on' : ''}><span className="num">≡</span>Reference cards</a></li>
            </ul>
            {[0, 1, 2].map(w => (
              <div key={w}>
                <p className="part">{w === 0 ? 'Before the course' : `Week ${w} · ${w === 1 ? 'CFA' : 'SEM'}`}</p>
                <ul className="stations">
                  {DAYS.filter(d => d.week === w).map(d => {
                    const open = d.n === dayN, st = readiness(d).state;
                    return (
                      <li key={d.n}>
                        <a href={`#/day/${d.n}`} className={`${open && !station ? 'on' : ''} ${st}`} aria-current={open && !station ? 'page' : undefined}>
                          <span className="num">{d.n}</span>{d.title}{st === 'planned' && <i className="soon" aria-label="planned" />}
                        </a>
                        {open && (
                          <ul className="day-stations">
                            {d.items.filter(it => it.move === 'understand').map((it, k) => (
                              <li key={it.title}>
                                {it.status === 'ready' && it.station
                                  ? <a href={`#/${it.station}`} className={station?.id === it.station ? 'on' : ''}><span className="sub-num">{label(it.station) || `${d.n}.${k + 1}`}</span>{it.title}{done.has(it.station) && <i className="done-dot" aria-label="played" />}</a>
                                  : it.status === 'ready'
                                    ? <a href={`#/day/${d.n}`} className={!station && route === `day/${d.n}` ? 'on' : ''}><span className="sub-num">{d.n}.{k + 1}</span>{it.title}</a>
                                    : <span title="coming"><span className="sub-num">{d.n}.{k + 1}</span>{it.title}</span>}
                              </li>
                            ))}
                            {d.n > 0 && <li><a href={`#/day/${d.n}#try`}><span className="sub-num">▸</span>Try it · your project · R</a></li>}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <YourModelPanel model={model} active={false} onOpen={() => setTrack('project')} />
        </aside>
        <main>
          <nav className="strip" aria-label="Course days">
            <a href="#/start" className={route === 'start' ? 'on' : ''}>Start</a>
            <a href="#/map" className={route === 'map' ? 'on' : ''}>Map</a>
            {DAYS.map(d => <a key={d.n} href={`#/day/${d.n}`} className={d.n === dayN ? 'on' : ''}>Day {d.n}</a>)}
            <a href="#/model" onClick={() => setTrack('project')}>η My project</a>
          </nav>
          {body}
        </main>
      </div>
      <footer className="foot">η Lab · data: European Social Survey (means and covariances only) · all estimates computed in your browser and checked against lavaan</footer>
    </>
  );
}
