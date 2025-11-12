import { convertToMp4, loadFfmpeg } from './ffmpeg-converter.js';

export class ReplayRecorder {
    constructor(canvas, audioManager, fps = 30) {
        this.canvas = canvas;
        this.audioManager = audioManager;
        this.chunks = [];
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordPromise = null;
        this.audioDestination = null;

        // Eagerly start loading ffmpeg
        loadFfmpeg((p) => {
            const message = p.message || `Encoding... ${Math.round(p.ratio * 100)}%`;
            console.log(message);
             if (this.onProgress) this.onProgress(message);
        });

        try {
            const videoStream = this.canvas.captureStream(fps);
            
            let combinedStream = videoStream;
            if (this.audioManager?.audioContext && this.audioManager?.masterGain) {
                this.audioDestination = this.audioManager.audioContext.createMediaStreamDestination();
                this.audioManager.masterGain.connect(this.audioDestination);
                
                const audioTrack = this.audioDestination.stream.getAudioTracks()[0];
                if (audioTrack) {
                    combinedStream = new MediaStream([
                        ...videoStream.getVideoTracks(),
                        audioTrack
                    ]);
                }
            }
            
            const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

            const mimeTypes = isFirefox 
            ? [
                'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8',
                'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9', 'video/webm',
            ] : [
                'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus',
                'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm',
            ];
            
            const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));

            if (!supportedMimeType) {
                console.error("No supported mimeType for MediaRecorder");
                return;
            }

            this.mediaRecorder = new MediaRecorder(combinedStream, {
                mimeType: supportedMimeType,
                videoBitsPerSecond: isFirefox ? undefined : 5000000,
            });

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.chunks.push(e.data);
            };

            this.recordPromise = new Promise((resolve, reject) => {
                this.mediaRecorder.onstop = async () => {
                    const webmBlob = new Blob(this.chunks, { type: supportedMimeType });
                    this.chunks = [];
                    
                    if (this.audioDestination && this.audioManager?.masterGain) {
                        this.audioManager.masterGain.disconnect(this.audioDestination);
                    }
                    
                    try {
                         if (this.onProgress) this.onProgress("Converting to MP4...");
                        const mp4Blob = await convertToMp4(webmBlob);
                        resolve(mp4Blob);
                    } catch (e) {
                        console.error("Failed to convert video", e);
                        reject(e);
                    }
                };
            });

            this.mediaRecorder.start();
            this.isRecording = true;
        } catch (e) {
            console.error("Error initializing MediaRecorder:", e);
        }
    }

    stop() {
        if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        this.isRecording = false;
    }

    async getReplayBlob() {
        if (!this.recordPromise) {
            return null;
        }
        return this.recordPromise;
    }
}