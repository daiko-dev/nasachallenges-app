import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BandControls } from './BandControls';
import { SPHEREX_BANDS } from '../../data/spherexBands';
import { getCuratedOrFallbackManifest } from '../../data/curatedFields';

describe('BandControls (102 Infrared Bands Selector)', () => {
  const dummyManifest = getCuratedOrFallbackManifest(210.8023, 54.349, 0.25);

  it('renders all 102 bands correctly in the dataset', () => {
    expect(SPHEREX_BANDS).toHaveLength(102);
    expect(SPHEREX_BANDS[0].wavelength_um).toBeCloseTo(0.75, 2);
    expect(SPHEREX_BANDS[101].wavelength_um).toBeCloseTo(5.0, 2);
  });

  it('renders active band and details in English and Spanish', () => {
    const onSelectChannel = vi.fn();
    const { rerender } = render(
      <BandControls
        manifest={dummyManifest}
        selectedBandChannel={23}
        onSelectChannel={onSelectChannel}
        lang="en"
      />
    );

    expect(screen.getByText(/SPHEREx 102 Infrared Channels/i)).toBeTruthy();
    expect(screen.getByText('#23')).toBeTruthy();
    expect(screen.getAllByText(/1.1338 µm/).length).toBeGreaterThanOrEqual(1);

    rerender(
      <BandControls
        manifest={dummyManifest}
        selectedBandChannel={23}
        onSelectChannel={onSelectChannel}
        lang="es"
      />
    );
    expect(screen.getByText(/102 Canales Infrarrojos SPHEREx/i)).toBeTruthy();
    expect(screen.getByText('Canal Espectral')).toBeTruthy();
  });

  it('steps to previous and next channel', () => {
    const onSelectChannel = vi.fn();
    render(
      <BandControls
        manifest={dummyManifest}
        selectedBandChannel={23}
        onSelectChannel={onSelectChannel}
        lang="en"
      />
    );

    const prevButton = screen.getByRole('button', { name: /Previous channel/i });
    const nextButton = screen.getByRole('button', { name: /Next channel/i });

    fireEvent.click(prevButton);
    expect(onSelectChannel).toHaveBeenCalledWith(22);

    fireEvent.click(nextButton);
    expect(onSelectChannel).toHaveBeenCalledWith(24);
  });

  it('switches array filters to filter visible channels', () => {
    const onSelectChannel = vi.fn();
    render(
      <BandControls
        manifest={dummyManifest}
        selectedBandChannel={1}
        onSelectChannel={onSelectChannel}
        lang="en"
      />
    );

    // Click Array 6 filter (7 channels: 96 to 102)
    const array6Btn = screen.getByRole('button', { name: /A6/i });
    fireEvent.click(array6Btn);

    expect(screen.getByText(/Filtered Channels \(7\)/i)).toBeTruthy();

    // Click All (102) filter
    const allBtn = screen.getByRole('button', { name: /All \(102\)/i });
    fireEvent.click(allBtn);
    expect(screen.getByText(/Filtered Channels \(102\)/i)).toBeTruthy();
  });

  it('selects quick science presets such as H2O Water Ice (Ch 75)', () => {
    const onSelectChannel = vi.fn();
    render(
      <BandControls
        manifest={dummyManifest}
        selectedBandChannel={1}
        onSelectChannel={onSelectChannel}
        lang="en"
      />
    );

    const presetBtn = screen.getByRole('button', { name: /H₂O Water Ice/i });
    fireEvent.click(presetBtn);
    expect(onSelectChannel).toHaveBeenCalledWith(75);
  });
});
