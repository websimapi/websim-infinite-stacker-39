import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

let ffmpeg;
let ffmpegLoadingPromise;

export async function loadFfmpeg(progressCallback) {
    if (ffmpeg) return ffmpeg;

    if (!ffmpegLoadingPromise) {
        ffmpegLoadingPromise = (async () => {
            console.log('Loading ffmpeg-core.js');
            if (progressCallback) progressCallback({ ratio: 0, message: "Loading FFmpeg core..." });
            
            ffmpeg = createFFmpeg({
                log: true,
                progress: progressCallback
            });

            await ffmpeg.load();
            if (progressCallback) progressCallback({ ratio: 0, message: "FFmpeg loaded." });
            return ffmpeg;
        })();
    }
    return ffmpegLoadingPromise;
}

export async function convertToMp4(webmBlob) {
    const ffmpegInstance = await loadFfmpeg();
    if (!ffmpegInstance.isLoaded()) {
        await ffmpegInstance.load();
    }
    console.log('Starting conversion to MP4');
    ffmpegInstance.FS('writeFile', 'input.webm', await fetchFile(webmBlob));
    
    // Using -preset ultrafast for quicker encoding. -c:v libx264 is essential for mp4.
    await ffmpegInstance.run('-i', 'input.webm', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', 'output.mp4');
    
    const data = ffmpegInstance.FS('readFile', 'output.mp4');
    
    // Clean up the virtual file system
    ffmpegInstance.FS('unlink', 'input.webm');
    ffmpegInstance.FS('unlink', 'output.mp4');
    
    return new Blob([data.buffer], { type: 'video/mp4' });
}