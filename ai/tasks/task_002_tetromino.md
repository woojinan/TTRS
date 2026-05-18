# Task 002 - Tetromino 기본 구조 추가

## Goal

main.py 단일 파일 안에 Tetromino 클래스를 추가하고, 7개 테트로미노 모양 데이터와 고유 색상을 정의한다. 게임 시작 시 블록 하나를 보드 상단 중앙에 생성하고, 기존 draw() 흐름에서 화면에 표시한다.

## Context

Task 001에서 Game 클래스와 기본 루프가 완성되었다. 현재 main.py에는 보드 그리드 렌더링과 이벤트 처리만 있으며, 테트로미노 관련 코드는 전혀 없다.

보드 좌표 기준값은 Game.__init__에 다음과 같이 정의되어 있다.

- `self.board_columns = 10`, `self.board_rows = 20`
- `self.cell_size = 24`
- `self.board_left = (SCREEN_WIDTH - self.board_width) // 2`
- `self.board_top = 80`

기존 상수:

```
SCREEN_WIDTH = 400
SCREEN_HEIGHT = 600
FPS = 60
COLOR_BACKGROUND = (18, 18, 24)
COLOR_GRID = (42, 42, 54)
COLOR_TEXT = (230, 230, 240)
```

## Files to Modify

- `main.py` (단일 파일, 기존 구조 유지)

## Requirements

- [ ] `Tetromino` 클래스를 `Game` 클래스 위에 정의한다.
- [ ] 7개 테트로미노 I, O, T, S, Z, J, L의 모양 데이터를 `(row, col)` 상대 좌표 리스트로 정의한다. 기준 셀은 `(0, 0)`.
- [ ] 각 테트로미노에 고유 색상 `(R, G, B)` 튜플을 부여한다.
- [ ] `Tetromino.__init__(self, shape: str)` 는 모양 이름을 받아 해당 셀 좌표 목록과 색상을 설정한다.
- [ ] `Tetromino`는 보드 기준 현재 위치를 `self.row`, `self.col`로 보관한다.
- [ ] `Game.__init__`에서 `self.current_piece`를 하나 생성한다. 초기 위치는 보드 상단 행 0, 열 중앙(열 3 또는 4)으로 설정한다.
- [ ] `Game.draw()`에서 `self.draw_current_piece()`를 호출한다. `draw_board()` 호출 이후, `pygame.display.flip()` 이전에 삽입한다.
- [ ] `Game.draw_current_piece()`는 `self.current_piece`의 각 셀을 보드 픽셀 좌표로 변환해 채운 사각형으로 그린다.
- [ ] 셀 픽셀 좌표 변환 공식: `x = board_left + (piece.col + dc) * cell_size`, `y = board_top + (piece.row + dr) * cell_size`. 각 셀은 `cell_size - 1` 크기 사각형으로 렌더링한다.

## 구현 명세

### Tetromino 클래스 구조

```python
class Tetromino:
    SHAPES: dict[str, list[tuple[int, int]]] = {
        "I": [(0, 0), (0, 1), (0, 2), (0, 3)],
        "O": [(0, 0), (0, 1), (1, 0), (1, 1)],
        "T": [(0, 0), (0, 1), (0, 2), (1, 1)],
        "S": [(0, 1), (0, 2), (1, 0), (1, 1)],
        "Z": [(0, 0), (0, 1), (1, 1), (1, 2)],
        "J": [(0, 0), (1, 0), (1, 1), (1, 2)],
        "L": [(0, 2), (1, 0), (1, 1), (1, 2)],
    }

    COLORS: dict[str, tuple[int, int, int]] = {
        "I": (0, 240, 240),    # 청록
        "O": (240, 240, 0),    # 노랑
        "T": (160, 0, 240),    # 보라
        "S": (0, 240, 0),      # 초록
        "Z": (240, 0, 0),      # 빨강
        "J": (0, 0, 240),      # 파랑
        "L": (240, 160, 0),    # 주황
    }

    def __init__(self, shape: str) -> None:
        self.shape = shape
        self.cells: list[tuple[int, int]] = self.SHAPES[shape]
        self.color: tuple[int, int, int] = self.COLORS[shape]
        self.row: int = 0     # 보드 기준 행 (0 = 최상단)
        self.col: int = 3     # 보드 기준 열 (열 중앙 근처)
```

### Game 클래스 변경 사항

`Game.__init__` 마지막에 추가:

```python
self.current_piece = Tetromino("T")
```

`Game.draw` 변경: `self.draw_board()` 다음 줄에 `self.draw_current_piece()` 삽입.

`Game`에 신규 메서드 추가:

```python
def draw_current_piece(self) -> None:
    """Draw the active tetromino on the board."""
    piece = self.current_piece
    for dr, dc in piece.cells:
        x = self.board_left + (piece.col + dc) * self.cell_size
        y = self.board_top + (piece.row + dr) * self.cell_size
        rect = pygame.Rect(x, y, self.cell_size - 1, self.cell_size - 1)
        pygame.draw.rect(self.screen, piece.color, rect)
```

## Out of Scope

- 키보드 입력으로 블록 이동 (좌/우/하)
- 블록 회전
- 중력 낙하 타이머
- 충돌 감지 및 보드 고정
- 줄 삭제 및 점수
- 다음 블록 미리 보기
- 랜덤 블록 생성
- src/ 구조 분리 또는 리팩토링

## Verification

```powershell
python -m py_compile main.py
python main.py
```

## Expected Result

- 문법 오류 없이 컴파일된다.
- 400x600 pygame 창이 열린다.
- 보드 그리드 위에 T자형 보라색 블록이 상단 중앙에 정적으로 표시된다.
- ESC 또는 창 닫기로 정상 종료된다.
- 보드 그리드 렌더링, 상태 텍스트 등 기존 동작이 그대로 유지된다.

## Codex Prompt

```
다음 지시에 따라 c:\Users\C544\Desktop\TTRS\main.py 파일만 수정하세요.

## 목표
main.py 단일 파일 구조를 유지하면서 Tetromino 클래스를 추가하고,
게임 시작 시 블록 하나를 보드 상단 중앙에 정적으로 표시합니다.

## 반드시 지킬 규칙
- main.py 이외의 파일은 생성하거나 수정하지 않습니다.
- 기존 Game 클래스의 run(), handle_events(), handle_keydown(), update(),
  draw(), draw_board(), draw_status_text(), quit() 메서드 이름과 시그니처를
  변경하지 않습니다.
- 기존 상수(SCREEN_WIDTH, SCREEN_HEIGHT, FPS, COLOR_BACKGROUND, COLOR_GRID,
  COLOR_TEXT)를 수정하거나 삭제하지 않습니다.
- 이번 작업에서 이동, 회전, 중력, 충돌, 줄 삭제, 점수, 랜덤 생성은 구현하지
  않습니다.

## 구현 내용

### 1. Tetromino 클래스 추가 (Game 클래스 위에 정의)

클래스 변수 SHAPES에 7개 테트로미노의 (row, col) 상대 좌표를 정의합니다.
기준 셀은 (0, 0)이며 아래 좌표를 그대로 사용합니다.

  I: [(0,0),(0,1),(0,2),(0,3)]
  O: [(0,0),(0,1),(1,0),(1,1)]
  T: [(0,0),(0,1),(0,2),(1,1)]
  S: [(0,1),(0,2),(1,0),(1,1)]
  Z: [(0,0),(0,1),(1,1),(1,2)]
  J: [(0,0),(1,0),(1,1),(1,2)]
  L: [(0,2),(1,0),(1,1),(1,2)]

클래스 변수 COLORS에 각 모양의 RGB 색상을 정의합니다.

  I: (0, 240, 240)
  O: (240, 240, 0)
  T: (160, 0, 240)
  S: (0, 240, 0)
  Z: (240, 0, 0)
  J: (0, 0, 240)
  L: (240, 160, 0)

__init__(self, shape: str) 는 shape 이름을 받아
self.cells, self.color, self.row=0, self.col=3 을 설정합니다.

### 2. Game.__init__ 수정

기존 초기화 코드 마지막에 아래 한 줄을 추가합니다.

  self.current_piece = Tetromino("T")

### 3. Game에 draw_current_piece 메서드 추가

def draw_current_piece(self) -> None:
    piece = self.current_piece
    for dr, dc in piece.cells:
        x = self.board_left + (piece.col + dc) * self.cell_size
        y = self.board_top + (piece.row + dr) * self.cell_size
        rect = pygame.Rect(x, y, self.cell_size - 1, self.cell_size - 1)
        pygame.draw.rect(self.screen, piece.color, rect)

### 4. Game.draw 수정

draw_board() 호출 다음 줄에 아래를 추가합니다.

  self.draw_current_piece()

pygame.display.flip() 순서는 변경하지 않습니다.

## 완료 후 제출 형식
1. 변경한 파일 목록
2. 실행 명령어:
   python -m py_compile main.py
   python main.py
3. 예상 화면: 보드 상단 중앙에 보라색 T 블록이 정적으로 표시됨
```
