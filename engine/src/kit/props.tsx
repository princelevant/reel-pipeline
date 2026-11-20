// Data-bearing 3D props: a tower whose floors light up with transactions, and value columns
// standing on the map. Frame-driven and deterministic like everything in kit/world.tsx.
import {useLayoutEffect, useMemo, useRef} from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Color, InstancedMesh, Object3D} from 'three';
import {C} from './theme';

export const FLOOR_H = 0.035; // world units per storey (1 unit = 100 m → 3.5 m)

/** World Y of a floor's middle, for MapLabels/camera targets on a <Tower>. */
export const floorY = (floor: number) => (floor - 0.5) * FLOOR_H;

export type FloorMark = {floor: number; at: number; until?: number; color?: string};

/**
 * A tower built from per-floor slabs so individual floors can light up (a sale, a price, a resale).
 * - `riseAt`: the tower builds itself floor by floor from this frame (omit = already standing)
 * - `scan`: a glowing plane sweeps bottom → top between two frames (the "scan a tower" gesture)
 * - `marks`: floors that light up at their own frames (gold by default), optionally fading out at `until`
 */
export const Tower: React.FC<{
	x: number;
	z: number;
	floors: number;
	width?: number;
	depth?: number;
	rotationY?: number;
	riseAt?: number;
	riseFrames?: number;
	scan?: {from: number; to: number};
	marks?: FloorMark[];
	color?: string;
}> = ({x, z, floors, width = 0.42, depth = 0.42, rotationY = 0, riseAt, riseFrames = 45, scan, marks = [], color = '#22304d'}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const slabs = useRef<InstancedMesh>(null);
	const lit = useRef<InstancedMesh>(null);
	const builtFloors = riseAt === undefined ? floors : Math.round(interpolate(frame, [riseAt, riseAt + riseFrames], [0, floors], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
	const scanY = scan ? interpolate(frame, [scan.from, scan.to], [0, floors * FLOOR_H], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : null;
	const scanActive = scan !== undefined && frame >= scan.from && frame <= scan.to + 8;

	const base = useMemo(() => new Color(color), [color]);
	const glass = useMemo(() => new Color(color).offsetHSL(0, 0.05, 0.12), [color]);

	useLayoutEffect(() => {
		const m = slabs.current;
		if (!m) return;
		const o = new Object3D();
		for (let f = 0; f < floors; f++) {
			const shown = f < builtFloors;
			o.position.set(0, floorY(f + 1), 0);
			o.scale.set(shown ? width : 0.0001, FLOOR_H * 0.86, shown ? depth : 0.0001);
			o.updateMatrix();
			m.setMatrixAt(f, o.matrix);
			// floors the scan has passed read slightly brighter: "data loaded"
			m.setColorAt(f, scanY !== null && floorY(f + 1) < scanY ? glass : base);
		}
		m.instanceMatrix.needsUpdate = true;
		if (m.instanceColor) m.instanceColor.needsUpdate = true;
	}, [floors, builtFloors, width, depth, base, glass, scanY]);

	useLayoutEffect(() => {
		const m = lit.current;
		if (!m) return;
		const o = new Object3D();
		marks.forEach((mk, i) => {
			const on = frame >= mk.at && (mk.until === undefined || frame < mk.until);
			const s = on ? spring({frame: frame - mk.at, fps, config: {damping: 12, stiffness: 200}}) : 0;
			o.position.set(0, floorY(mk.floor), 0);
			// fully collapse unlit marks (a zero-height slab still shows as a thin plate)
			const k = s > 0.001 ? 1 : 0.0001;
			o.scale.set(width * (1 + 0.12 * s) * k, FLOOR_H * 0.9 * Math.max(0.0001, s), depth * (1 + 0.12 * s) * k);
			o.updateMatrix();
			m.setMatrixAt(i, o.matrix);
			m.setColorAt(i, new Color(mk.color ?? C.gold));
		});
		m.instanceMatrix.needsUpdate = true;
		if (m.instanceColor) m.instanceColor.needsUpdate = true;
	}, [marks, frame, fps, width, depth]);

	return (
		<group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
			<instancedMesh ref={slabs} args={[undefined, undefined, floors]}>
				<boxGeometry args={[1, 1, 1]} />
				<meshStandardMaterial roughness={0.35} metalness={0.4} emissive={C.accent} emissiveIntensity={0.08} />
			</instancedMesh>
			{marks.length ? (
				<instancedMesh ref={lit} args={[undefined, undefined, marks.length]}>
					<boxGeometry args={[1, 1, 1]} />
					<meshBasicMaterial toneMapped={false} />
				</instancedMesh>
			) : null}
			{/* crown: thin mast + small aviation light */}
			<mesh position={[0, builtFloors * FLOOR_H + 0.06, 0]}>
				<cylinderGeometry args={[0.006, 0.006, 0.12, 6]} />
				<meshStandardMaterial color="#9aa4b8" />
			</mesh>
			<mesh position={[0, builtFloors * FLOOR_H + 0.125, 0]}>
				<sphereGeometry args={[0.018, 10, 10]} />
				<meshBasicMaterial color="#ff4d4d" toneMapped={false} />
			</mesh>
			{scanActive && scanY !== null ? (
				<group position={[0, scanY, 0]}>
					<mesh rotation={[-Math.PI / 2, 0, 0]}>
						<ringGeometry args={[Math.max(width, depth) * 0.75, Math.max(width, depth) * 1.6, 48]} />
						<meshBasicMaterial color={C.accent} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
					</mesh>
					<mesh rotation={[-Math.PI / 2, 0, 0]}>
						<planeGeometry args={[width * 1.25, depth * 1.25]} />
						<meshBasicMaterial color={C.accent} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
					</mesh>
				</group>
			) : null}
		</group>
	);
};

export type ValuePoint = {x: number; z: number; value: number; color?: string};

/**
 * Hexagonal columns standing on the map, height ∝ value, rising one after another from `at`
 * (in the given order, `stagger` frames apart). Colour ramps cool → gold with value unless set.
 */
export const ValueColumns: React.FC<{
	points: ValuePoint[];
	at: number;
	stagger?: number;
	maxHeight?: number;
	radius?: number;
	until?: number;
}> = ({points, at, stagger = 3, maxHeight = 14, radius = 1.6, until}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const ref = useRef<InstancedMesh>(null);
	const max = Math.max(...points.map((p) => p.value));
	const cool = useMemo(() => new Color(C.accent), []);
	const warm = useMemo(() => new Color(C.gold), []);
	const out = until === undefined ? 1 : interpolate(frame, [until - 10, until], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

	useLayoutEffect(() => {
		const m = ref.current;
		if (!m) return;
		const o = new Object3D();
		points.forEach((p, i) => {
			const g = frame < at + i * stagger ? 0 : spring({frame: frame - at - i * stagger, fps, config: {damping: 14, stiffness: 110}});
			const h = Math.max(0.0001, (p.value / max) * maxHeight * g * out);
			o.position.set(p.x, h / 2, p.z);
			o.scale.set(radius, h, radius);
			o.updateMatrix();
			m.setMatrixAt(i, o.matrix);
			m.setColorAt(i, p.color ? new Color(p.color) : cool.clone().lerp(warm, p.value / max));
		});
		m.instanceMatrix.needsUpdate = true;
		if (m.instanceColor) m.instanceColor.needsUpdate = true;
	}, [points, frame, at, stagger, fps, max, maxHeight, radius, cool, warm, out]);

	return (
		<instancedMesh ref={ref} args={[undefined, undefined, points.length]}>
			<cylinderGeometry args={[1, 1, 1, 6]} />
			<meshStandardMaterial roughness={0.6} emissive="#ffffff" emissiveIntensity={0.12} flatShading />
		</instancedMesh>
	);
};
