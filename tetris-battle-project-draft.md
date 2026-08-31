# Tetris Battle 프로젝트 코드 초안 가이드

## 1. 프로젝트 목표

이 프로젝트는 **한국인 사용자가 별도의 설치 없이 웹브라우저에서 쉽게 접속하여 즐길 수 있는 심플한 멀티플레이 테트리스 게임 서비스**를 만드는 것을 목표로 한다.

단순히 게임을 만드는 것에서 끝내지 않고 다음 기술들을 실습하는 DevOps/서버 엔지니어 학습 프로젝트로 구성한다.

- Git / GitHub를 이용한 형상 관리
- Python FastAPI 기반 백엔드 개발
- WebSocket 기반 실시간 멀티플레이 통신
- Phaser 기반 웹 게임 UI
- Redis를 이용한 실시간 상태 관리
- PostgreSQL을 이용한 회원/전적/랭킹 데이터 관리
- Docker / Docker Compose를 이용한 컨테이너 배포
- Rocky Linux 9~10 서버 운영
- Nginx Reverse Proxy
- HTTPS 적용
- GitHub Actions 기반 CI/CD

---

## 2. 서비스 기본 방향

### 서비스 형태

사용자는 다음과 같이 접근한다.

```text
PC / 모바일 웹브라우저
        │
        ▼
https://게임도메인
        │
        ▼
      Nginx
        │
        ▼
 FastAPI + WebSocket
        │
        ├── Redis
        └── PostgreSQL
```

게임 화면 자체는 브라우저에서 실행하며 Phaser를 사용한다.

```text
Browser
 ├── HTML
 ├── CSS
 ├── JavaScript
 └── Phaser
```

백엔드는 Python FastAPI가 담당한다.

```text
FastAPI
 ├── 사용자 접속 관리
 ├── 방 생성
 ├── 방 입장
 ├── 게임 시작
 ├── WebSocket 연결
 ├── 플레이어 상태 동기화
 ├── 공격 이벤트 전달
 ├── 게임 종료 처리
 └── 전적 저장
```

---

# 3. UI/UX 기본 원칙

이 서비스의 가장 중요한 UI 목표는 다음과 같다.

> 한국인 사용자가 처음 접속해도 별도의 설명 없이 바로 게임을 시작할 수 있게 한다.

따라서 복잡한 영어 메뉴나 게임 용어를 최대한 줄인다.

---

## 3.1 언어 정책

기본 언어는 한국어로 한다.

권장 표현:

| 영어식 표현 | 실제 UI |
|---|---|
| Quick Match | 바로 대전 |
| Create Room | 방 만들기 |
| Join Room | 방 참가 |
| Ranking | 순위 |
| Settings | 설정 |
| Ready | 준비 |
| Game Over | 게임 종료 |
| Rematch | 다시 하기 |
| Leave Room | 나가기 |
| Spectator | 관전 |

게임에서 널리 사용되는 단어라도 가능한 경우 한국어를 우선한다.

---

# 4. 첫 화면 UI

서비스에 접속하면 복잡한 회원가입 화면부터 보여주지 않는다.

초기 버전에서는 닉네임만 입력하면 바로 게임을 이용할 수 있도록 한다.

예시:

```text
┌─────────────────────────────────────┐
│                                     │
│          테트리스 배틀              │
│                                     │
│     간단하게 즐기는 실시간 대전     │
│                                     │
│     닉네임                          │
│     ┌─────────────────────────┐     │
│     │ 닉네임을 입력하세요     │     │
│     └─────────────────────────┘     │
│                                     │
│        [ 바로 대전하기 ]             │
│                                     │
│        [ 방 만들기 ]                 │
│        [ 방 참가하기 ]               │
│                                     │
│        [ 게임 방법 ]                 │
│                                     │
└─────────────────────────────────────┘
```

초기 사용자는 아래 세 기능만 이해하면 된다.

1. 바로 대전하기
2. 방 만들기
3. 방 참가하기

---

# 5. 바로 대전 기능

사용자가 `바로 대전하기`를 누르면 자동으로 상대방을 찾는다.

```text
바로 대전하기
      │
      ▼
상대방 찾는 중...
      │
      ├── 상대 존재 → 매칭
      │
      └── 상대 없음 → 대기
```

화면 예시:

```text
┌──────────────────────────────┐
│                              │
│       상대방을 찾는 중       │
│                              │
│          ● ● ●               │
│                              │
│      잠시만 기다려주세요     │
│                              │
│        [ 취소하기 ]           │
│                              │
└──────────────────────────────┘
```

---

# 6. 방 만들기

사용자가 `방 만들기`를 선택하면 서버가 짧은 방 코드를 생성한다.

예:

```text
방 코드 : 381527
```

한국 사용자가 모바일이나 메신저로 전달하기 쉽게 처음에는 숫자 6자리 사용을 권장한다.

화면:

```text
┌──────────────────────────────────┐
│             대전 방              │
│                                  │
│ 방 코드                           │
│                                  │
│            381527                │
│                                  │
│     [ 방 코드 복사하기 ]          │
│                                  │
│ 상대방을 기다리고 있습니다.       │
│                                  │
│ 나                               │
│ 홍길동                    준비    │
│                                  │
│ 상대방                           │
│ 기다리는 중...                   │
│                                  │
│             [ 나가기 ]            │
└──────────────────────────────────┘
```

---

# 7. 방 참가

사용자가 친구에게 받은 코드를 입력한다.

```text
┌─────────────────────────────────┐
│            방 참가              │
│                                 │
│ 방 코드를 입력해주세요           │
│                                 │
│    ┌───────────────────────┐    │
│    │ 381527                │    │
│    └───────────────────────┘    │
│                                 │
│       [ 참가하기 ]               │
│                                 │
│       [ 이전 화면 ]              │
└─────────────────────────────────┘
```

---

# 8. 게임 화면

PC 기준 기본 게임 화면:

```text
┌──────────────────────────────────────────────────────┐
│ 테트리스 배틀                         방 381527       │
├─────────────────────────┬────────────────────────────┤
│          나             │          상대방            │
│                         │                            │
│       NEXT              │                            │
│        ██               │                            │
│        ██               │                            │
│                         │                            │
│       ┌──────────┐      │      ┌──────────┐          │
│       │          │      │      │          │          │
│       │   ██     │      │      │    ██    │          │
│       │ ████     │      │      │  ████    │          │
│       │          │      │      │          │          │
│       │████████  │      │      │████████  │          │
│       └──────────┘      │      └──────────┘          │
│                         │                            │
│ 점수 12,500             │ 점수 9,850                 │
│ 제거 18줄               │ 제거 14줄                 │
│ 연속 4                  │ 연속 2                    │
│                         │                            │
└─────────────────────────┴────────────────────────────┘
```

---

# 9. 게임 조작

PC 조작은 최대한 일반적인 테트리스 방식으로 제공한다.

| 키 | 기능 |
|---|---|
| ← | 왼쪽 이동 |
| → | 오른쪽 이동 |
| ↓ | 빠르게 내리기 |
| ↑ | 회전 |
| Space | 즉시 떨어뜨리기 |
| C | 블록 보관 |
| ESC | 메뉴 |

화면 하단에 항상 간단한 조작 안내를 표시한다.

```text
← → 이동   ↑ 회전   ↓ 내리기   Space 즉시 내리기
```

처음 접속한 사용자에게는 게임 시작 전 3~5초 동안 간단한 도움말을 보여준다.

---

# 10. 게임 규칙

초기 버전은 최대한 단순하게 한다.

기본 규칙:

- 2인 대전
- 마지막까지 살아남은 사용자가 승리
- 한 줄 이상 제거하면 공격 게이지 증가
- 여러 줄을 동시에 제거하면 상대방에게 방해 줄 전송
- 연속 제거 시 추가 공격

예시:

```text
1줄 제거
→ 기본 점수

2줄 제거
→ 상대방 방해 1줄

3줄 제거
→ 상대방 방해 2줄

4줄 제거
→ 상대방 방해 4줄
```

세부 밸런스는 개발 이후 조정한다.

---

# 11. 기술 스택

## Frontend

```text
HTML5
CSS3
JavaScript
Phaser 3
```

Phaser는 다음 기능을 담당한다.

- 게임 화면
- 테트리스 보드
- 블록 렌더링
- 게임 루프
- 키 입력
- 애니메이션
- 사운드
- 화면 효과

---

## Backend

```text
Python 3.12
FastAPI
Uvicorn
WebSocket
```

FastAPI는 다음 기능을 담당한다.

- API
- 플레이어 접속
- 방 생성
- 방 입장
- 매칭
- WebSocket 통신
- 게임 이벤트 중계
- 게임 종료
- 전적 저장

---

## 실시간 데이터

향후 다음 단계에서 Redis를 추가한다.

```text
Redis
```

역할:

- 현재 접속자
- 매칭 대기 사용자
- 방 정보
- 플레이어 상태
- WebSocket 서버 간 이벤트 전달

초기 개발 단계에서는 Python 메모리를 사용해도 된다.

---

## DB

```text
PostgreSQL
```

초기 버전에서는 DB 없이 시작할 수도 있다.

향후 저장 데이터:

- 사용자
- 닉네임
- 회원 정보
- 승리
- 패배
- 플레이 횟수
- 최고 점수
- 랭킹
- 게임 기록

---

# 12. 프로젝트 디렉터리 초안

```text
tetris-battle/
│
├── app/
│   ├── __init__.py
│   ├── main.py
│   │
│   ├── api/
│   │   ├── health.py
│   │   ├── rooms.py
│   │   └── players.py
│   │
│   ├── websocket/
│   │   ├── manager.py
│   │   └── game_socket.py
│   │
│   ├── game/
│   │   ├── room.py
│   │   ├── player.py
│   │   └── matchmaking.py
│   │
│   └── core/
│       ├── config.py
│       └── logging.py
│
├── frontend/
│   ├── index.html
│   │
│   ├── css/
│   │   └── style.css
│   │
│   ├── js/
│   │   ├── app.js
│   │   ├── websocket.js
│   │   └── ui.js
│   │
│   └── game/
│       ├── game.js
│       ├── board.js
│       ├── piece.js
│       ├── input.js
│       └── effects.js
│
├── tests/
│   ├── test_health.py
│   └── test_rooms.py
│
├── docker/
│   └── nginx/
│       └── default.conf
│
├── .env.example
├── .gitignore
├── compose.yaml
├── Dockerfile
├── requirements.txt
└── README.md
```

---

# 13. 주요 파일 역할

## app/main.py

FastAPI 애플리케이션 시작 파일.

예상 역할:

```text
FastAPI 생성
API Router 등록
WebSocket Router 등록
Static 파일 연결
서비스 시작/종료 처리
```

---

## app/websocket/manager.py

현재 연결된 WebSocket 사용자를 관리한다.

예:

```text
ROOM 381527
 ├── player1 websocket
 └── player2 websocket
```

주요 기능:

```text
connect()
disconnect()
send_personal()
broadcast()
send_to_room()
```

---

## app/game/room.py

게임 방의 상태를 관리한다.

예상 정보:

```text
room_id
player1
player2
status
created_at
winner
```

상태:

```text
WAITING
READY
PLAYING
FINISHED
```

---

# 14. WebSocket 메시지 구조

클라이언트와 서버 통신은 JSON을 사용한다.

## 사용자 접속

```json
{
  "type": "join",
  "nickname": "홍길동",
  "room_id": "381527"
}
```

---

## 준비

```json
{
  "type": "ready",
  "ready": true
}
```

---

## 게임 시작

서버 → 사용자:

```json
{
  "type": "game_start",
  "countdown": 3
}
```

---

## 게임 상태

```json
{
  "type": "game_state",
  "score": 12500,
  "lines": 18,
  "combo": 4
}
```

---

## 공격

```json
{
  "type": "attack",
  "lines": 4
}
```

---

## 게임 종료

```json
{
  "type": "game_over",
  "winner": "홍길동"
}
```

---

# 15. Git 브랜치 전략

실습 초기에는 복잡한 Git Flow를 사용하지 않는다.

기본:

```text
main
```

기능 개발 시:

```text
main
 │
 ├── feature/tetris-core
 ├── feature/websocket
 ├── feature/multiplayer-room
 └── feature/docker
```

개발 완료 후 main으로 merge한다.

예:

```bash
git checkout -b feature/tetris-core
```

개발 후:

```bash
git add .
git commit -m "feat: implement tetris core"
```

---

# 16. 커밋 메시지 기본 규칙

권장:

```text
feat:
새로운 기능

fix:
버그 수정

docs:
문서

style:
CSS/UI 또는 코드 스타일

refactor:
코드 구조 개선

test:
테스트

build:
Docker 또는 빌드

ci:
GitHub Actions
```

예:

```text
feat: add room creation API
feat: implement websocket connection
feat: implement tetris board
fix: prevent duplicate room join
style: improve game lobby UI
build: add Dockerfile
ci: add deployment workflow
```

---

# 17. 개발 단계

## Phase 1 - 프로젝트 생성

목표:

```text
Git 프로젝트 생성
FastAPI 실행
GitHub 연결
```

완료 조건:

```text
GET /health
→ 200 OK
```

---

## Phase 2 - 기본 UI

목표:

```text
게임 메인 화면
닉네임 입력
바로 대전
방 만들기
방 참가
```

아직 실제 게임은 실행하지 않아도 된다.

---

## Phase 3 - 싱글 테트리스

Phaser에서 테트리스 핵심 구현.

```text
블록 생성
블록 이동
회전
충돌 검사
블록 고정
라인 삭제
점수
게임 종료
NEXT
HOLD
```

---

## Phase 4 - WebSocket

목표:

두 브라우저 사이의 실시간 통신.

예:

```text
Chrome
   │
FastAPI
   │
Edge
```

두 사용자가 상대방의:

```text
닉네임
점수
제거 줄
상태
```

를 확인할 수 있어야 한다.

---

## Phase 5 - 방 시스템

구현:

```text
방 생성
방 코드 발급
방 참가
준비
게임 시작
방 나가기
```

---

## Phase 6 - 멀티플레이

구현:

```text
상대방 보드 표시
점수 동기화
라인 공격
승패 판정
재대결
```

---

## Phase 7 - Redis

Python 프로세스 메모리에 저장하던 방 상태를 개선한다.

목표:

```text
FastAPI Worker 여러 개
          │
          ▼
        Redis
          │
     공통 상태 공유
```

---

## Phase 8 - DB

PostgreSQL 추가.

구현:

```text
회원
전적
승률
게임 횟수
랭킹
```

---

## Phase 9 - Docker

최종 애플리케이션을 이미지로 만든다.

```text
Docker Image
 ├── Python
 ├── FastAPI
 ├── Backend
 ├── Frontend
 └── Dependencies
```

데이터는 이미지에 넣지 않는다.

---

## Phase 10 - Rocky Linux 배포

서버:

```text
Rocky Linux 9 또는 10
```

구조:

```text
Internet
   │
   ▼
Nginx :443
   │
   ▼
Docker Container
   │
   ▼
FastAPI
   │
   ├── Redis
   └── PostgreSQL
```

---

## Phase 11 - HTTPS

도메인:

```text
tetris.example.com
```

DNS:

```text
A Record
tetris.example.com
→ Rocky Server IP
```

Nginx에서 HTTPS 적용.

WebSocket도:

```text
ws://
```

가 아닌:

```text
wss://
```

사용.

---

## Phase 12 - CI/CD

최종 목표:

```text
개발 PC
   │
git push
   ▼
GitHub
   │
GitHub Actions
   │
Test
   │
Docker Build
   │
Deploy
   ▼
Rocky Linux
```

---

# 18. Docker 개발/운영 원칙

운영 환경에서는 애플리케이션 코드를 Docker 이미지 안에 포함한다.

권장:

```text
Image
 ├── Python
 ├── 라이브러리
 ├── Backend 코드
 └── Frontend 코드
```

외부 Volume:

```text
로그
DB
업로드 파일
영구 데이터
```

운영 환경에서 소스코드를 bind mount해서 사용하는 방식은 최소화한다.

---

# 19. 초기 Dockerfile 목표

예상 구조:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD [
  "uvicorn",
  "app.main:app",
  "--host",
  "0.0.0.0",
  "--port",
  "8000"
]
```

첫 개발 단계에서는 worker를 1개만 사용한다.

이유:

Python 메모리에서 WebSocket Room을 관리하는 동안 worker를 여러 개 실행하면 각 worker가 서로 다른 메모리를 사용하기 때문이다.

Redis를 적용한 이후 worker 확장을 검토한다.

---

# 20. 초기 compose.yaml 목표

```yaml
services:

  tetris:
    build: .
    container_name: tetris-battle
    ports:
      - "8000:8000"
    environment:
      - TZ=Asia/Seoul
    restart: unless-stopped
```

Redis 단계에서는:

```text
tetris
redis
postgres
```

서비스를 Compose에 추가한다.

---

# 21. 로그 정책

초기부터 기본 로그를 남긴다.

예:

```text
사용자 접속
방 생성
방 참가
게임 시작
게임 종료
WebSocket 연결
WebSocket 연결 종료
서버 오류
```

절대로 로그에 저장하지 않을 정보:

```text
비밀번호
토큰 원문
세션 Secret
개인정보
```

---

# 22. 보안 기본 원칙

초기 프로젝트라도 다음 원칙을 지킨다.

- 사용자 입력값 검증
- 닉네임 길이 제한
- 방 코드 검증
- WebSocket 메시지 type 검증
- 요청 횟수 제한 검토
- 비밀번호/Secret은 `.env`
- `.env`는 Git에 올리지 않음
- HTTPS 적용
- 운영 서버의 FastAPI 포트를 인터넷에 직접 개방하지 않음

운영에서는:

```text
Internet
   │
   ▼
Nginx :443
   │
   ▼
127.0.0.1:8000
```

형태를 목표로 한다.

---

# 23. 모바일 대응

한국 사용자 접근성을 위해 모바일 브라우저 접근도 고려한다.

초기 우선순위:

```text
1. PC 키보드 플레이
2. 모바일 화면 정상 표시
3. 모바일 터치 조작
```

모바일에서는 하단에:

```text
[ ← ] [ ↓ ] [ → ]

[ 회전 ]

[ 즉시 내리기 ]
```

형태의 터치 버튼 제공을 검토한다.

---

# 24. 접근성

버튼은 의미를 바로 알 수 있게 작성한다.

나쁜 예:

```text
START
MATCH
ROOM
ENTER
```

권장:

```text
게임 시작
바로 대전하기
방 만들기
방 참가하기
```

에러도 기술적인 메시지를 그대로 보여주지 않는다.

나쁜 예:

```text
WebSocket connection failed: 1006
```

권장:

```text
서버 연결이 끊어졌습니다.

[ 다시 연결하기 ]
```

---

# 25. UI 디자인 방향

디자인 키워드:

```text
깔끔함
단순함
한국어 중심
큰 버튼
직관적인 메뉴
과도하지 않은 효과
빠른 게임 진입
```

메인 화면에서 버튼은 3~4개 이상 늘리지 않는다.

색상이나 세부 디자인은 구현 단계에서 결정한다.

---

# 26. MVP 완료 기준

첫 번째 공개 가능한 MVP는 다음 기능까지만 구현한다.

- 닉네임 입력
- 방 생성
- 방 참가
- 2인 접속
- 준비
- 카운트다운
- 정상적인 테트리스 플레이
- 상대방 점수 표시
- 상대방 게임 상태 표시
- 라인 공격
- 승패 판정
- 다시 하기
- 방 나가기
- Docker 실행
- Rocky Linux 배포
- 도메인 연결
- HTTPS

회원가입, 랭킹, Redis, PostgreSQL은 MVP 이후 추가해도 된다.

---

# 27. 첫 번째 개발 목표

처음부터 테트리스 전체를 구현하지 않는다.

첫 번째 목표는 다음 세 가지다.

```text
1. Git/GitHub 프로젝트 생성

2. FastAPI 실행

3. 브라우저에서 메인 화면 출력
```

완료 확인:

```text
http://127.0.0.1:8000
```

접속 시:

```text
테트리스 배틀

닉네임을 입력하세요

[ 바로 대전하기 ]
[ 방 만들기 ]
[ 방 참가하기 ]
```

화면이 표시되면 첫 번째 단계 완료로 한다.

---

# 28. 최종 목표 아키텍처

```text
                    사용자
                 PC / Mobile
                      │
                 HTTPS / WSS
                      │
                      ▼
              ┌───────────────┐
              │     Nginx     │
              │    :443       │
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │    FastAPI    │
              │               │
              │ REST API      │
              │ WebSocket     │
              └───┬───────┬───┘
                  │       │
          ┌───────┘       └────────┐
          ▼                        ▼
    ┌───────────┐           ┌─────────────┐
    │   Redis   │           │ PostgreSQL  │
    │           │           │             │
    │ Room      │           │ User        │
    │ Session   │           │ Match       │
    │ Realtime  │           │ Ranking     │
    └───────────┘           └─────────────┘
```

프론트엔드:

```text
Browser

HTML
CSS
JavaScript
Phaser
   │
   ├── Game Scene
   ├── Tetris Board
   ├── Input
   ├── Animation
   └── WebSocket Client
```

---

# 29. 프로젝트 핵심 원칙

프로젝트를 진행하면서 다음 원칙을 유지한다.

1. 처음부터 기능을 너무 많이 넣지 않는다.
2. 한 단계 구현할 때마다 Git commit을 남긴다.
3. 로컬에서 정상 동작한 기능만 다음 단계로 진행한다.
4. Docker는 애플리케이션이 어느 정도 동작한 뒤 적용한다.
5. 처음에는 FastAPI worker를 1개 사용한다.
6. Redis 적용 이후 멀티 worker를 검토한다.
7. UI에서는 기술 용어보다 사용자가 이해할 수 있는 한국어를 사용한다.
8. 운영 환경에서는 코드까지 Docker 이미지로 만든다.
9. 운영 설정과 Secret은 코드와 분리한다.
10. GitHub Actions는 수동 배포 과정을 이해한 다음 적용한다.

---

# 30. 프로젝트 이름 후보

임시 프로젝트명:

```text
Tetris Battle
```

GitHub 저장소:

```text
tetris-battle
```

서비스 이름은 개발 중 자유롭게 변경한다.
