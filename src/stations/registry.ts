// The built stations. Where each one sits in η Lab (day and number) is in course/days.ts.
import type { ComponentType } from 'react';
import type { YourModel } from '../state.ts';
import { S4MeasurementError } from './S4MeasurementError.tsx';
import { S5OneFactor } from './S5OneFactor.tsx';
import { S6Identification } from './S6Identification.tsx';
import { S7Estimation } from './S7Estimation.tsx';
import { S8Fit } from './S8Fit.tsx';
import { S9Data } from './S9Data.tsx';
import { S11TwoRulers } from './S11TwoRulers.tsx';
import { S13Mediation } from './S13Mediation.tsx';

export interface Station { id: string; title: string; component: ComponentType<{ model: YourModel }> }

export const STATIONS: Station[] = [
  { id: 's4', title: 'Noise hides relationships', component: S4MeasurementError },
  { id: 's5', title: 'The measurement machine', component: S5OneFactor },
  { id: 's6', title: 'The knowledge budget', component: S6Identification },
  { id: 's7', title: 'Rolling downhill', component: S7Estimation },
  { id: 's8', title: 'How close is close enough?', component: S8Fit },
  { id: 's9', title: 'Data as they are', component: S9Data },
  { id: 's11', title: 'Two rulers', component: S11TwoRulers },
  { id: 's13', title: 'Mediation', component: S13Mediation },
];
export const stationById = (id: string) => STATIONS.find(s => s.id === id) ?? null;
