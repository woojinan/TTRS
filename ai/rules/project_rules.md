# Project Rules

## Project

TTRS는 Python과 pygame-ce를 사용해서 만드는 테트리스 게임 프로젝트입니다.

## Current Phase

초기 단계에서는 main.py 단일 파일 구조로 구현합니다.
기능이 커지면 src/ 구조로 분리합니다.

## Tech Stack

- Python 3.x
- pygame-ce
- Git / GitHub
- 추후 pygbag, Docker, GitHub Actions, Kubernetes 적용 예정

## Architecture Rules

- Game 클래스를 중심으로 구성합니다.
- handle_events(), update(), draw(), run() 메서드 구조를 유지합니다.
- 한 번에 하나의 기능만 구현합니다.
- 기존 정상 동작을 깨지 않습니다.
- 아직 불필요한 과도한 추상화는 피합니다.
- 나중에 board.py, tetromino.py, renderer.py, settings.py로 분리할 수 있게 작성합니다.

## Codex Rules

Codex는 구현 담당입니다.

- ai/tasks/에 있는 작업 지시서 범위만 구현합니다.
- 요청받지 않은 기능을 임의로 추가하지 않습니다.
- 기존 구조를 크게 바꾸지 않습니다.
- 수정 후 실행 방법을 알려줍니다.
- 변경한 파일 목록을 요약합니다.

## Claude Code Rules

Claude Code는 플래너 및 리뷰어입니다.

- 직접 구현보다 작업 분해, 설계, 리뷰, 평가를 우선합니다.
- Codex에게 줄 명확한 작업 지시서를 작성합니다.
- Codex가 작성한 코드가 요구사항을 만족하는지 검토합니다.
- 구조, 유지보수성, 실행 가능성, 다음 작업 위험성을 평가합니다.
