const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');

class VoiceHandler {
    constructor(config = {}, logger = console.log) {
        this.config = config;
        this.logger = logger;
        this.groqClient = null;
        this._initGroq();
    }

    _initGroq() {
        const apiKey = this.config.groqApiKey || process.env.GROQ_API_KEY;
        if (apiKey && apiKey.startsWith('gsk_')) {
            try {
                const Groq = require('groq-sdk');
                this.groqClient = new Groq({ apiKey });
                this.log('Groq SDK initialized for Speech-to-Text.');
            } catch (err) {
                this.log(`Failed to initialize Groq SDK: ${err.message}`);
            }
        }
    }

    setGroqApiKey(apiKey) {
        if (!apiKey) return;
        this.config.groqApiKey = apiKey;
        this._initGroq();
    }

    log(msg) {
        this.logger(`[VoiceHandler] ${msg}`);
    }

    /**
     * Download an audio file from Discord or Telegram URL to a local temporary path
     */
    async downloadAudio(url, destPath) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destPath);
            const client = url.startsWith('https') ? https : http;
            client.get(url, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return this.downloadAudio(res.headers.location, destPath).then(resolve).catch(reject);
                }
                if (res.statusCode !== 200) {
                    file.close();
                    fs.unlink(destPath, () => {});
                    return reject(new Error(`Failed to download audio: HTTP ${res.statusCode}`));
                }
                res.pipe(file);
                file.on('finish', () => {
                    file.close(() => resolve(destPath));
                });
            }).on('error', (err) => {
                file.close();
                fs.unlink(destPath, () => {});
                reject(err);
            });
        });
    }

    getFfmpegPath() {
        const candidates = [
            'ffmpeg',
            path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
            'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
            'C:\\ffmpeg\\bin\\ffmpeg.exe'
        ];
        for (const c of candidates) {
            try {
                if (c === 'ffmpeg') continue;
                if (fs.existsSync(c)) return c;
            } catch (e) {}
        }
        return 'ffmpeg';
    }

    /**
     * Convert any audio (ogg, opus, mp4, etc.) to 16kHz mono mp3 or wav using ffmpeg
     */
    async convertAudioToMp3(inputPath, outputPath) {
        return new Promise((resolve, reject) => {
            const ffmpegBin = this.getFfmpegPath();
            const ff = spawn(ffmpegBin, [
                '-y',
                '-i', inputPath,
                '-vn',
                '-ar', '16000',
                '-ac', '1',
                '-b:a', '64k',
                outputPath
            ], { windowsHide: true });

            let stderr = '';
            ff.stderr.on('data', d => stderr += d.toString());

            ff.on('close', (code) => {
                if (code === 0 && fs.existsSync(outputPath)) {
                    resolve(outputPath);
                } else {
                    reject(new Error(`FFmpeg conversion failed (code ${code}): ${stderr.slice(-200)}`));
                }
            });
            ff.on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)));
        });
    }

    /**
     * Transcribe audio file to text using Groq Whisper (or fallback)
     */
    async transcribe(audioPath, language = null) {
        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file not found: ${audioPath}`);
        }

        if (!this.groqClient) {
            throw new Error('Chưa cấu hình Groq API Key! Dùng `!setgroq <key>` hoặc cấu hình trong config.json.');
        }

        this.log(`Transcribing audio: ${path.basename(audioPath)} via Groq Whisper...`);
        const fileStream = fs.createReadStream(audioPath);

        const options = {
            file: fileStream,
            model: 'whisper-large-v3-turbo',
            response_format: 'json'
        };
        if (language) {
            options.language = language;
        }

        const response = await this.groqClient.audio.transcriptions.create(options);
        const text = response?.text?.trim() || '';
        this.log(`Transcription result: "${text}"`);
        return text;
    }

    /**
     * Text to Speech (TTS) using edge-tts or Edge neural voice
     */
    async textToSpeech(text, outputPath, voice = 'vi-VN-HoaiMyNeural') {
        return new Promise((resolve, reject) => {
            try {
                // Try edge-tts via command line if available or node module
                const ff = spawn('edge-tts', [
                    '--voice', voice,
                    '--text', text,
                    '--write-media', outputPath
                ], { windowsHide: true });

                ff.on('close', (code) => {
                    if (code === 0 && fs.existsSync(outputPath)) {
                        resolve(outputPath);
                    } else {
                        // If edge-tts CLI is not installed, fallback or fail gracefully
                        reject(new Error(`edge-tts exited with code ${code}`));
                    }
                });
                ff.on('error', (err) => {
                    reject(new Error(`edge-tts not installed globally (${err.message}).`));
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Helper to process an incoming audio attachment / voice message from Discord
     */
    async processDiscordVoice(attachment) {
        const ext = path.extname(attachment.name || attachment.filename || 'voice.ogg') || '.ogg';
        const tempDir = path.join(__dirname, '..', 'temp_audio');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const rawFile = path.join(tempDir, `discord_${Date.now()}${ext}`);
        const mp3File = path.join(tempDir, `discord_${Date.now()}.mp3`);

        try {
            await this.downloadAudio(attachment.url, rawFile);
            
            let fileToTranscribe = rawFile;
            try {
                // Attempt standard conversion to 16kHz mono mp3
                await this.convertAudioToMp3(rawFile, mp3File);
                if (fs.existsSync(mp3File)) fileToTranscribe = mp3File;
            } catch (convErr) {
                this.log(`FFmpeg conversion skipped/failed (${convErr.message}), uploading raw audio directly...`);
                fileToTranscribe = rawFile;
            }

            const text = await this.transcribe(fileToTranscribe);
            return text;
        } finally {
            // Cleanup temp files
            try { if (fs.existsSync(rawFile)) fs.unlinkSync(rawFile); } catch (e) {}
            try { if (fs.existsSync(mp3File)) fs.unlinkSync(mp3File); } catch (e) {}
        }
    }
}

module.exports = { VoiceHandler };
