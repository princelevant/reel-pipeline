import {Config} from '@remotion/cli/config';

// Three.js needs a real GL backend in headless Chrome. On this Linux box (NVIDIA, no X display)
// 'angle' and 'egl' fail to create a context; 'angle-egl' (GPU) works and 'swangle' (CPU) is the
// slow fallback. On macOS use REMOTION_GL=angle.
type GL = Parameters<typeof Config.setChromiumOpenGlRenderer>[0];
Config.setChromiumOpenGlRenderer((process.env.REMOTION_GL as GL) ?? 'angle-egl');
Config.setVideoImageFormat('jpeg');
