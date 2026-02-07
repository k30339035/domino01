/**
 * Web Audio API 기반 사운드 시스템
 */
class SoundSystem {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.masterVolume = 0.3;
        this.initAudioContext();
    }

    initAudioContext() {
        try {
            // 사용자 인터랙션 후 AudioContext 생성
            window.addEventListener('click', () => {
                if (!this.audioContext) {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    console.log('AudioContext initialized');
                }
            }, { once: true });
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
        }
    }

    ensureAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    /**
     * 도미노 쓰러지는 소리 (타악기 효과)
     */
    playDominoFall(pitch = 1.0, volume = 1.0) {
        if (!this.enabled || !this.audioContext) return;

        try {
            this.ensureAudioContext();

            const now = this.audioContext.currentTime;
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();

            // 타악기 사운드 설정
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(150 * pitch, now);
            oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.1);

            // 필터로 소리 다듬기
            filter.type = 'lowpass';
            filter.frequency.value = 800;
            filter.Q.value = 1;

            // 볼륨 엔벨로프 (빠르게 감소)
            const finalVolume = this.masterVolume * volume * 0.15;
            gainNode.gain.setValueAtTime(finalVolume, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            // 연결
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // 재생
            oscillator.start(now);
            oscillator.stop(now + 0.2);

        } catch (error) {
            console.warn('Sound playback error:', error);
        }
    }

    /**
     * 도미노 충돌 소리 (클릭 사운드)
     */
    playDominoCollision(intensity = 1.0) {
        if (!this.enabled || !this.audioContext) return;

        try {
            this.ensureAudioContext();

            const now = this.audioContext.currentTime;
            const noise = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();

            // 노이즈 버퍼 생성 (화이트 노이즈)
            const bufferSize = this.audioContext.sampleRate * 0.05; // 50ms
            const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const data = buffer.getChannelData(0);

            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            noise.buffer = buffer;

            // 필터로 클릭 사운드 만들기
            filter.type = 'highpass';
            filter.frequency.value = 1000;

            // 볼륨
            const finalVolume = this.masterVolume * intensity * 0.08;
            gainNode.gain.setValueAtTime(finalVolume, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

            // 연결
            noise.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // 재생
            noise.start(now);

        } catch (error) {
            console.warn('Collision sound error:', error);
        }
    }

    /**
     * 버튼 클릭 소리
     */
    playClick() {
        if (!this.enabled || !this.audioContext) return;

        try {
            this.ensureAudioContext();

            const now = this.audioContext.currentTime;
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, now);
            oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.05);

            gainNode.gain.setValueAtTime(this.masterVolume * 0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.start(now);
            oscillator.stop(now + 0.05);

        } catch (error) {
            console.warn('Click sound error:', error);
        }
    }

    /**
     * 생성 완료 소리 (성공 사운드)
     */
    playSuccess() {
        if (!this.enabled || !this.audioContext) return;

        try {
            this.ensureAudioContext();

            const now = this.audioContext.currentTime;

            // 2개의 톤으로 화음 만들기
            [523.25, 659.25].forEach((freq, index) => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();

                oscillator.type = 'sine';
                oscillator.frequency.value = freq;

                const delay = index * 0.08;
                gainNode.gain.setValueAtTime(0, now + delay);
                gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.15, now + delay + 0.05);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.3);

                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                oscillator.start(now + delay);
                oscillator.stop(now + delay + 0.3);
            });

        } catch (error) {
            console.warn('Success sound error:', error);
        }
    }

    /**
     * 연속 도미노 사운드 (체인 반응)
     */
    playChain(index, total) {
        if (!this.enabled || !this.audioContext) return;

        // 진행도에 따라 피치 변화
        const progress = index / Math.max(total, 1);
        const pitch = 0.8 + progress * 0.4; // 0.8 ~ 1.2
        const volume = 0.5 + Math.sin(progress * Math.PI) * 0.5; // 중간에 강조

        this.playDominoFall(pitch, volume);
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        console.log('Sound enabled:', enabled);
    }

    setVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
    }
}
