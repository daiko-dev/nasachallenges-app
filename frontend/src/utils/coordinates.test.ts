import { describe, expect, it } from 'vitest';
import { formatView, normalizeRa, parseCoords, parseView } from './coordinates';

describe('coordinates utilities (F1)', () => {
  it('test_parse_decimal', () => {
    const parsed = parseCoords('210.8023, +54.3490');
    expect(parsed).toEqual({ ra: 210.8023, dec: 54.349 });
  });

  it('test_parse_sexagesimal', () => {
    const parsed = parseCoords('13h 03m 31s +54d 20m 56s');
    expect(parsed).not.toBeNull();
    expect(parsed!.ra).toBeCloseTo(195.879167, 4);
    expect(parsed!.dec).toBeCloseTo(54.348889, 4);

    const colon = parseCoords('00:42:44.3 -41:16:09');
    expect(colon).not.toBeNull();
    expect(colon!.ra).toBeCloseTo(10.684583, 4);
    expect(colon!.dec).toBeCloseTo(-41.269167, 4);
  });

  it('test_ra_wraps_to_0_360', () => {
    expect(normalizeRa(-0.01)).toBeCloseTo(359.99, 5);
    expect(normalizeRa(365.5)).toBeCloseTo(5.5, 5);
    const parsed = parseCoords('-0.01 12.5');
    expect(parsed).toEqual({ ra: 359.99, dec: 12.5 });
  });

  it('test_invalid_returns_null', () => {
    expect(parseCoords('')).toBeNull();
    expect(parseCoords('not coordinates')).toBeNull();
    expect(parseCoords('180.0 95.0')).toBeNull();
    expect(parseCoords('25h 00m 00s +10d 00m 00s')).toBeNull();
  });

  it('test_view_url_roundtrip', () => {
    const query = formatView({ ra: 210.8023, dec: 54.349, fovDeg: 0.25 });
    const roundtrip = parseView(query);
    expect(roundtrip.ra).toBeCloseTo(210.8023, 4);
    expect(roundtrip.dec).toBeCloseTo(54.349, 4);
    expect(roundtrip.fovDeg).toBeCloseTo(0.25, 2);
  });
});
