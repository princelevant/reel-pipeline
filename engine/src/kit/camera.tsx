import {useThree} from '@react-three/fiber';
import {useLayoutEffect, useMemo} from 'react';
import {Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import {PerspectiveCamera, Vector3} from 'three';

export type V3 = [number, number, number];

export type Shot = {
	/** frame the move towards this pose STARTS (usually a cue()) */
	at: number;
	/** travel time in frames (reference glides are 30–75) */
	dur?: number;
	pos: V3;
	look: V3;
	fov?: number;
	/** extra height at mid-travel, for "lift up and over" moves */
	arc?: number;
	/** slow push-in while holding, world units per second towards `look` (never a dead-still frame) */
	drift?: number;
};

export type Pose = {pos: V3; look: V3; fov: number};

const ease = Easing.bezier(0.65, 0, 0.35, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const drifted = (s: Shot, held: number, fps: number): V3 => {
	const d = ((s.drift ?? 0.6) * held) / fps;
	const dir = new Vector3(...s.look).sub(new Vector3(...s.pos));
	const len = dir.length();
	if (len < 1e-6) return s.pos;
	// never push closer than 35% of the original distance
	dir.multiplyScalar(Math.min(d, len * 0.65) / len);
	return [s.pos[0] + dir.x, s.pos[1] + dir.y, s.pos[2] + dir.z];
};

export type CameraMove = {start: number; dur: number};
/** Pose at a frame, plus the list of glides (so sound can follow the camera without restating it). */
export type CameraPath = ((frame: number) => Pose) & {moves: CameraMove[]};

/**
 * One continuous camera: no cuts, only glides between poses, with drift while holding.
 * Pure function of the frame so HTML overlays can project world points with the same pose.
 */
export const cameraPath = (shots: Shot[], fps: number): CameraPath => {
	const sorted = [...shots].sort((a, b) => a.at - b.at);
	const DEFAULT_FOV = 40;
	const poseAt = (frame: number): Pose => {
		let i = 0;
		while (i + 1 < sorted.length && sorted[i + 1].at <= frame) i++;
		const s = sorted[i];
		const dur = s.dur ?? 45;
		if (i === 0 || frame >= s.at + dur) {
			const arrived = i === 0 ? s.at : s.at + dur;
			return {pos: drifted(s, Math.max(0, frame - arrived), fps), look: s.look, fov: s.fov ?? DEFAULT_FOV};
		}
		const from = poseAt(s.at - 1);
		const t = ease(Math.min(1, Math.max(0, (frame - s.at) / dur)));
		const pos = lerp3(from.pos, s.pos, t);
		pos[1] += Math.sin(Math.PI * t) * (s.arc ?? 0);
		return {pos, look: lerp3(from.look, s.look, t), fov: lerp(from.fov, s.fov ?? DEFAULT_FOV, t)};
	};
	return Object.assign(poseAt, {moves: sorted.slice(1).map((s) => ({start: s.at, dur: s.dur ?? 45}))});
};

/** Drives the R3F default camera from a cameraPath. Place inside <ThreeCanvas>. */
export const CameraRig: React.FC<{path: CameraPath}> = ({path}) => {
	const frame = useCurrentFrame();
	const camera = useThree((s) => s.camera) as PerspectiveCamera;
	useLayoutEffect(() => {
		const p = path(frame);
		camera.position.set(...p.pos);
		camera.fov = p.fov;
		camera.near = 0.1;
		camera.far = 2000;
		camera.lookAt(...p.look);
		camera.updateProjectionMatrix();
	}, [frame, path, camera]);
	return null;
};

/** Project world points to screen pixels with the same pose the 3D camera uses this frame. */
export const useProjector = (path: CameraPath) => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	return useMemo(() => {
		const p = path(frame);
		const cam = new PerspectiveCamera(p.fov, width / height, 0.1, 2000);
		cam.position.set(...p.pos);
		cam.lookAt(...p.look);
		cam.updateMatrixWorld();
		cam.updateProjectionMatrix();
		return (world: V3) => {
			const v = new Vector3(...world).project(cam);
			return {x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height, visible: v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2};
		};
	}, [frame, path, width, height]);
};
