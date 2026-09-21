import type { ControlDefinition } from '../../reliability/ControlResolver.js';
export const uploadControls = {
 image: { id: 'image_upload', candidates: [{ strategy: 'testId', value: 'image-upload' }, { strategy: 'css', value: "input[type='file'][accept*='image']" }] },
 video: { id: 'video_upload', candidates: [{ strategy: 'testId', value: 'video-upload' }, { strategy: 'css', value: "input[type='file'][accept*='video']" }] },
 audio: { id: 'audio_upload', candidates: [{ strategy: 'testId', value: 'audio-upload' }, { strategy: 'css', value: "input[type='file'][accept*='audio']" }] },
} satisfies Record<string, ControlDefinition>;
