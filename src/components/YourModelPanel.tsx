// Sidebar preview of the learner's own project, with a way into the studio.
import { Eta } from '../eta/Eta.tsx';
import { analyse } from '../model/diagram.ts';
import { Diagram } from '../model/Editor.tsx';
import type { YourModel } from '../state.ts';

export function YourModelPanel({ model, active, onOpen }: { model: YourModel; active: boolean; onOpen?: () => void }) {
  const d = model.diagram, a = analyse(d);
  const lat = d.nodes.filter(n => n.kind === 'latent').length, items = a.p;
  return (
    <a className={`card ym ym-link ${active ? 'on' : ''}`} href="#/model" onClick={onOpen} aria-current={active ? 'page' : undefined}>
      <h3><Eta mood={d.nodes.length ? 'pleased' : 'curious'} size={34} /> My project</h3>
      {d.nodes.length ? (
        <>
          <div className="ym-mini"><Diagram d={d} /></div>
          <p className="small">{lat} factor{lat === 1 ? '' : 's'} · {items} item{items === 1 ? '' : 's'} · df {a.df}{a.status === 'under' ? ' · not identified' : ''}{model.groups.on ? ` · ${model.groups.names.length} groups, ${model.groups.level}` : ''}</p>
          {model.question && <p className="small" style={{ fontStyle: 'italic' }}>“{model.question}”</p>}
        </>
      ) : <p className="small">Draw the model you want to test in your own research. Every station applies its idea to it.</p>}
      <span className="btn primary" style={{ marginTop: 8 }}>{d.nodes.length ? 'Open in the studio →' : 'Start drawing →'}</span>
    </a>
  );
}
