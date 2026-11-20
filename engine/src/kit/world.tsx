// 3D building blocks for the optional real-world map (profile.json "world.map": true).
// Every animation here is a pure function of useCurrentFrame() (Remotion rule: no
// useFrame, no self-running shaders).
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {interpolate, spring, staticFile, useCurrentFrame, useDelayRender, useVideoConfig} from 'remotion';
import {
	CanvasTexture,
	MeshStandardMaterial,
	SRGBColorSpace,
	BufferGeometry,
	CatmullRomCurve3,
	Color,
	Float32BufferAttribute,
	InstancedMesh,
	Object3D,
	Shape,
	ShapeGeometry,
	TubeGeometry,
	Vector3,
} from 'three';
import type {GeoData, XZ} from './geo';
import {C} from './theme';

// ---------------------------------------------------------------- data

/** Loads public/geo/world.json (built by scripts/build-geo.ts). Call OUTSIDE <ThreeCanvas>. */
export const useGeo = (): GeoData | null => {
	const [geo, setGeo] = useState<GeoData | null>(null);
	const {delayRender, continueRender, cancelRender} = useDelayRender();
	const [handle] = useState(() => delayRender('Loading geo/world.json'));
	useEffect(() => {
		fetch(staticFile('geo/world.json'))
			.then((r) => r.json())
			.then((g: GeoData) => {
				setGeo(g);
				continueRender(handle);
			})
			.catch(cancelRender);
	}, [handle, continueRender, cancelRender]);
	return geo;
};

const pairs = (flat: number[]): XZ[] => {
	const out: XZ[] = [];
	for (let i = 0; i < flat.length; i += 2) out.push([flat[i], flat[i + 1]]);
	return out;
};

const shapeFromRing = (ring: number[]) => {
	const s = new Shape();
	pairs(ring).forEach(([x, z], i) => (i === 0 ? s.moveTo(x, -z) : s.lineTo(x, -z)));
	return s;
};

/** Flat ribbons on the ground plane (WebGL ignores lineWidth, so roads are quads). */
const ribbonGeometry = (lines: number[][], width: number, y: number) => {
	const pos: number[] = [];
	const h = width / 2;
	for (const line of lines) {
		const pts = pairs(line);
		for (let i = 0; i + 1 < pts.length; i++) {
			const [ax, az] = pts[i];
			const [bx, bz] = pts[i + 1];
			const len = Math.hypot(bx - ax, bz - az) || 1;
			const nx = (-(bz - az) / len) * h;
			const nz = ((bx - ax) / len) * h;
			pos.push(ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz);
			pos.push(ax + nx, y, az + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz);
		}
	}
	const g = new BufferGeometry();
	g.setAttribute('position', new Float32BufferAttribute(pos, 3));
	g.computeVertexNormals();
	return g;
};

// ---------------------------------------------------------------- map

/** Night map: sea, land, inland water, roads by class. Static; animate the camera instead. */
export const WorldMap: React.FC<{geo: GeoData; roadOpacity?: number}> = ({geo, roadOpacity = 1}) => {
	const land = useMemo(() => {
		const g = new ShapeGeometry(geo.land.map(shapeFromRing));
		g.rotateX(-Math.PI / 2);
		return g;
	}, [geo]);
	const water = useMemo(() => {
		const g = new ShapeGeometry(geo.water.map(shapeFromRing));
		g.rotateX(-Math.PI / 2);
		g.translate(0, 0.01, 0);
		return g;
	}, [geo]);
	const roads = useMemo(
		() => ({
			secondary: ribbonGeometry(geo.roads.secondary, 0.12, 0.02),
			primary: ribbonGeometry(geo.roads.primary, 0.22, 0.025),
			trunk: ribbonGeometry(geo.roads.trunk, 0.4, 0.03),
			motorway: ribbonGeometry(geo.roads.motorway, 0.55, 0.035),
		}),
		[geo],
	);
	const {minX, maxX, minZ, maxZ} = geo.bounds;
	return (
		<group>
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[(minX + maxX) / 2, -0.02, (minZ + maxZ) / 2]}>
				<planeGeometry args={[(maxX - minX) * 4, (maxZ - minZ) * 4]} />
				<meshBasicMaterial color={C.sea} />
			</mesh>
			<mesh geometry={land}>
				<meshBasicMaterial color={C.land} />
			</mesh>
			<mesh geometry={water}>
				<meshBasicMaterial color={C.sea} />
			</mesh>
			<mesh geometry={roads.secondary}>
				<meshBasicMaterial color={C.road} transparent opacity={0.8 * roadOpacity} />
			</mesh>
			<mesh geometry={roads.primary}>
				<meshBasicMaterial color={C.roadPrimary} transparent opacity={roadOpacity} />
			</mesh>
			<mesh geometry={roads.trunk}>
				<meshBasicMaterial color={C.roadMajor} transparent opacity={0.75 * roadOpacity} />
			</mesh>
			<mesh geometry={roads.motorway}>
				<meshBasicMaterial color={C.roadMajor} transparent opacity={roadOpacity} />
			</mesh>
		</group>
	);
};

/** Existing metro lines drawn thin, for context. */
export const MetroContext: React.FC<{geo: GeoData; opacity?: number}> = ({geo, opacity = 0.7}) => {
	const g = useMemo(
		() => ({red: ribbonGeometry(geo.metro.red, 0.35, 0.05), green: ribbonGeometry(geo.metro.green, 0.35, 0.05)}),
		[geo],
	);
	return (
		<group>
			<mesh geometry={g.red}>
				<meshBasicMaterial color="#e5484d" transparent opacity={opacity} />
			</mesh>
			<mesh geometry={g.green}>
				<meshBasicMaterial color="#30a46c" transparent opacity={opacity} />
			</mesh>
		</group>
	);
};

// ---------------------------------------------------------------- route

const TUBE_SEGMENTS = 600;
const RADIAL = 8;

/**
 * A glowing route that draws itself from start to end between frames `from` and `to`.
 * `points` is an ordered polyline in world XZ; it floats at `y` (elevated track ≈ 0.3–0.5).
 */
export const RouteLine: React.FC<{
	points: XZ[];
	from: number;
	to: number;
	color?: string;
	radius?: number;
	y?: number;
}> = ({points, from, to, color = C.accent, radius = 0.22, y = 0.4}) => {
	const frame = useCurrentFrame();
	const {curve, core, glow} = useMemo(() => {
		const c = new CatmullRomCurve3(
			points.map(([x, z]) => new Vector3(x, y, z)),
			false,
			'centripetal',
		);
		return {
			curve: c,
			core: new TubeGeometry(c, TUBE_SEGMENTS, radius, RADIAL, false),
			glow: new TubeGeometry(c, TUBE_SEGMENTS, radius * 2.6, RADIAL, false),
		};
	}, [points, radius, y]);
	const t = Math.min(1, Math.max(0, (frame - from) / Math.max(1, to - from)));
	// ease-out so the head decelerates into the terminus
	const p = 1 - Math.pow(1 - t, 2.2);
	const count = Math.floor(p * TUBE_SEGMENTS) * RADIAL * 6;
	useLayoutEffect(() => {
		core.setDrawRange(0, count);
		glow.setDrawRange(0, count);
	}, [core, glow, count]);
	if (count === 0) return null;
	const head = curve.getPointAt(p);
	return (
		<group>
			<mesh geometry={core}>
				<meshBasicMaterial color={color} toneMapped={false} />
			</mesh>
			<mesh geometry={glow}>
				<meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} toneMapped={false} />
			</mesh>
			{t < 1 ? (
				<mesh position={head}>
					<sphereGeometry args={[radius * 2.4, 16, 16]} />
					<meshBasicMaterial color="#ffffff" toneMapped={false} />
				</mesh>
			) : null}
		</group>
	);
};

/** Arc-length parameter (0..1) of the polyline point closest to `xz` — e.g. where a station sits on a route. */
export const nearestParam = (points: XZ[], xz: XZ): number => {
	let total = 0;
	let best = {d: Infinity, at: 0};
	for (let i = 0; i + 1 < points.length; i++) {
		const [ax, az] = points[i];
		const [bx, bz] = points[i + 1];
		const len = Math.hypot(bx - ax, bz - az);
		const u = len ? Math.max(0, Math.min(1, ((xz[0] - ax) * (bx - ax) + (xz[1] - az) * (bz - az)) / (len * len))) : 0;
		const d = Math.hypot(ax + (bx - ax) * u - xz[0], az + (bz - az) * u - xz[1]);
		if (d < best.d) best = {d, at: total + len * u};
		total += len;
	}
	return best.at / total;
};

/**
 * A bright "train" that travels a route, passing through `keys` (frame → route param),
 * so it reaches each station on the word that names it. Pair with nearestParam().
 */
export const Train: React.FC<{points: XZ[]; keys: {at: number; t: number}[]; y?: number; color?: string}> = ({
	points,
	keys,
	y = 0.4,
	color = '#ffffff',
}) => {
	const frame = useCurrentFrame();
	const curve = useMemo(() => new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, y, z)), false, 'centripetal'), [points, y]);
	if (frame < keys[0].at || frame > keys[keys.length - 1].at + 10) return null;
	const t = interpolate(
		frame,
		keys.map((k) => k.at),
		keys.map((k) => k.t),
		{extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
	);
	const head = curve.getPointAt(t);
	const tail = curve.getPointAt(Math.max(0, t - 0.015));
	return (
		<group>
			<mesh position={head}>
				<sphereGeometry args={[0.7, 20, 20]} />
				<meshBasicMaterial color={color} toneMapped={false} />
			</mesh>
			<mesh position={tail}>
				<sphereGeometry args={[1.6, 20, 20]} />
				<meshBasicMaterial color={C.accent} transparent opacity={0.25} depthWrite={false} toneMapped={false} />
			</mesh>
		</group>
	);
};

// ---------------------------------------------------------------- pins & rings

/** Station marker: stalk + disc, pops on `at`, then a pulse ring radiates once. */
export const StationPin: React.FC<{x: number; z: number; at: number; color?: string; height?: number}> = ({
	x,
	z,
	at,
	color = C.accent,
	height = 2.2,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const s = spring({frame: frame - at, fps, config: {damping: 11, stiffness: 160, mass: 0.6}});
	if (frame < at) return null;
	const pulse = Math.min(1, (frame - at) / 24);
	return (
		<group position={[x, 0, z]}>
			<mesh position={[0, (height * s) / 2, 0]} scale={[1, Math.max(0.001, s), 1]}>
				<cylinderGeometry args={[0.12, 0.12, height, 8]} />
				<meshBasicMaterial color="#ffffff" />
			</mesh>
			<mesh position={[0, height * s, 0]} scale={s}>
				<sphereGeometry args={[0.7, 20, 20]} />
				<meshBasicMaterial color={color} toneMapped={false} />
			</mesh>
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} scale={0.5 + pulse * 5}>
				<ringGeometry args={[0.8, 1, 48]} />
				<meshBasicMaterial color={color} transparent opacity={(1 - pulse) * 0.8} depthWrite={false} />
			</mesh>
		</group>
	);
};

/** Ground ring that grows to `radius` world units (e.g. 8 = 800 m walking catchment). */
export const CatchmentRing: React.FC<{x: number; z: number; radius: number; at: number; color?: string}> = ({
	x,
	z,
	radius,
	at,
	color = C.gold,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	if (frame < at) return null;
	const s = spring({frame: frame - at, fps, config: {damping: 18, stiffness: 60}});
	return (
		<group position={[x, 0.07, z]} rotation={[-Math.PI / 2, 0, 0]} scale={s * radius}>
			<mesh>
				<circleGeometry args={[1, 72]} />
				<meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} />
			</mesh>
			<mesh>
				<ringGeometry args={[0.97, 1, 96]} />
				<meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
			</mesh>
		</group>
	);
};

// ---------------------------------------------------------------- buildings

const mulberry32 = (seed: number) => () => {
	seed |= 0;
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Block = {x: number; z: number; w: number; d: number; h: number; delay: number; color: Color};

/**
 * Procedural low-poly district. Towers rise from the centre outwards starting at `at`
 * (ripple), so a neighbourhood "grows" on a spoken word. Deterministic per `seed`.
 */
export const District: React.FC<{
	x: number;
	z: number;
	radius: number;
	count: number;
	at: number;
	seed?: number;
	maxHeight?: number;
	/** keep towers off a corridor (e.g. the route) — list of XZ points + clearance */
	avoid?: {points: XZ[]; clearance: number};
}> = ({x, z, radius, count, at, seed = 1, maxHeight = 3.5, avoid}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const ref = useRef<InstancedMesh>(null);
	const blocks = useMemo<Block[]>(() => {
		const rnd = mulberry32(seed);
		const out: Block[] = [];
		const palette = C.building.map((c) => new Color(c));
		for (let tries = 0; out.length < count && tries < count * 20; tries++) {
			const r = radius * Math.sqrt(rnd());
			const a = rnd() * Math.PI * 2;
			const bx = x + Math.cos(a) * r;
			const bz = z + Math.sin(a) * r;
			if (avoid && avoid.points.some(([px, pz]) => Math.hypot(px - bx, pz - bz) < avoid.clearance)) continue;
			const centrality = 1 - r / radius;
			const w = 0.5 + rnd() * 0.9;
			out.push({
				x: bx,
				z: bz,
				w,
				d: w * (0.7 + rnd() * 0.6),
				h: 0.3 + Math.pow(rnd(), 2.2) * maxHeight * (0.4 + centrality),
				delay: (r / radius) * 14 + rnd() * 6,
				color: palette[Math.floor(rnd() * palette.length)].clone().offsetHSL(0, 0, rnd() * 0.04),
			});
		}
		return out;
	}, [x, z, radius, count, seed, maxHeight, avoid]);

	useLayoutEffect(() => {
		const mesh = ref.current;
		if (!mesh) return;
		const o = new Object3D();
		blocks.forEach((b, i) => {
			const g = frame < at ? 0 : spring({frame: frame - at - b.delay, fps, config: {damping: 14, stiffness: 120}});
			const h = Math.max(0.001, b.h * g);
			o.position.set(b.x, h / 2, b.z);
			o.scale.set(b.w, h, b.d);
			o.updateMatrix();
			mesh.setMatrixAt(i, o.matrix);
			mesh.setColorAt(i, b.color);
		});
		mesh.instanceMatrix.needsUpdate = true;
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
	}, [blocks, frame, at, fps]);

	const [facade, roof] = useMemo(() => {
		const tex = windowTexture(seed);
		return [
			new MeshStandardMaterial({map: tex, emissiveMap: tex, emissive: new Color('#ffffff'), emissiveIntensity: 0.9, roughness: 0.85}),
			new MeshStandardMaterial({color: '#5d6f96', roughness: 0.9}),
		];
	}, [seed]);
	// BoxGeometry groups: +x, -x, +y (roof), -y, +z, -z
	const materials = useMemo(() => [facade, facade, roof, roof, facade, facade], [facade, roof]);

	return (
		<instancedMesh ref={ref} args={[undefined, materials, blocks.length]}>
			<boxGeometry args={[1, 1, 1]} />
		</instancedMesh>
	);
};

/** Dark facade with a deterministic grid of warm/cool lit windows (used as map + emissiveMap). */
const windowTexture = (seed: number) => {
	const rnd = mulberry32(seed * 977);
	const cols = 6;
	const rows = 18;
	const cw = 16;
	const ch = 14;
	const canvas = document.createElement('canvas');
	canvas.width = cols * cw;
	canvas.height = rows * ch;
	const g = canvas.getContext('2d')!;
	g.fillStyle = '#0a0d14';
	g.fillRect(0, 0, canvas.width, canvas.height);
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const v = rnd();
			g.fillStyle = v > 0.55 ? C.windows : v > 0.4 ? '#7fb2ff' : '#1a2233';
			g.fillRect(c * cw + 4, r * ch + 4, cw - 8, ch - 7);
		}
	}
	const tex = new CanvasTexture(canvas);
	tex.colorSpace = SRGBColorSpace;
	return tex;
};

/** Standard lighting + depth fog for the night look. */
export const NightLights: React.FC<{fogNear?: number; fogFar?: number}> = ({fogNear = 120, fogFar = 520}) => (
	<>
		<color attach="background" args={[C.fog]} />
		<fog attach="fog" args={[C.fog, fogNear, fogFar]} />
		<hemisphereLight args={['#a9c2ff', '#0a0c12', 1.3]} />
		<directionalLight position={[-60, 120, 40]} intensity={1.1} color="#dfe8ff" />
	</>
);

/** Plain dark ground plane for projects that don't use the real-world map (profile.json "world.map": false). Pair with <NightLights>. */
export const Ground: React.FC<{size?: number}> = ({size = 60}) => (
	<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
		<planeGeometry args={[size, size]} />
		<meshStandardMaterial color={C.land} roughness={0.95} />
	</mesh>
);
