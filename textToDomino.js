/**
 * 텍스트를 도미노 좌표로 변환하는 유틸리티
 */
class TextToDomino {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.dominoSpacing = 0.8; // 도미노 간격
    }

    /**
     * 한글 텍스트를 도미노 좌표 배열로 변환
     * @param {string} text - 변환할 텍스트
     * @param {number} resolution - 해상도 (높을수록 더 많은 도미노)
     * @returns {Array} 도미노 좌표 배열 [{x, y, z}, ...]
     */
    textToCoordinates(text, resolution = 32) {
        if (!text || text.trim().length === 0) {
            return [];
        }

        // 캔버스 크기 설정
        const fontSize = resolution;
        const padding = Math.floor(fontSize * 0.3);

        this.ctx.font = `bold ${fontSize}px "Noto Sans KR", Arial, sans-serif`;

        // 텍스트 너비 측정
        const textMetrics = this.ctx.measureText(text);
        const textWidth = Math.ceil(textMetrics.width);
        const textHeight = fontSize;

        // 캔버스 크기 설정 (여백 포함)
        this.canvas.width = textWidth + padding * 2;
        this.canvas.height = textHeight + padding * 2;

        // 배경 클리어
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 텍스트 스타일 재설정 (캔버스 크기 변경 시 리셋됨)
        this.ctx.font = `bold ${fontSize}px "Noto Sans KR", Arial, sans-serif`;
        this.ctx.fillStyle = 'black';
        this.ctx.textBaseline = 'top';
        this.ctx.textAlign = 'left';

        // 텍스트 렌더링
        this.ctx.fillText(text, padding, padding);

        // 픽셀 데이터 가져오기
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const pixels = imageData.data;

        // 픽셀을 도미노 좌표로 변환
        const coordinates = [];
        const samplingRate = 2; // 픽셀 샘플링 비율 (높을수록 적은 도미노)

        for (let y = 0; y < this.canvas.height; y += samplingRate) {
            for (let x = 0; x < this.canvas.width; x += samplingRate) {
                const index = (y * this.canvas.width + x) * 4;
                const alpha = pixels[index + 3];

                // 알파값이 임계값 이상이면 도미노 배치
                if (alpha > 128) {
                    coordinates.push({
                        x: (x - this.canvas.width / 2) * this.dominoSpacing,
                        y: 0,
                        z: (y - this.canvas.height / 2) * this.dominoSpacing
                    });
                }
            }
        }

        return this.optimizeDominoPath(coordinates);
    }

    /**
     * 도미노 좌표를 최적화하여 연쇄 반응이 잘 일어나도록 정렬
     * @param {Array} coordinates - 원본 좌표 배열
     * @returns {Array} 최적화된 좌표 배열
     */
    optimizeDominoPath(coordinates) {
        if (coordinates.length === 0) return [];

        // Z축 기준으로 정렬 (위에서 아래로)
        // 같은 Z값이면 X축 기준 정렬 (왼쪽에서 오른쪽으로)
        coordinates.sort((a, b) => {
            if (Math.abs(a.z - b.z) < 0.1) {
                return a.x - b.x;
            }
            return a.z - b.z;
        });

        return coordinates;
    }

    /**
     * 도미노 경로에 연결선 추가 (빈 공간을 메우기 위한 추가 도미노)
     * @param {Array} coordinates - 좌표 배열
     * @returns {Array} 연결된 좌표 배열
     */
    addConnections(coordinates) {
        const connected = [...coordinates];
        const maxGap = 2.5; // 최대 허용 간격

        for (let i = 0; i < coordinates.length - 1; i++) {
            const current = coordinates[i];
            const next = coordinates[i + 1];

            const dx = next.x - current.x;
            const dz = next.z - current.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            // 간격이 너무 크면 중간에 도미노 추가
            if (distance > maxGap) {
                const steps = Math.ceil(distance / this.dominoSpacing);
                for (let step = 1; step < steps; step++) {
                    const t = step / steps;
                    connected.push({
                        x: current.x + dx * t,
                        y: 0,
                        z: current.z + dz * t
                    });
                }
            }
        }

        return this.optimizeDominoPath(connected);
    }

    /**
     * 한글 자모 분해 (초성, 중성, 종성)
     * @param {string} char - 한글 문자
     * @returns {Object} {cho, jung, jong}
     */
    decomposeHangul(char) {
        const code = char.charCodeAt(0);

        // 한글 유니코드 범위 체크
        if (code < 0xAC00 || code > 0xD7A3) {
            return null;
        }

        const base = code - 0xAC00;
        const cho = Math.floor(base / 588);
        const jung = Math.floor((base % 588) / 28);
        const jong = base % 28;

        return { cho, jung, jong };
    }

    /**
     * 텍스트의 각 글자를 개별적으로 도미노로 변환 (초성부터 완성까지 단계별)
     * @param {string} text - 변환할 텍스트
     * @param {number} resolution - 해상도
     * @returns {Array} 단계별 도미노 데이터
     */
    textToStages(text, resolution = 32) {
        const stages = [];
        let offsetX = 0;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // 각 글자를 도미노로 변환
            const charCoords = this.textToCoordinates(char, resolution);

            // X축 오프셋 적용
            const adjustedCoords = charCoords.map(coord => ({
                x: coord.x + offsetX,
                y: coord.y,
                z: coord.z
            }));

            stages.push({
                char: char,
                coordinates: adjustedCoords,
                index: i
            });

            // 다음 글자를 위한 오프셋 계산
            if (charCoords.length > 0) {
                const maxX = Math.max(...charCoords.map(c => c.x));
                offsetX = offsetX + maxX + resolution * this.dominoSpacing * 2;
            }
        }

        return stages;
    }

    /**
     * 여러 단계의 좌표를 하나로 병합
     * @param {Array} stages - 단계별 데이터
     * @returns {Array} 병합된 좌표 배열
     */
    mergeStages(stages) {
        let allCoordinates = [];

        stages.forEach(stage => {
            allCoordinates = allCoordinates.concat(stage.coordinates);
        });

        return allCoordinates;
    }

    /**
     * 도미노 통계 정보
     * @param {Array} coordinates - 좌표 배열
     * @returns {Object} 통계 정보
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
            }
        };
    }
}
