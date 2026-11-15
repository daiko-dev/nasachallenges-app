import { describe, expect, it } from 'vitest';
import type { Candidate } from '../types/spherex';
import { candidateLabel } from './candidates';

const kinds: Candidate['kind'][] = ['moved_source', 'unmatched_source'];
const langs: ('en' | 'es')[] = ['en', 'es'];

describe('candidates utilities (F3)', () => {
  it('test_label_never_says_discovery', () => {
    for (const kind of kinds) {
      for (const lang of langs) {
        const unmatched: Candidate = {
          id: 'c1',
          kind,
          status: 'candidate',
          track: [],
          snr: 6.2,
          match: null,
          explanation: null,
        };
        const matched: Candidate = {
          ...unmatched,
          match: { catalog: 'JPL SBIdent', name: '2024 XY1', sepArcsec: 2.1 },
        };

        expect(candidateLabel(unmatched, lang)).not.toMatch(/discover|descubr/i);
        expect(candidateLabel(matched, lang)).not.toMatch(/discover|descubr/i);
      }
    }
  });
});
