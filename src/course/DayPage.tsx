// One day as a playlist: understand → try → your project → in R → check → read.
// Built items link into stations and the studio; planned items show what is coming.
import type { ReactNode } from 'react';
import { Eta } from '../eta/Eta.tsx';
import { analyse } from '../model/diagram.ts';
import type { ProjectSteps, Track, YourModel } from '../state.ts';
import { TEMPLATES } from '../studio/templates.ts';
import { taskById } from '../studio/tasks.ts';
import { DAYS, readiness, STATION_PLACE, type Day, type Item } from './days.ts';
import { CheckDay2, ProjectDay2 } from './day2.tsx';
import { CheckDay3, ProjectDay3 } from './day3.tsx';
import { CheckDay4, ProjectDay4 } from './day4.tsx';
import { CheckDay5, ProjectDay5 } from './day5.tsx';
import { CheckDay1 } from './day1/check.tsx';
import { AiCheck } from './day1/aiCheck.tsx';
import { ProjectDay1 } from './day1/project.tsx';
import { Day1Script } from './day1/Day1Script.tsx';
import { Day2Script } from './day2/Day2Script.tsx';
import { Day3Script } from './day3/Day3Script.tsx';
import { Day4Script } from './day4/Day4Script.tsx';
import { Day5Script } from './day5/Day5Script.tsx';
import { Day0Script } from './day0/Day0Script.tsx';
import { cardsFor, RefCard } from './cards.tsx';
import { ShareDecision } from './Compare.tsx';

const MOVES: { id: string; move: Item['move']; title: string; shape: string; what: string }[] = [
  { id: 'understand', move: 'understand', title: 'Understand', shape: 'e', what: 'Stations: a question, a sandbox, η’s explanation' },
  { id: 'try', move: 'try', title: 'Try it', shape: 'r', what: 'The example model in the studio, with a task' },
  { id: 'project', move: 'project', title: 'Your project', shape: 'y', what: 'One step in your own model' },
  { id: 'r', move: 'r', title: 'In R', shape: 'f', what: 'The same model in lavaan' },
];

export function DayRail({ current }: { current?: number }) {
  return (
    <ol className="day-rail" aria-label="Days">
      {DAYS.map(d => {
        const st = readiness(d).state;
        return <li key={d.n} className={d.n === 1 || d.n === 6 ? 'gap' : ''}>{d.n === 1 && <small>measurement</small>}{d.n === 6 && <small>structure</small>}<a href={`#/day/${d.n}`} className={`${d.n === current ? 'on' : ''} ${st}`} aria-current={d.n === current ? 'page' : undefined} title={`Day ${d.n} · ${d.title}`}>{d.n}</a></li>;
      })}
      <li className="gap dr-map"><a href="#/map#course" title="Where the days sit on the map of SEM">◎ on the map</a></li>
    </ol>
  );
}

function Status({ item }: { item: Item }) {
  return item.status === 'ready' ? null : <span className="badge planned">coming</span>;
}

function ItemCard({ item, label, children }: { item: Item; label?: string; children?: ReactNode }) {
  const href = item.status === 'ready' && item.station ? `#/${item.station}` : undefined;
  const body = (
    <>
      <span className="ic-top">{label && <b className="ic-num">{label}</b>}{item.mini && <span className="badge">mini</span>}<Status item={item} /></span>
      <span className="ic-title">{item.title}</span>
      <span className="ic-blurb">{item.blurb}</span>
      {children}
    </>
  );
  return href ? <a className="card item-card" href={href}>{body}</a> : <div className={`card item-card ${item.status}`}>{body}</div>;
}

export function DayPage({ day, project, practice, steps, setStep, updateProject, setTrack, done }: {
  day: Day; project: YourModel; practice: YourModel; steps: ProjectSteps;
  setStep: (id: string, a: Record<string, string>) => void; updateProject: (p: Partial<YourModel>) => void;
  setTrack: (t: Track) => void; done: Set<string>;
}) {
  const r = readiness(day);
  const understand = day.items.filter(i => i.move === 'understand');
  const tries = day.items.filter(i => i.move === 'try');
  const rItem = day.items.find(i => i.move === 'r');
  const check = day.items.find(i => i.move === 'check');
  const cards = cardsFor(day.n);
  const prev = DAYS.find(d => d.n === day.n - 1), next = DAYS.find(d => d.n === day.n + 1);
  const stepId = `d${day.n}`;
  const step = steps[stepId] ?? {};
  const pa = analyse(project.diagram);
  let k = 0;

  if (day.n === 0) return (
    <article className="day">
      <header className="station-head day-head">
        <span className="kicker">Day 0 · before you start</span>
        <h1>{day.title}</h1>
        <p>{day.subtitle}</p>
        <DayRail current={0} />
      </header>
      <Day0Script step={step} set={a => setStep(stepId, a)} project={project} updateProject={updateProject} />
      <section id="read" className="day-sec">
        <h2>Reading, if you like</h2>
        <p className="hint">{day.reading.additional.join('; ')}.</p>
      </section>
      <div className="next">
        <a className="btn" href="#/start">← Start</a>
        <a className="btn" href="#/map">The map of SEM: the big picture</a>
        <a className="btn primary" href="#/day/1">Day 1 · {DAYS[1].title} →</a>
      </div>
    </article>
  );

  return (
    <article className="day">
      <header className="station-head day-head">
        <span className="kicker">Part {day.week} · {day.week === 1 ? 'Confirmatory factor analysis' : 'Structural equation models'} · Day {day.n}</span>
        <h1>{day.title}</h1>
        <p>{day.subtitle}</p>
        <DayRail current={day.n} />
      </header>

      {r.state !== 'ready' && (
        <div className="card day-plan">
          <Eta size={54} mood="thinking" />
          <div>
            <p><b>This day is {r.state === 'planned' ? 'planned' : 'partly built'}.</b> {r.ready ? `${r.ready} of ${r.total} parts are ready — the rest is marked “coming”.` : 'Everything below is marked “coming”: it shows what the day will hold.'}</p>
            <p className="hint"><b>Theory:</b> {day.theory}</p>
            <p className="hint"><b>Practice:</b> {day.practice}</p>
          </div>
        </div>
      )}

      {day.n >= 1 && day.n <= 5 ? <>
        {day.n === 1 ? <Day1Script /> : day.n === 2 ? <Day2Script /> : day.n === 3 ? <Day3Script /> : day.n === 4 ? <Day4Script /> : <Day5Script />}
        {understand.some(i => i.station) && <section id="deeper" className="day-sec">
          <h2><span className="shape e" aria-hidden="true" />Go deeper</h2>
          <p className="hint" style={{ marginTop: 0 }}>Stations that take single ideas of the script further — with a question to guess and a sandbox.</p>
          <div className="item-grid">
            {understand.filter(i => i.station).map(i => <ItemCard key={i.title} item={i} label={i.station ? STATION_PLACE[i.station]?.label : undefined} />)}
          </div>
        </section>}
        <section id="try" className="day-sec">
          <h2><span className="shape r" aria-hidden="true" />Try it in the studio</h2>
          <div className="item-grid">{tries.map(i => {
            const tpl = i.template ? TEMPLATES.find(x => x.title === i.template) : undefined;
            const t = taskById(i.task);
            return (
              <ItemCard key={i.title} item={i}>
                <span className="row" style={{ marginTop: 10 }}>
                  {tpl && <a className="btn primary" href={`#/model?template=${encodeURIComponent(tpl.title)}`}>Open the example model →</a>}
                  {t && <a className="btn primary" href={`#/model?task=${t.id}`}>{done.has(t.id) ? '✓ Done — open again' : practice.task?.id === t.id ? 'Continue the task' : 'Start the task'} →</a>}
                </span>
                {t && <span className="row" style={{ marginTop: 10, alignItems: 'center' }}>
                  <ShareDecision practice={practice} task={t.id} />
                  <a href={`#/compare?task=${t.id}`}>Compare decisions →</a>
                </span>}
              </ItemCard>
            );
          })}</div>
        </section>
      </> : <>
      <nav className="moves" aria-label="This day">
        {MOVES.filter(m => m.move === 'project' || day.items.some(i => i.move === m.move)).map(m => (
          <a key={m.id} href={`#/day/${day.n}#${m.id}`} className="card move">
            <span className={`shape ${m.shape}`} aria-hidden="true" />
            <b>{m.title}</b><span>{m.what}</span>
          </a>
        ))}
      </nav>

      {understand.length > 0 && <section id="understand" className="day-sec">
        <h2><span className="shape e" aria-hidden="true" />Understand</h2>
        <div className="item-grid">
          {understand.map(i => { k++; return <ItemCard key={i.title} item={i} label={i.station ? STATION_PLACE[i.station]?.label ?? `${day.n}.${k}` : `${day.n}.${k}`} />; })}
        </div>
      </section>}

      <section id="try" className="day-sec">
        <h2><span className="shape r" aria-hidden="true" />Try it in the studio</h2>
        <div className="item-grid">
          {tries.map(i => {
            const t = taskById(i.task);
            const tpl = i.template ? TEMPLATES.find(x => x.title === i.template) : undefined;
            const inProgress = t && practice.task?.id === t.id;
            const finished = t && done.has(t.id);
            return (
              <ItemCard key={i.title} item={i}>
                <span className="row" style={{ marginTop: 10 }}>
                  {t && i.status === 'ready' && <a className="btn primary" href={`#/model?task=${t.id}`}>{finished ? '✓ Done — open again' : inProgress ? 'Continue the task' : 'Start the task'} →</a>}
                  {!t && i.title === 'Your report' && <a className="btn primary" href="#/model" onClick={() => setTrack('project')}>Open your project → lavaan tab → Report .qmd</a>}
                  {tpl && i.status === 'planned' && <a className="btn" href={`#/model?template=${encodeURIComponent(tpl.title)}`}>The example model is ready: open it →</a>}
                </span>
              </ItemCard>
            );
          })}
        </div>
      </section>

      </>}

      <section id="project" className="day-sec">
        <h2><span className="shape y" aria-hidden="true" />Your project · step {day.n}</h2>
        <div className="card project-step">
          <p className="ps-title"><b>{day.project.title}</b></p>
          <p className="hint" style={{ marginTop: 0 }}>{project.diagram.nodes.length
            ? <>Your project: {project.question ? <i>“{project.question}”</i> : 'no question written yet'} · {pa.s.latent.length} factor{pa.s.latent.length === 1 ? '' : 's'}, {pa.p} variables, df {pa.df}. </>
            : <>Your project is still empty. </>}{day.project.noData}</p>
          {day.n === 2
            ? <ProjectDay2 step={step} set={a => setStep(stepId, a)} project={project} updateProject={updateProject} />
            : day.n === 1 ? <ProjectDay1 step={step} set={a => setStep(stepId, a)} project={project} constructs={steps.d0?.constructs} />
            : day.n === 3 ? <ProjectDay3 step={step} set={a => setStep(stepId, a)} project={project} />
            : day.n === 5 ? <ProjectDay5 step={step} set={a => setStep(stepId, a)} />
            : day.n === 4 ? <ProjectDay4 step={step} set={a => setStep(stepId, a)} project={project} updateProject={updateProject} />
            : (
              <>
                {day.n === 1 && steps.d0?.constructs && <p className="hint ps-from0"><b>On Day 0 you wrote:</b> {steps.d0.constructs}</p>}
                <label className="ps-field">Notes for this step
                  <textarea rows={3} value={step.note ?? ''} onChange={e => setStep(stepId, { note: e.target.value })} placeholder={day.n === 1 ? 'Your construct and its items. Reflective or formative — why? How many items (at least 3, better 4)? Expected n, and N:q for your model?' : 'What you decided, and why.'} />
                </label>
                <label className="chk"><input type="checkbox" checked={step.done === 'yes'} onChange={e => setStep(stepId, { done: e.target.checked ? 'yes' : '' })} /> Step done</label>
              </>
            )}
          <p style={{ margin: '12px 0 0' }}><a href="#/model" onClick={() => setTrack('project')}>Open your project in the studio →</a></p>
        </div>
      </section>

      {(day.n < 1 || day.n > 5) && rItem && (
        <section id="r" className="day-sec">
          <h2><span className="shape f" aria-hidden="true" />In R</h2>
          {rItem ? <ItemCard item={rItem} /> : null}
        </section>
      )}

      {check && (
        <section id="check" className="day-sec">
          <h2><span className="shape c" aria-hidden="true" />{check.title}</h2>
          {day.n === 1 ? <><CheckDay1 /><AiCheck /></> : day.n === 2 ? <CheckDay2 /> : day.n === 3 ? <CheckDay3 /> : day.n === 4 ? <CheckDay4 /> : day.n === 5 ? <CheckDay5 /> : <ItemCard item={check} />}
        </section>
      )}

      {cards.length > 0 && (
        <section id="cards" className="day-sec">
          <h2>Reference cards <a className="hint" href={`#/cards/${day.n}`}>· print</a></h2>
          <div className="cards-grid">{cards.map(c => <RefCard key={c.id} card={c} />)}</div>
        </section>
      )}

      {(day.reading.essential.length > 0 || day.reading.additional.length > 0) && (
        <section id="read" className="day-sec">
          <h2>Reading</h2>
          {day.reading.essential.length > 0 && <p><b>Essential.</b> {day.reading.essential.join('; ')}.</p>}
          {day.reading.additional.length > 0 && <p className="hint"><b>Additional.</b> {day.reading.additional.join('; ')}.</p>}
        </section>
      )}

      <div className="next">
        {prev ? <a className="btn" href={`#/day/${prev.n}`}>← Day {prev.n} · {prev.title}</a> : <a className="btn" href="#/start">← Start</a>}
        {next && <a className="btn primary" href={`#/day/${next.n}`}>Day {next.n} · {next.title} →</a>}
      </div>
    </article>
  );
}
