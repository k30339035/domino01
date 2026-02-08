/**
 * 도미노 텍스트 애니메이션 메인 애플리케이션 (완전 재작성 버전)
 */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TextToDomino } from './textToDomino.js';
import { SoundSystem } from './sounds.js';

class DominoApp {
    constructor() {
        console.log('DominoApp initializing...');

        // Three.js 기본 요소
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;

        // Cannon-es 물리 엔진
        this.world = null;
        this.dominoBodies = [];
        this.dominoMeshes = [];
        this.groundBody = null;

        // 유틸리티
        this.textConverter = new TextToDomino();
        this.soundSystem = new SoundSystem();

        // 상태
        this.isAnimating = false;
        this.isFalling = false;
        this.cameraFollowEnabled = true;
        this.slowMotionEnabled = false;
        this.currentText = '';

        // 카메라 추적
        this.cameraTarget = new THREE.Vector3();
        this.cameraOffset = new THREE.Vector3(0, 20, 30);
        this.fallingDominoIndex = 0;
        this.lastFallenIndex = -1;

        // UI 요소
        this.initUIElements();

        // 초기화
        this.init();
        this.setupEventListeners();
        this.animate();

        console.log('DominoApp initialized successfully!');
    }

    initUIElements() {
        this.elements = {
            textInput: document.getElementById('textInput'),
            createBtn: document.getElementById('createBtn'),
            toppleBtn: document.getElementById('toppleBtn'),
            resetBtn: document.getElementById('resetBtn'),
            cameraFollow: document.getElementById('cameraFollow'),
            slowMotion: document.getElementById('slowMotion'),
            soundEnabled: document.getElementById('soundEnabled'),
            dominoCount: document.getElementById('dominoCount'),
            status: document.getElementById('status'),
            loading: document.getElementById('loading'),
            debugInfo: document.getElementById('debugInfo')
        };
    }

    init() {
        console.log('Initializing scene...');

        // 씬 생성
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xe0e7ff);
        this.scene.fog = new THREE.Fog(0xe0e7ff, 50, 300);

        // 카메라 설정
        const container = document.getElementById('canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        this.camera.position.set(0, 25, 40);
        this.camera.lookAt(0, 0, 0);

        // 렌더러 설정
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        container.appendChild(this.renderer.domElement);

        // 조명 설정
        this.setupLights();

        // 바닥 생성
        this.createGround();

        // 물리 엔진 초기화
        this.initPhysics();

        // 윈도우 리사이즈 핸들러
        window.addEventListener('resize', () => this.onWindowResize());

        console.log('Scene initialized');
    }

    setupLights() {
        // 환경광
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        // 방향광 (그림자 생성)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(30, 50, 30);
        directionalLight.castShadow = true;

        // 그림자 맵 설정
        directionalLight.shadow.camera.left = -60;
        directionalLight.shadow.camera.right = 60;
        directionalLight.shadow.camera.top = 60;
        directionalLight.shadow.camera.bottom = -60;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 150;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.bias = -0.0001;

        this.scene.add(directionalLight);

        // 보조광 (채우기 조명)
        const fillLight = new THREE.DirectionalLight(0x88ccff, 0.3);
        fillLight.position.set(-30, 20, -30);
        this.scene.add(fillLight);

        // 반사광 (바닥에서 올라오는 빛)
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
        this.scene.add(hemiLight);
    }

    createGround() {
        // 바닥 메시
        const groundGeometry = new THREE.PlaneGeometry(300, 300);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0xf0f4f8,
            roughness: 0.9,
            metalness: 0.1
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // 그리드
        const gridHelper = new THREE.GridHelper(300, 60, 0xccddee, 0xe0e7ff);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
    }

    initPhysics() {
        console.log('Initializing physics...');

        // Cannon-es 월드 생성
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -40, 0)
        });

        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 20;
        this.world.defaultContactMaterial.friction = 0.4;
        this.world.defaultContactMaterial.restitution = 0.2;

        // 바닥 물리 바디
        const groundShape = new CANNON.Plane();
        this.groundBody = new CANNON.Body({
            mass: 0,
            shape: groundShape
        });
        this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(this.groundBody);

        console.log('Physics initialized');
    }

    createDomino(position, rotation, index) {
        const width = 0.4;
        const height = 3;
        const depth = 1.5;

        // Three.js 메시
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: this.getDominoColor(index),
            roughness: 0.6,
            metalness: 0.2
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position.x, position.y + height / 2, position.z);
        mesh.rotation.y = rotation;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        // Cannon-es 바디
        const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
        const body = new CANNON.Body({
            mass: 1.5,
            shape: shape,
            linearDamping: 0.3,
            angularDamping: 0.3
        });
        body.position.set(position.x, position.y + height / 2, position.z);
        body.quaternion.setFromEuler(0, rotation, 0);
        this.world.addBody(body);

        this.dominoMeshes.push(mesh);
        this.dominoBodies.push(body);

        return { mesh, body };
    }

    getDominoColor(index) {
        const colors = [
            0x6366f1, // 인디고
            0x8b5cf6, // 바이올렛
            0xa78bfa, // 퍼플
            0x7c3aed, // 퍼플(진함)
            0x6d28d9  // 퍼플(더 진함)
        ];
        return colors[index % colors.length];
    }

    async createDominosFromText(text) {
        if (!text || text.trim().length === 0) {
            alert('텍스트를 입력해주세요!');
            return;
        }

        console.log(`Creating dominoes for text: "${text}"`);
        this.currentText = text;

        this.showLoading(true);
        this.updateStatus('도미노 생성 중...');
        this.soundSystem.playClick();

        // UI 업데이트를 위한 짧은 딜레이
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            // 기존 도미노 제거
            this.clearDominos();

            // 텍스트를 도미노 좌표로 변환
            const coordinates = this.textConverter.textToCoordinates(text, 60);

            if (coordinates.length === 0) {
                alert('도미노를 생성할 수 없습니다. 다른 텍스트를 시도해보세요.');
                this.showLoading(false);
                this.updateStatus('실패');
                return;
            }

            // 간격 채우기
            const filled = this.textConverter.fillGaps(coordinates, 3.5);

            console.log(`Creating ${filled.length} dominoes...`);

            // 도미노 생성
            filled.forEach((coord, index) => {
                this.createDomino(
                    new THREE.Vector3(coord.x, 0, coord.z),
                    coord.rotation,
                    index
                );
            });

            // 통계
            const stats = this.textConverter.getStatistics(filled);
            this.updateDominoCount(stats.count);

            // 디버그 정보
            const debugInfo = this.textConverter.getDebugInfo(filled);
            this.updateDebugInfo(debugInfo);

            // 카메라 조정
            this.adjustCameraToFit(stats);

            // UI 업데이트
            this.elements.toppleBtn.disabled = false;
            this.updateStatus('준비 완료 ✓');
            this.soundSystem.playSuccess();

            console.log(`Successfully created ${stats.count} dominoes`);

        } catch (error) {
            console.error('Error creating dominoes:', error);
            alert('도미노 생성 중 오류가 발생했습니다: ' + error.message);
            this.updateStatus('오류 발생');
        } finally {
            this.showLoading(false);
        }
    }

    adjustCameraToFit(stats) {
        if (stats.count === 0) return;

        const { center, width, depth } = stats;
        const maxDim = Math.max(width, depth, 20);

        const distance = maxDim * 1.2 + 25;
        const height = distance * 0.6;

        this.camera.position.set(
            center.x,
            height,
            center.z + distance
        );
        this.camera.lookAt(center.x, 0, center.z);

        this.cameraTarget.set(center.x, 0, center.z);

        console.log(`Camera adjusted to: (${center.x.toFixed(1)}, ${height.toFixed(1)}, ${(center.z + distance).toFixed(1)})`);
    }

    toppleDominos() {
        if (this.dominoBodies.length === 0) return;

        console.log('Toppling dominoes...');

        this.isFalling = true;
        this.fallingDominoIndex = 0;
        this.lastFallenIndex = -1;
        this.updateStatus('도미노 쓰러지는 중...');
        this.elements.toppleBtn.disabled = true;
        this.soundSystem.playClick();

        // 첫 번째 도미노에 강한 힘 적용
        const firstBody = this.dominoBodies[0];
        const pushForce = new CANNON.Vec3(0, 0, -15);
        const pushPoint = new CANNON.Vec3(0, 1.5, 0.7);

        firstBody.applyImpulse(pushForce, pushPoint);
        this.soundSystem.playDominoFall(1.0, 1.0);

        console.log('First domino pushed');
    }

    clearDominos() {
        console.log('Clearing dominoes...');

        // Three.js 메시 제거
        this.dominoMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });

        // Cannon-es 바디 제거
        this.dominoBodies.forEach(body => {
            this.world.removeBody(body);
        });

        this.dominoMeshes = [];
        this.dominoBodies = [];
        this.isFalling = false;
        this.fallingDominoIndex = 0;
        this.lastFallenIndex = -1;

        this.updateDominoCount(0);
        this.elements.toppleBtn.disabled = true;

        console.log('Dominoes cleared');
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

        // 도미노 쓰러짐 감지 및 사운드
        if (this.isFalling) {
            this.detectFalling();
            this.updateCameraFollow();
        }
    }

    detectFalling() {
        for (let i = this.lastFallenIndex + 1; i < this.dominoBodies.length; i++) {
            const body = this.dominoBodies[i];

            // 도미노가 기울어진 각도 계산
            const angle = this.getDominoTiltAngle(body);

            if (angle > 0.4) { // 약 23도 이상
                if (i > this.lastFallenIndex) {
                    this.lastFallenIndex = i;
                    this.fallingDominoIndex = i;

                    // 사운드 재생
                    if (this.soundSystem.enabled) {
                        this.soundSystem.playChain(i, this.dominoBodies.length);
                    }

                    console.log(`Domino ${i} fell`);
                }
            }
        }
    }

    getDominoTiltAngle(body) {
        // 쿼터니언을 사용하여 기울기 계산
        const up = new CANNON.Vec3(0, 1, 0);
        const bodyUp = new CANNON.Vec3(0, 1, 0);
        body.quaternion.vmult(bodyUp, bodyUp);

        const dot = up.dot(bodyUp);
        return Math.acos(Math.max(-1, Math.min(1, dot)));
    }

    updateCameraFollow() {
        if (!this.cameraFollowEnabled) return;

        if (this.fallingDominoIndex < this.dominoBodies.length) {
            const targetBody = this.dominoBodies[this.fallingDominoIndex];

            // 타겟 위치로 부드럽게 이동
            const targetPos = new THREE.Vector3(
                targetBody.position.x,
                targetBody.position.y,
                targetBody.position.z
            );

            this.cameraTarget.lerp(targetPos, 0.08);

            // 카메라 위치 업데이트
            const desiredPos = this.cameraTarget.clone().add(this.cameraOffset);
            this.camera.position.lerp(desiredPos, 0.05);
            this.camera.lookAt(this.cameraTarget);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.updatePhysics();
        this.renderer.render(this.scene, this.camera);
    }

    setupEventListeners() {
        // 도미노 생성
        this.elements.createBtn.addEventListener('click', () => {
            const text = this.elements.textInput.value.trim();
            this.createDominosFromText(text);
        });

        // 엔터 키
        this.elements.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const text = this.elements.textInput.value.trim();
                this.createDominosFromText(text);
            }
        });

        // 쓰러뜨리기
        this.elements.toppleBtn.addEventListener('click', () => {
            this.toppleDominos();
        });

        // 초기화
        this.elements.resetBtn.addEventListener('click', () => {
            this.soundSystem.playClick();
            this.clearDominos();
            this.elements.textInput.value = '안녕';
            this.updateStatus('대기 중');
            this.updateDebugInfo('초기화됨');

            // 카메라 초기 위치
            this.camera.position.set(0, 25, 40);
            this.camera.lookAt(0, 0, 0);
        });

        // 설정
        this.elements.cameraFollow.addEventListener('change', (e) => {
            this.cameraFollowEnabled = e.target.checked;
            console.log('Camera follow:', this.cameraFollowEnabled);
        });

        this.elements.slowMotion.addEventListener('change', (e) => {
            this.slowMotionEnabled = e.target.checked;
            console.log('Slow motion:', this.slowMotionEnabled);
        });

        this.elements.soundEnabled.addEventListener('change', (e) => {
            this.soundSystem.setEnabled(e.target.checked);
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

    // UI 업데이트
    updateDominoCount(count) {
        this.elements.dominoCount.textContent = count;
    }

    updateStatus(status) {
        this.elements.status.textContent = status;
    }

    updateDebugInfo(info) {
        this.elements.debugInfo.textContent = info;
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
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');

    // 폰트 로딩 대기
    if (document.fonts) {
        document.fonts.ready.then(() => {
            console.log('Fonts loaded');
            const app = new DominoApp();
            window.dominoApp = app; // 디버깅용
        });
    } else {
        // 폰트 API 미지원 시 즉시 실행
        const app = new DominoApp();
        window.dominoApp = app;
    }
});
