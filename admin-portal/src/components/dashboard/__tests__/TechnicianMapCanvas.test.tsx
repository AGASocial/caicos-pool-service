import React from 'react';
import { render, screen } from '@testing-library/react';
import { TechnicianMapCanvas } from '../TechnicianMapCanvas';

describe('TechnicianMapCanvas', () => {
  it('calls map resize on load when there are no technicians or jobs', () => {
    const resize = jest.fn();
    const fitBounds = jest.fn();

    const MockMap = React.forwardRef<
      { resize: () => void; fitBounds: typeof fitBounds },
      { onLoad?: () => void; children?: React.ReactNode }
    >(function MockMap({ onLoad, children }, ref) {
      React.useImperativeHandle(ref, () => ({ resize, fitBounds }));
      React.useEffect(() => {
        onLoad?.();
      }, [onLoad]);
      return <div data-testid="tech-map-canvas">{children}</div>;
    });

    const lib = {
      Map: MockMap,
      Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
      NavigationControl: () => null,
    };

    render(
      <TechnicianMapCanvas
        lib={lib}
        mapStyle="https://example.com/style.json"
        technicians={[]}
        jobs={[]}
      />,
    );

    expect(screen.getByTestId('tech-map-canvas')).toBeInTheDocument();
    expect(resize).toHaveBeenCalled();
    expect(fitBounds).not.toHaveBeenCalled();
  });
});
