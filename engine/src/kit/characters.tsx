// Toy-diorama cast: the channel mascot "Mo" and low-poly cars. Built from primitives (no
// external assets, no licences), animated purely from useCurrentFrame() so every render is identical.
// Scale: Mo is ~1 world unit tall by default; diorama scenes pick their own scale (not the 100 m map unit).
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

export type Waypoint = {at: number; x: number; z: number};

/** Position + heading at a frame along timed waypoints (eased between each pair). Exported for cameras/labels. */
export const poseOnPath = (frame: number, path: Waypoint[]) => {
	if (path.length === 1 || frame <= path[0].at) {
		const [a, b] = [path[0], path[1] ?? path[0]];
		return {x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z), moving: false};
	}
	let i = 0;
	while (i + 1 < path.length - 1 && path[i + 1].at <= frame) i++;
	const a = path[i];
	const b = path[i + 1];
	const t = interpolate(frame, [a.at, b.at], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad)});
	const still = a.x === b.x && a.z === b.z;
	return {
		x: a.x + (b.x - a.x) * t,
		z: a.z + (b.z - a.z) * t,
		heading: still ? headingBefore(path, i) : Math.atan2(b.x - a.x, b.z - a.z),
		moving: !still && frame > a.at && frame < b.at,
	};
};
const headingBefore = (path: Waypoint[], i: number): number => {
	for (let k = i; k > 0; k--) {
		const [a, b] = [path[k - 1], path[k]];
		if (a.x !== b.x || a.z !== b.z) return Math.atan2(b.x - a.x, b.z - a.z);
	}
	return 0;
};

export type MoAction = 'idle' | 'walk' | 'wave' | 'shrug' | 'facepalm' | 'point' | 'cheer' | 'shock' | 'phone' | 'sit';
export type MoMood = 'happy' | 'neutral' | 'shock' | 'sad' | 'annoyed';

const SKIN = '#c98e64';
const SHIRT = '#1fb5a8';
const SHORTS = '#2b3550';
const CAP = '#e8463a';

/**
 * Mo — the recurring channel mascot. Chibi proportions so he reads on a phone.
 * `actions` switch body language on cue; `walk` is automatic while `path` is moving.
 * `mood` drives eyes/mouth. Face the camera with `facing` when standing still.
 */
export const Mo: React.FC<{
	path: Waypoint[];
	actions?: {at: number; do: MoAction}[];
	moods?: {at: number; mood: MoMood}[];
	scale?: number;
	facing?: number; // heading override (radians) while not walking
	shirt?: string;
}> = ({path, actions = [], moods = [], scale = 1, facing, shirt = SHIRT}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const pose = poseOnPath(frame, path);
	const current = [...actions].reverse().find((a) => frame >= a.at);
	const act: MoAction = pose.moving ? 'walk' : (current?.do ?? 'idle');
	const since = current ? frame - current.at : frame;
	const mood: MoMood = [...moods].reverse().find((m) => frame >= m.at)?.mood ?? 'happy';
	const t = frame / fps;

	// joint angles (radians); arm x: negative = raise forward; armLz/armRz: positive/negative = out to that side, sign flips inward
	let legL = 0;
	let legR = 0;
	let armL = 0.15;
	let armR = 0.15;
	let armLz = 0.18;
	let armRz = -0.18;
	let headTilt = 0;
	let headNod = 0;
	let bob = Math.sin(t * 2.2) * 0.012;
	let jump = 0;
	const ease = Math.min(1, since / 6);
	switch (act) {
		case 'walk': {
			const s = Math.sin(t * 11);
			legL = s * 0.6;
			legR = -s * 0.6;
			armL = -s * 0.5;
			armR = s * 0.5;
			bob = Math.abs(Math.cos(t * 11)) * 0.05;
			break;
		}
		case 'wave':
			armR = -0.45 * ease;
			armRz = -2.2 * ease + Math.sin(t * 14) * 0.35 * ease;
			headTilt = 0.12;
			break;
		case 'shrug':
			armLz = 0.18 + 0.9 * ease;
			armRz = -0.18 - 0.9 * ease;
			armL = armR = -0.5 * ease;
			headTilt = 0.25 * ease;
			break;
		case 'facepalm':
			armR = -2.2 * ease;
			armRz = 0.5 * ease; // inward, hand to face
			headNod = 0.35 * ease;
			break;
		case 'point':
			armR = -1.5 * ease;
			armRz = -0.1;
			break;
		case 'cheer':
			armLz = 2.7 * ease;
			armRz = -2.7 * ease;
			jump = Math.abs(Math.sin(t * 9)) * 0.18 * ease;
			break;
		case 'shock':
			armLz = 0.9 * ease;
			armRz = -0.9 * ease;
			armL = armR = -0.9 * ease;
			headNod = -0.15 * ease;
			jump = since < 8 ? Math.sin((since / 8) * Math.PI) * 0.12 : 0;
			break;
		case 'phone':
			armR = -1.9 * ease;
			armRz = 0.15;
			headNod = 0.3 * ease;
			break;
		case 'sit':
			legL = legR = -1.4;
			bob = -0.22;
			break;
	}

	const eyeH = mood === 'shock' ? 0.075 : mood === 'annoyed' ? 0.025 : 0.055;
	const blink = Math.floor(t * 10) % 37 === 0 ? 0.15 : 1;
	return (
		<group position={[pose.x, bob + jump, pose.z]} rotation={[0, pose.moving || facing === undefined ? pose.heading : facing, 0]} scale={scale}>
			{/* legs */}
			{[
				[-0.09, legL],
				[0.09, legR],
			].map(([x, rot], i) => (
				<group key={i} position={[x, 0.36, 0]} rotation={[rot, 0, 0]}>
					<mesh position={[0, -0.16, 0]}>
						<capsuleGeometry args={[0.065, 0.2, 4, 10]} />
						<meshStandardMaterial color={SHORTS} />
					</mesh>
					<mesh position={[0, -0.33, 0.04]}>
						<boxGeometry args={[0.12, 0.06, 0.2]} />
						<meshStandardMaterial color="#f5f5f5" />
					</mesh>
				</group>
			))}
			{/* body */}
			<mesh position={[0, 0.5, 0]}>
				<capsuleGeometry args={[0.16, 0.18, 6, 16]} />
				<meshStandardMaterial color={shirt} roughness={0.7} />
			</mesh>
			{/* arms (pivot at shoulder) */}
			{[
				[-0.2, armL, armLz],
				[0.2, armR, armRz],
			].map(([x, rx, rz], i) => (
				<group key={i} position={[x, 0.62, 0]} rotation={[rx, 0, -rz]}>
					<mesh position={[0, -0.13, 0]}>
						<capsuleGeometry args={[0.05, 0.16, 4, 10]} />
						<meshStandardMaterial color={shirt} roughness={0.7} />
					</mesh>
					<mesh position={[0, -0.27, 0]}>
						<sphereGeometry args={[0.055, 12, 12]} />
						<meshStandardMaterial color={SKIN} />
					</mesh>
				</group>
			))}
			{/* head */}
			<group position={[0, 0.88, 0]} rotation={[headNod, 0, headTilt]}>
				<mesh>
					<sphereGeometry args={[0.24, 24, 24]} />
					<meshStandardMaterial color={SKIN} roughness={0.8} />
				</mesh>
				{/* cap */}
				<mesh position={[0, 0.1, 0]} scale={[1, 0.6, 1]}>
					<sphereGeometry args={[0.25, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
					<meshStandardMaterial color={CAP} />
				</mesh>
				<mesh position={[0, 0.1, 0.2]} rotation={[0.25, 0, 0]}>
					<boxGeometry args={[0.3, 0.025, 0.18]} />
					<meshStandardMaterial color={CAP} />
				</mesh>
				{/* eyes */}
				{[-0.085, 0.085].map((x) => (
					<group key={x} position={[x, -0.01, 0.215]}>
						<mesh scale={[1, (eyeH / 0.055) * blink, 1]}>
							<sphereGeometry args={[0.042, 12, 12]} />
							<meshBasicMaterial color="#ffffff" />
						</mesh>
						<mesh position={[0, 0, 0.03]} scale={[1, (eyeH / 0.055) * blink, 1]}>
							<sphereGeometry args={[0.022, 10, 10]} />
							<meshBasicMaterial color="#111111" />
						</mesh>
					</group>
				))}
				{/* brows (annoyed / sad) */}
				{mood === 'annoyed' || mood === 'sad'
					? [-0.085, 0.085].map((x) => (
							<mesh key={x} position={[x, 0.07, 0.22]} rotation={[0, 0, (x < 0 ? 1 : -1) * (mood === 'annoyed' ? -0.4 : 0.4)]}>
								<boxGeometry args={[0.08, 0.016, 0.01]} />
								<meshBasicMaterial color="#3a2a1e" />
							</mesh>
						))
					: null}
				{/* mouth */}
				{mood === 'shock' ? (
					<mesh position={[0, -0.12, 0.215]}>
						<sphereGeometry args={[0.035, 12, 12]} />
						<meshBasicMaterial color="#5a1f1f" />
					</mesh>
				) : (
					<mesh position={[0, -0.11, 0.22]} rotation={[0, 0, mood === 'sad' || mood === 'annoyed' ? 0 : Math.PI]}>
						<torusGeometry args={[0.05, 0.012, 6, 16, Math.PI]} />
						<meshBasicMaterial color="#5a1f1f" />
					</mesh>
				)}
			</group>
		</group>
	);
};

export type CarKind = 'sedan' | 'suv' | 'taxi';
const TAXI_BODY = '#efe6cf';

/**
 * Low-poly toy car (≈ 1 unit long at scale 1). Wheels spin with distance, brake lights glow while slowing/stopped,
 * `blink` flashes hazards (e.g. "ticket expired"). Drive it along timed waypoints or place it statically with x/z/heading.
 */
export const ToyCar: React.FC<{
	path?: Waypoint[];
	x?: number;
	z?: number;
	heading?: number;
	color?: string;
	kind?: CarKind;
	scale?: number;
	braking?: boolean;
	blink?: {from: number; to?: number; color?: string};
	driver?: boolean;
}> = ({path, x = 0, z = 0, heading = 0, color = '#3f7cff', kind = 'sedan', scale = 1, braking, blink, driver = false}) => {
	const frame = useCurrentFrame();
	const pose = path ? poseOnPath(frame, path) : {x, z, heading, moving: false};
	const next = path ? poseOnPath(frame + 1, path) : pose;
	const speed = Math.hypot(next.x - pose.x, next.z - pose.z);
	const dist = path ? distanceAlong(frame, path) : 0;
	const brake = braking ?? !pose.moving;
	const blinking = blink && frame >= blink.from && (blink.to === undefined || frame < blink.to) && Math.floor((frame - blink.from) / 6) % 2 === 0;
	const body = kind === 'taxi' ? TAXI_BODY : color;
	const tall = kind === 'suv' ? 1.25 : 1;
	return (
		<group position={[pose.x, 0, pose.z]} rotation={[0, pose.heading, 0]} scale={scale}>
			<mesh position={[0, 0.22 * tall, 0]}>
				<boxGeometry args={[0.46, 0.2 * tall, 1]} />
				<meshStandardMaterial color={body} roughness={0.45} metalness={0.2} />
			</mesh>
			<mesh position={[0, 0.4 * tall, -0.06]}>
				<boxGeometry args={[0.4, 0.17 * tall, 0.52]} />
				<meshStandardMaterial color={kind === 'taxi' ? '#c0392b' : body} roughness={0.45} />
			</mesh>
			{/* windows */}
			<mesh position={[0, 0.41 * tall, -0.06]}>
				<boxGeometry args={[0.41, 0.12 * tall, 0.47]} />
				<meshStandardMaterial color="#1b2433" roughness={0.1} metalness={0.6} />
			</mesh>
			{driver ? (
				<mesh position={[0.09, 0.47 * tall, 0.02]}>
					<sphereGeometry args={[0.07, 12, 12]} />
					<meshStandardMaterial color={SKIN} />
				</mesh>
			) : null}
			{/* wheels */}
			{[
				[-0.24, 0.32],
				[0.24, 0.32],
				[-0.24, -0.32],
				[0.24, -0.32],
			].map(([wx, wz]) => (
				<mesh key={`${wx}${wz}`} position={[wx, 0.1, wz]} rotation={[dist / 0.1, 0, Math.PI / 2]}>
					<cylinderGeometry args={[0.1, 0.1, 0.07, 12]} />
					<meshStandardMaterial color="#15171c" />
				</mesh>
			))}
			{/* lights */}
			{[-0.15, 0.15].map((lx) => (
				<group key={lx}>
					<mesh position={[lx, 0.24 * tall, 0.505]}>
						<boxGeometry args={[0.1, 0.05, 0.01]} />
						<meshBasicMaterial color="#fff3c4" toneMapped={false} />
					</mesh>
					<mesh position={[lx, 0.24 * tall, -0.505]}>
						<boxGeometry args={[0.1, 0.05, 0.01]} />
						<meshBasicMaterial color={brake || speed < 0.001 ? '#ff2d2d' : '#7a1515'} toneMapped={false} />
					</mesh>
				</group>
			))}
			{blinking ? (
				<mesh position={[0, 0.62 * tall, 0]}>
					<sphereGeometry args={[0.07, 12, 12]} />
					<meshBasicMaterial color={blink?.color ?? '#ff3b30'} toneMapped={false} />
				</mesh>
			) : null}
		</group>
	);
};

/** Distance travelled along the path by `frame` (same easing as poseOnPath), for wheel spin. */
const distanceAlong = (frame: number, path: Waypoint[]) => {
	let d = 0;
	for (let i = 0; i + 1 < path.length; i++) {
		const a = path[i];
		const b = path[i + 1];
		const len = Math.hypot(b.x - a.x, b.z - a.z);
		if (frame >= b.at) d += len;
		else {
			if (frame > a.at) d += len * interpolate(frame, [a.at, b.at], [0, 1], {easing: Easing.inOut(Easing.quad)});
			break;
		}
	}
	return d;
};
