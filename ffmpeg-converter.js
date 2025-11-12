import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg;
let ffmpegLoadingPromise;
const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

export async function loadFfmpeg(progressCallback) {
    if (ffmpeg) return ffmpeg;

    if (!ffmpegLoadingPromise) {
        ffmpegLoadingPromise = (async () => {
            if (progressCallback) progressCallback({ ratio: 0, message: "Loading FFmpeg core..." });
            
            ffmpeg = new FFmpeg();
            ffmpeg.on('log', ({ message }) => {
                console.log(message);
            });
            ffmpeg.on('progress', progressCallback);

            await ffmpeg.load({
                 coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                 wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                 workerURL: await toBlobURL(`https://esm.sh/@ffmpeg/ffmpeg@0.12.10/es2022/worker.js`, 'text/javascript')
            });
            
            if (progressCallback) progressCallback({ ratio: 0, message: "FFmpeg loaded." });
            return ffmpeg;
        })();
    }
    return ffmpegLoadingPromise;
}

export async function convertToMp4(webmBlob) {
    const ffmpegInstance = await loadFfmpeg();
    if (!ffmpegInstance.loaded) {
        throw new Error("FFmpeg not loaded");
    }
    console.log('Starting conversion to MP4');
    
    await ffmpegInstance.writeFile('input.webm', await fetchFile(webmBlob));
    
    // Using -preset ultrafast for quicker encoding. -c:v libx264 is essential for mp4.
    await ffmpegInstance.exec(['-i', 'input.webm', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', 'output.mp4']);
    
    const data = await ffmpegInstance.readFile('output.mp4');
    
    // Clean up the virtual file system
    await ffmpegInstance.deleteFile('input.webm');
    await ffmpegInstance.deleteFile('output.mp4');
    
    return new Blob([data.buffer], { type: 'video/mp4' });
}