import { describe, expect, it } from 'vitest';
import { translations } from './translations';

describe('i18n translations (F4)', () => {
  it('test_all_keys_exist_in_both_languages', () => {
    const enKeys = Object.keys(translations.en).sort();
    const esKeys = Object.keys(translations.es).sort();
    expect(esKeys).toEqual(enKeys);
  });

  it('contains no em dashes in copy', () => {
    for (const val of Object.values(translations.en)) {
      expect(val).not.toContain('—');
    }
    for (const val of Object.values(translations.es)) {
      expect(val).not.toContain('—');
    }
  });
});
