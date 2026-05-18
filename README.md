# TTRS
# 🎮 Python Tetris Game

Python과 pygame-ce를 이용하여 개발하는 테트리스 게임 프로젝트입니다.
초기에는 단일 파일 구조로 빠르게 구현하고, 이후 점진적으로 구조를 분리하여
웹 배포 및 CI/CD 자동화까지 확장하는 것을 목표로 합니다.

---

## 📌 프로젝트 목적

* Python 기반 게임 개발 경험
* pygame-ce를 활용한 2D 게임 로직 이해
* 코드 구조를 점진적으로 개선하는 설계 경험
* Docker / GitHub Actions / Kubernetes 기반 배포 학습

---

## 🛠️ 기술 스택

* **Language**: Python 3.x
* **Game Engine**: pygame-ce
* **Version Control**: Git / GitHub
* **Web Build**: pygbag (예정)
* **CI/CD**: GitHub Actions (예정)
* **Container**: Docker (예정)
* **Orchestration**: Kubernetes (예정)

---

## 📂 프로젝트 구조

### 🔹 1단계 (현재 - 초기 구조)

```bash
TTRS/
├── main.py              # 게임 실행 파일 (모든 로직 포함)
├── requirements.txt    # Python 의존성 목록
├── README.md
├── .gitignore
├── LICENSE
└── assets/             # 이미지 및 사운드 리소스
```

👉 빠르게 개발하고 전체 흐름을 이해하기 위한 구조

---

### 🔹 2단계 (리팩토링 구조 - 예정)

```bash
TTRS/
├── main.py
├── requirements.txt
├── README.md
├── assets/
│   ├── images/
│   └── sounds/
└── src/
    ├── game.py           # 게임 루프 관리
    ├── board.py          # 보드 상태 및 충돌 처리
    ├── tetromino.py      # 블록 로직
    ├── renderer.py       # 화면 출력
    └── settings.py       # 상수 관리
```

👉 기능이 커질 때 책임 분리 및 유지보수성 향상을 위한 구조

---

## 🚀 개발 진행 단계

* [ ] Python 개발 환경 구성
* [ ] pygame-ce 설치 및 기본 화면 출력
* [ ] 테트리스 블록 생성 및 렌더링
* [ ] 블록 이동 및 회전 로직 구현
* [ ] 충돌 처리 및 바닥 감지
* [ ] 줄 삭제(Line Clear) 기능 구현
* [ ] 점수 시스템 구현
* [ ] 게임 오버 처리
* [ ] 코드 구조 리팩토링 (src 분리)
* [ ] WebAssembly 변환 (pygbag)
* [ ] Docker 이미지 생성
* [ ] GitHub Actions CI/CD 구축
* [ ] Kubernetes 배포

---

## ⚙️ 실행 방법 (로컬)

```bash
# 가상환경 생성
python -m venv .venv

# 가상환경 활성화 (Windows)
.venv\Scripts\activate

# 패키지 설치
pip install -r requirements.txt

# 게임 실행
python main.py
```

---

## 📦 향후 배포 구조

```text
VSCode 개발
    ↓
GitHub Push
    ↓
GitHub Actions (CI)
    ↓
Docker Image Build
    ↓
Container Registry Push
    ↓
Kubernetes Deployment
    ↓
웹 서비스 제공
```

---

## 📖 학습 포인트

* Python 게임 루프 구조 이해
* 이벤트 처리 및 렌더링 구조
* 가상환경(venv) 및 의존성 관리
* 코드 구조 리팩토링 설계 방식
* CI/CD 자동화 흐름 이해
* 컨테이너 기반 서비스 운영

---

## 📌 라이선스

이 프로젝트는 MIT License를 따릅니다.
