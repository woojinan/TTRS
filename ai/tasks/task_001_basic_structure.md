# Task 001 - Basic Structure

## Goal

pygame-ce 기반 테트리스 게임의 최소 실행 구조를 main.py 단일 파일로 구현합니다.

## Context

현재 프로젝트는 초기 단계이며 main.py 중심 구조를 유지합니다. 이후 board.py, tetromino.py, renderer.py, settings.py로 분리할 수 있도록 Game 클래스 경계를 명확히 둡니다.

## Files to Modify

- main.py

## Requirements

- [x] pygame 초기화
- [x] 400x600 게임 창 생성
- [x] FPS 60 유지
- [x] 기본 게임 루프 구현
- [x] 종료 이벤트 처리
- [x] 화면 업데이트 및 렌더링
- [x] Game 클래스 기반 구조 사용
- [x] update(), draw(), handle_events(), run() 분리

## Out of Scope

- 실제 테트로미노 이동/회전 로직
- 보드 충돌 판정
- 라인 클리어
- 점수 시스템
- src/ 구조 리팩토링

## Verification

```powershell
python -m py_compile main.py
python main.py
```

## Expected Result

문법 오류 없이 main.py가 컴파일되고, 400x600 pygame 창이 열립니다. 창 닫기 버튼 또는 ESC 키로 종료됩니다.

## Codex Prompt

ai/rules/project_rules.md를 기준으로 main.py 단일 파일 구조를 유지하면서 pygame-ce 테트리스 게임의 기본 실행 구조를 구현하세요. Game 클래스 중심으로 run(), handle_events(), update(), draw()를 분리하고, 향후 board/tetromino/renderer 모듈로 나눌 수 있도록 과도하지 않은 경계를 남기세요. 이번 작업에서는 실제 블록 로직은 구현하지 마세요.
