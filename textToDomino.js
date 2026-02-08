/**
 * 텍스트를 도미노 좌표로 변환하는 유틸리티 (개선 버전)
 */
export class TextToDomino {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.dominoSpacing = 1.0; // 도미노 간격
        this.debug = true;
    }

    /**
     * 한글 텍스트를 도미노 좌표 배열로 변환
     * @param {string} text - 변환할 텍스트
     * @param {number} fontSize - 폰트 크기
     * @returns {Array} 도미노 좌표 배열 [{x, y, z, rotation}, ...]
     */
    textToCoordinates(text, fontSize = 60) {
        if (!text || text.trim().length === 0) {
            console.warn('Empty text provided');
            return [];
        }

        console.log(`Converting text: "${text}" with fontSize: ${fontSize}`);

        // 폰트 설정
        const fontWeight = 'bold';
        const fontFamily = "'Noto Sans KR', Arial, sans-serif";
        this.ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        this.ctx.textBaseline = 'middle';
        this.ctx.textAlign = 'left';

        // 텍스트 크기 측정
        const metrics = this.ctx.measureText(text);
        const textWidth = Math.ceil(metrics.width);
        const textHeight = fontSize * 1.5;

        // 캔버스 크기 설정
        const padding = Math.ceil(fontSize * 0.5);
        this.canvas.width = textWidth + padding * 2;
        this.canvas.height = textHeight + padding * 2;

        console.log(`Canvas size: ${this.canvas.width}x${this.canvas.height}`);

        // 배경을 흰색으로
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 텍스트 스타일 재설정 (캔버스 크기 변경 시 리셋됨)
        this.ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        this.ctx.textBaseline = 'middle';
        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = 'black';

        // 텍스트 렌더링
        const x = padding;
        const y = this.canvas.height / 2;
        this.ctx.fillText(text, x, y);

        // 디버그: 캔버스를 데이터 URL로 출력
        if (this.debug) {
            const dataUrl = this.canvas.toDataURL();
            console.log('Canvas rendered. Preview:', dataUrl.substring(0, 100) + '...');
        }

        // 픽셀 데이터 가져오기
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const pixels = imageData.data;

        // 픽셀을 도미노 좌표로 변환
        const coordinates = [];
        const samplingRate = Math.max(1, Math.floor(fontSize / 30)); // 동적 샘플링

        console.log(`Sampling rate: ${samplingRate}`);

        let pixelCount = 0;
        for (let y = 0; y < this.canvas.height; y += samplingRate) {
            for (let x = 0; x < this.canvas.width; x += samplingRate) {
                const index = (y * this.canvas.width + x) * 4;
                const r = pixels[index];
                const g = pixels[index + 1];
                const b = pixels[index + 2];
                const a = pixels[index + 3];

                // 검은색 픽셀 감지 (텍스트 부분)
                const brightness = (r + g + b) / 3;
                if (a > 128 && brightness < 200) {
                    pixelCount++;

                    // 3D 좌표로 변환
                    const worldX = (x - this.canvas.width / 2) * this.dominoSpacing * 0.15;
                    const worldZ = (y - this.canvas.height / 2) * this.dominoSpacing * 0.15;

                    coordinates.push({
                        x: worldX,
                        y: 0,
                        z: worldZ,
                        rotation: 0
                    });
                }
            }
        }

        console.log(`Detected ${pixelCount} pixels, created ${coordinates.length} coordinates`);

        if (coordinates.length === 0) {
            console.error('No coordinates generated! Check font rendering.');
            return [];
        }

        // 좌표 최적화 (경로 정렬)
        const optimized = this.optimizePath(coordinates);
        console.log(`Optimized to ${optimized.length} dominoes`);

        return optimized;
    }

    /**
     * 도미노 경로 최적화 - Z축 우선, 같은 행에서는 X축 정렬
     */
    optimizePath(coordinates) {
        if (coordinates.length === 0) return [];

        // Z축(위에서 아래), X축(왼쪽에서 오른쪽) 순서로 정렬
        coordinates.sort((a, b) => {
            const zDiff = a.z - b.z;
            if (Math.abs(zDiff) < 0.5) {
                return a.x - b.x;
            }
            return zDiff;
        });

        // 각 도미노의 회전 계산 (다음 도미노를 향하도록)
        for (let i = 0; i < coordinates.length - 1; i++) {
            const current = coordinates[i];
            const next = coordinates[i + 1];

            const dx = next.x - current.x;
            const dz = next.z - current.z;

            // 다음 도미노를 향한 각도 계산
            current.rotation = Math.atan2(dx, dz);
        }

        // 마지막 도미노는 이전 도미노와 같은 방향
        if (coordinates.length > 1) {
            coordinates[coordinates.length - 1].rotation =
                coordinates[coordinates.length - 2].rotation;
        }

        return coordinates;
    }

    /**
     * 도미노 사이의 간격이 너무 크면 중간에 도미노 추가
     */
    fillGaps(coordinates, maxGap = 3.0) {
        if (coordinates.length === 0) return coordinates;

        const filled = [coordinates[0]];

        for (let i = 1; i < coordinates.length; i++) {
            const prev = coordinates[i - 1];
            const current = coordinates[i];

            const dx = current.x - prev.x;
            const dz = current.z - prev.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance > maxGap) {
                // 중간에 도미노 추가
                const steps = Math.ceil(distance / (maxGap * 0.7));
                for (let step = 1; step < steps; step++) {
                    const t = step / steps;
                    filled.push({
                        x: prev.x + dx * t,
                        y: 0,
                        z: prev.z + dz * t,
                        rotation: Math.atan2(dx, dz)
                    });
                }
            }

            filled.push(current);
        }

        console.log(`Gap filling: ${coordinates.length} -> ${filled.length} dominoes`);
        return filled;
    }

    /**
     * 통계 정보
     */
    getStatistics(coordinates) {
        if (coordinates.length === 0) {
            return {
                count: 0,
                bounds: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 },
                center: { x: 0, z: 0 }
            };
        }

        const xs = coordinates.map(c => c.x);
        const zs = coordinates.map(c => c.z);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minZ = Math.min(...zs);
        const maxZ = Math.max(...zs);

        return {
            count: coordinates.length,
            bounds: { minX, maxX, minZ, maxZ },
            center: {
                x: (minX + maxX) / 2,
                z: (minZ + maxZ) / 2
            },
            width: maxX - minX,
            depth: maxZ - minZ
        };
    }

    /**
     * 디버그 정보 문자열 생성
     */
    getDebugInfo(coordinates) {
        const stats = this.getStatistics(coordinates);
        return `
도미노 개수: ${stats.count}
영역 크기: ${stats.width.toFixed(1)} x ${stats.depth.toFixed(1)}
중심점: (${stats.center.x.toFixed(1)}, ${stats.center.z.toFixed(1)})
범위 X: ${stats.bounds.minX.toFixed(1)} ~ ${stats.bounds.maxX.toFixed(1)}
범위 Z: ${stats.bounds.minZ.toFixed(1)} ~ ${stats.bounds.maxZ.toFixed(1)}
        `.trim();
    }
}
