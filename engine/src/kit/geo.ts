// Shared projection for the optional real-world map (profile.json "world.map": true).
// 1 world unit = 100 m. x grows east, z grows SOUTH (three.js: -z is "north"/away from a default camera).
//
// Only meaningful if your project uses the map. Edit BBOX/ORIGIN here for your own city/region —
// same convention as the palette in kit/theme.ts: change the constant, every episode follows.
// ORIGIN should be roughly the centre of BBOX. After editing, refetch Overpass data into
// engine/data/osm/*.json and run `npm run geo`.
export type XZ = [number, number];

export const BBOX = {south: 0, west: 0, north: 0, east: 0} as const;
const ORIGIN = {lat: 0, lon: 0};
const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LON = 111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

export const project = (lon: number, lat: number): XZ => [
	((lon - ORIGIN.lon) * M_PER_DEG_LON) / 100,
	(-(lat - ORIGIN.lat) * M_PER_DEG_LAT) / 100,
];

export type GeoData = {
	bounds: {minX: number; maxX: number; minZ: number; maxZ: number};
	roads: Record<'motorway' | 'trunk' | 'primary' | 'secondary', number[][]>;
	/** flat [x0,z0,x1,z1,…] rings */
	land: number[][];
	coast: number[][];
	water: number[][];
	metro: Record<'red' | 'green' | 'blue', number[][]>;
	stations: {name: string; x: number; z: number}[];
};
