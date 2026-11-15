import type { Candidate } from '../types/spherex';

export function candidateLabel(c: Candidate, lang: 'en' | 'es'): string {
  if (c.match) {
    return lang === 'es'
      ? `Candidato: coincide con objeto conocido (${c.match.name})`
      : `Candidate: matches known object (${c.match.name})`;
  }
  return lang === 'es' ? 'Candidato: sin validar' : 'Candidate: unvalidated';
}
