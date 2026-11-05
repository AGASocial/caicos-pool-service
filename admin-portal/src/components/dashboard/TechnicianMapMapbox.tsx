'use client';

import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { TechnicianMapCanvas, type TechnicianMapCanvasProps } from './TechnicianMapCanvas';

const lib = { Map, Marker, NavigationControl };

export default function TechnicianMapMapbox(props: Omit<TechnicianMapCanvasProps, 'lib'>) {
  return <TechnicianMapCanvas lib={lib} {...props} />;
}
