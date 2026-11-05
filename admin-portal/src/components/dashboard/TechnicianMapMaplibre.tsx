'use client';

import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { TechnicianMapCanvas, type TechnicianMapCanvasProps } from './TechnicianMapCanvas';

const lib = { Map, Marker, NavigationControl };

export default function TechnicianMapMaplibre(props: Omit<TechnicianMapCanvasProps, 'lib'>) {
  return <TechnicianMapCanvas lib={lib} {...props} />;
}
