// The start page: how a day works, the ten days at a glance, and the learner's project.
import { Eta } from '../eta/Eta.tsx';
import { analyse } from '../model/diagram.ts';
import { doneSet, type ProjectSteps, type Track, type YourModel } from '../state.ts';
import { DAYS, readiness } from './days.ts';

// The authors: η Lab grew out of their teaching materials.
const AUTHORS = [
  { name: 'Daniel Seddig', color: 'var(--obs)' },
  { name: 'Peter Schmidt', color: 'var(--latent)' },
  { name: 'Yannick Diehl', color: 'var(--err)' },
];

const STATE_LABEL = { ready: 'ready', partly: 'partly built', planned: 'planned' } as const;

function stepDone(steps: ProjectSteps, n: number) {
  // days 2–5 mark their own project step done once its answers are complete
  if (doneSet().has(`d${n}-project`)) return true;
  const s = steps[`d${n}`];
  if (!s) return false;
  return n === 2 ? !!s.format && (s.accept ?? '').trim().length >= 12 : s.done === 'yes';
}

export function Home({ project, steps, setTrack }: { project: YourModel; steps: ProjectSteps; setTrack: (t: Track) => void }) {
  const a = analyse(project.diagram);
  const doneSteps = DAYS.filter(d => d.n > 0 && stepDone(steps, d.n)).length;
  const next = DAYS.find(d => d.n > 0 && !stepDone(steps, d.n));
  return (
    <article className="home">
      <header className="home-hero">
        <Eta size={110} mood="explaining" />
        <div>
          <span className="kicker">Structural equation modeling with R and lavaan</span>
          <h1>Ten days from a construct to your own model</h1>
          <p>Part 1 builds measurement models — confirmatory factor analysis and measurement invariance. Part 2 connects them into structural models.</p>
          <p>Each day has an interactive script to work through, a task in the studio, the same model in R and one step in your own project — in four moves:</p>
          <p style={{ marginTop: 12 }}><a className="btn primary" href="#/day/0">Start with Day 0: setup and basics →</a> <a className="btn" href="#/map">The map of SEM: the big picture</a></p>
        </div>
      </header>

      <div className="moves home-moves">
        <div className="card move"><span className="shape e" aria-hidden="true" /><b>Understand</b><span>Stations: a question to guess, a sandbox to play with, η’s explanation, the formula with your numbers.</span></div>
        <div className="card move"><span className="shape r" aria-hidden="true" /><b>Try it</b><span>The day’s example model in the studio, with a task that asks for decisions, not clicks.</span></div>
        <div className="card move"><span className="shape y" aria-hidden="true" /><b>Your project</b><span>One small step in your own model — with or without data yet.</span></div>
        <div className="card move"><span className="shape f" aria-hidden="true" /><b>In R</b><span>The same model in lavaan, with the numbers you should get.</span></div>
      </div>

      {[0, 1, 2].map(w => (
        <section key={w} className="home-week">
          <h2>{w === 0 ? 'Before you start' : `Part ${w} · ${w === 1 ? 'Confirmatory factor analysis' : 'Structural equation models'}`}</h2>
          <div className="day-grid">
            {DAYS.filter(d => d.week === w).map(d => {
              const r = readiness(d);
              return (
                <a key={d.n} className={`card day-card ${r.state}`} href={`#/day/${d.n}`}>
                  <span className="dc-top"><b>Day {d.n}</b><span className={`badge ${r.state}`}>{STATE_LABEL[r.state]}</span>{stepDone(steps, d.n) && <span className="badge done">project ✓</span>}</span>
                  <span className="dc-title">{d.title}</span>
                  <span className="dc-sub">{d.subtitle}</span>
                  <span className="dc-meter" aria-label={`${r.ready} of ${r.total} parts ready`}><i style={{ width: `${(100 * r.ready) / r.total}%` }} /></span>
                </a>
              );
            })}
          </div>
        </section>
      ))}

      <section className="card home-project">
        <Eta size={60} mood={project.diagram.nodes.length ? 'pleased' : 'curious'} />
        <div>
          <h2>Your project</h2>
          <p>{project.diagram.nodes.length
            ? <>{project.question ? <i>“{project.question}”</i> : 'No research question written yet.'} · {a.s.latent.length} factor{a.s.latent.length === 1 ? '' : 's'}, {a.p} variables, df {a.df}.</>
            : 'Bring your own question — or pick one from the ESS. Each day adds one step; your project never waits for the days, and the days never wait for it.'}</p>
          <p className="hint">{doneSteps} of 10 steps done{next ? <> · next: <a href={`#/day/${next.n}#project`}>Day {next.n} — {next.project.title.toLowerCase()}</a></> : ' · ready to report'}</p>
          <a className="btn primary" href="#/model" onClick={() => setTrack('project')}>Open your project in the studio →</a>
        </div>
      </section>

      <section className="home-team" aria-label="Authors">
        <h2>Authors</h2>
        <div className="team">
          {AUTHORS.map(t => (
            <div key={t.name} className="card person">
              <i style={{ background: t.color }} aria-hidden="true">{t.name.split(' ').map(w => w[0]).join('')}</i>
              <span><b>{t.name}</b></span>
            </div>
          ))}
        </div>
      </section>

      <p className="hint home-foot">η Lab grew out of the structural equation modeling course of the Essex Summer School and works on its own. It holds only aggregated ESS data (means and covariances); every estimate is computed in your browser and checked against lavaan. Your models stay in this browser unless you share a link.</p>
    </article>
  );
}
