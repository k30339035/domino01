/**
 * 도미노 텍스트 애니메이션 메인 애플리케이션
 */

class DominoApp {
    constructor() {
        // Three.js 기본 요소
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        // Cannon.js 물리 엔진
        this.world = null;
        this.dominoBodies = [];
        this.dominoMeshes = [];

        // 텍스트 변환기
        this.textConverter = new TextToDomino();

        // 상태
        this.isAnimating = false;
        this.isFalling = false;
        this.cameraFollowEnabled = true;
        this.slowMotionEnabled = false;

        // 카메라 추적
        this.cameraTarget = new THREE.Vector3();
        this.fallingDominoIndex = 0;

        // UI 요소
        this.initUIElements();

        // 초기화
        this.init();
        this.setupEventListeners();
        this.animate();
    }

    initUIElements() {
        this.elements = {
            textInput: document.getElementById('textInput'),
            createBtn: document.getElementById('createBtn'),
            toppleBtn: document.getElementById('toppleBtn'),
            resetBtn: document.getElementById('resetBtn'),
            cameraFollow: document.getElementById('cameraFollow'),
            slowMotion: document.getElementById('slowMotion'),
            dominoCount: document.getElementById('dominoCount'),
            status: document.getElementById('status'),
            loading: document.getElementById('loading')
        };
    }

    init() {
        // 씬 생성
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f4f8);
        this.scene.fog = new THREE.Fog(0xf0f4f8, 50, 200);

        // 카메라 설정
        const container = document.getElementById('canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        this.camera.position.set(0, 30, 50);
        this.camera.lookAt(0, 0, 0);

        // 렌더러 설정
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        // 조명 설정
        this.setupLights();

        // 바닥 생성
        this.createGround();

        // 물리 엔진 초기화
        this.initPhysics();

        // 윈도우 리사이즈 핸들러
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupLights() {
        // 환경광
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // 방향광 (그림자 생성)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(20, 40, 20);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // 보조광
        const fillLight = new THREE.DirectionalLight(0x88ccff, 0.3);
        fillLight.position.set(-20, 20, -20);
        this.scene.add(fillLight);
    }

    createGround() {
        // 바닥 메시
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0xe8eef5,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // 그리드 헬퍼
        const gridHelper = new THREE.GridHelper(200, 50, 0xccddee, 0xddeeee);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);

        // 물리 바닥
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({
            mass: 0,
            shape: groundShape
        });
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.world.addBody(groundBody);
    }

    initPhysics() {
        // Cannon.js 월드 생성
        this.world = new CANNON.World();
        this.world.gravity.set(0, -30, 0); // 중력
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 10;
        this.world.defaultContactMaterial.friction = 0.4;
        this.world.defaultContactMaterial.restitution = 0.3;
    }

    createDomino(position, index) {
        const width = 0.3;
        const height = 2;
        const depth = 1;

        // Three.js 메시
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: this.getDominoColor(index),
            roughness: 0.5,
            metalness: 0.1
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.position.y = height / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        // Cannon.js 바디
        const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
        const body = new CANNON.Body({
            mass: 1,
            shape: shape,
            material: new CANNON.Material()
        });
        body.position.copy(position);
        body.position.y = height / 2;
        this.world.addBody(body);

        this.dominoMeshes.push(mesh);
        this.dominoBodies.push(body);

        return { mesh, body };
    }

    getDominoColor(index) {
        // 그라디언트 색상
        const colors = [
            0x667eea, // 보라-파랑
            0x764ba2, // 보라
            0x6366f1, // 인디고
            0x8b5cf6, // 퍼플
            0xa78bfa  // 연보라
        ];
        return colors[index % colors.length];
    }

    async createDominosFromText(text) {
        if (!text || text.trim().length === 0) {
            alert('텍스트를 입력해주세요!');
            return;
        }

        this.showLoading(true);
        this.updateStatus('도미노 생성 중...');

        // 기존 도미노 제거
        this.clearDominos();

        // 약간의 딜레이 (UI 업데이트를 위해)
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            // 텍스트를 도미노 좌표로 변환
            const coordinates = this.textConverter.textToCoordinates(text, 48);

            if (coordinates.length === 0) {
                alert('도미노를 생성할 수 없습니다. 다른 텍스트를 입력해주세요.');
                return;
            }

            // 연결성 추가
            const connectedCoords = this.textConverter.addConnections(coordinates);

            // 도미노 생성
            connectedCoords.forEach((coord, index) => {
                this.createDomino(
                    new THREE.Vector3(coord.x, coord.y, coord.z),
                    index
                );
            });

            // 통계 업데이트
            const stats = this.textConverter.getStatistics(connectedCoords);
            this.updateDominoCount(stats.count);

            // 카메라 위치 조정
            this.adjustCameraToFit(stats);

            // UI 업데이트
            this.elements.toppleBtn.disabled = false;
            this.updateStatus('준비 완료');

        } catch (error) {
            console.error('도미노 생성 오류:', error);
            alert('도미노 생성 중 오류가 발생했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    adjustCameraToFit(stats) {
        const { center, bounds } = stats;
        const width = bounds.maxX - bounds.minX;
        const depth = bounds.maxZ - bounds.minZ;
        const maxDim = Math.max(width, depth);

        // 카메라 거리 계산
        const distance = maxDim * 1.5 + 30;

        this.camera.position.set(
            center.x,
            distance * 0.5,
            center.z + distance
        );
        this.camera.lookAt(center.x, 0, center.z);

        // 카메라 타겟 설정
        this.cameraTarget.set(center.x, 0, center.z);
    }

    toppleDominos() {
        if (this.dominoBodies.length === 0) return;

        this.isFalling = true;
        this.fallingDominoIndex = 0;
        this.updateStatus('도미노 쓰러지는 중...');
        this.elements.toppleBtn.disabled = true;

        // 첫 번째 도미노에 힘을 가함
        const firstDomino = this.dominoBodies[0];
        const impulse = new CANNON.Vec3(0, 0, -8);
        const worldPoint = new CANNON.Vec3(
            firstDomino.position.x,
            firstDomino.position.y + 1,
            firstDomino.position.z
        );
        firstDomino.applyImpulse(impulse, worldPoint);
    }

    clearDominos() {
        // Three.js 메시 제거
        this.dominoMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });

        // Cannon.js 바디 제거
        this.dominoBodies.forEach(body => {
            this.world.removeBody(body);
        });

        this.dominoMeshes = [];
        this.dominoBodies = [];
        this.isFalling = false;
        this.fallingDominoIndex = 0;

        this.updateDominoCount(0);
        this.elements.toppleBtn.disabled = true;
    }

    updatePhysics() {
        if (this.dominoBodies.length === 0) return;

        // 물리 시뮬레이션 업데이트
        const timeStep = this.slowMotionEnabled ? 1 / 120 : 1 / 60;
        this.world.step(timeStep);

        // 메시 위치를 바디와 동기화
        for (let i = 0; i < this.dominoBodies.length; i++) {
            const body = this.dominoBodies[i];
            const mesh = this.dominoMeshes[i];

            mesh.position.copy(body.position);
            mesh.quaternion.copy(body.quaternion);
        }

        // 카메라 추적
        if (this.isFalling && this.cameraFollowEnabled) {
            this.updateCameraFollow();
        }
    }

    updateCameraFollow() {
        // 쓰러지고 있는 도미노 찾기
        for (let i = this.fallingDominoIndex; i < this.dominoBodies.length; i++) {
            const body = this.dominoBodies[i];

            // 도미노가 기울어졌는지 확인
            const angle = this.getDominoAngle(body);
            if (angle > 0.3) { // 약 17도 이상 기울어짐
                this.fallingDominoIndex = i;
                break;
            }
        }

        // 현재 쓰러지고 있는 도미노 위치로 카메라 이동
        if (this.fallingDominoIndex < this.dominoBodies.length) {
            const targetBody = this.dominoBodies[this.fallingDominoIndex];
            this.cameraTarget.lerp(
                new THREE.Vector3(targetBody.position.x, targetBody.position.y, targetBody.position.z),
                0.05
            );

            // 카메라 위치 부드럽게 이동
            const offset = new THREE.Vector3(0, 15, 25);
            const desiredPosition = this.cameraTarget.clone().add(offset);

            this.camera.position.lerp(desiredPosition, 0.03);
            this.camera.lookAt(this.cameraTarget);
        }
    }

    getDominoAngle(body) {
        // 쿼터니언을 오일러 각도로 변환
        const euler = new CANNON.Vec3();
        body.quaternion.toEuler(euler);
        return Math.abs(euler.x) + Math.abs(euler.z);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.updatePhysics();
        this.renderer.render(this.scene, this.camera);
    }

    setupEventListeners() {
        // 도미노 생성 버튼
        this.elements.createBtn.addEventListener('click', () => {
            const text = this.elements.textInput.value.trim();
            this.createDominosFromText(text);
        });

        // 엔터 키로도 생성
        this.elements.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const text = this.elements.textInput.value.trim();
                this.createDominosFromText(text);
            }
        });

        // 도미노 쓰러뜨리기 버튼
        this.elements.toppleBtn.addEventListener('click', () => {
            this.toppleDominos();
        });

        // 초기화 버튼
        this.elements.resetBtn.addEventListener('click', () => {
            this.clearDominos();
            this.elements.textInput.value = '';
            this.updateStatus('대기 중');

            // 카메라 초기 위치로
            this.camera.position.set(0, 30, 50);
            this.camera.lookAt(0, 0, 0);
        });

        // 카메라 추적 토글
        this.elements.cameraFollow.addEventListener('change', (e) => {
            this.cameraFollowEnabled = e.target.checked;
        });

        // 슬로우 모션 토글
        this.elements.slowMotion.addEventListener('change', (e) => {
            this.slowMotionEnabled = e.target.checked;
        });
    }

    onWindowResize() {
        const container = document.getElementById('canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    // UI 업데이트 메서드
    updateDominoCount(count) {
        this.elements.dominoCount.textContent = count;
    }

    updateStatus(status) {
        this.elements.status.textContent = status;
    }

    showLoading(show) {
        if (show) {
            this.elements.loading.classList.remove('hidden');
        } else {
            this.elements.loading.classList.add('hidden');
        }
    }
}

// 앱 초기화
window.addEventListener('DOMContentLoaded', () => {
    const app = new DominoApp();
});
