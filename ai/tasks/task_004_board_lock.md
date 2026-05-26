# Task 004 - 보드 배열 · 충돌 · 락 · 스폰 · 게임오버

## Goal

2D 보드 배열을 추가하고, 블록이 바닥이나 쌓인 블록에 닿으면 고정(lock)한 뒤 새 블록을 스폰한다. 스폰 위치에 이미 블록이 있으면 게임오버로 처리한다.

## Context

- `self.board` 없음 — 고정된 블록이 저장되는 배열이 없어 블록이 쌓이지 않음
- `can_move()` — 경계 검사만 있고 기존 블록과의 충돌 검사 없음
- `update()` — 바닥 도달 시 이동을 멈추기만 하고 lock 없음
- `spawn_piece()` 없음

현재 관련 코드:

```python
# Game.__init__ (task_003 완료 상태)
self.board_columns = 10
self.board_rows    = 20
self.cell_size     = 24
self.current_piece = Tetromino("T")
self.gravity_timer    = 0
self.gravity_interval = FPS

# can_move
def can_move(self, dr: int, dc: int) -> bool:
    piece = self.current_piece
    for cell_dr, cell_dc in piece.cells:
        new_row = piece.row + cell_dr + dr
        new_col = piece.col + cell_dc + dc
        if new_row < 0 or new_row >= self.board_rows: return False
        if new_col < 0 or new_col >= self.board_columns: return False
    return True

# update
def update(self) -> None:
    self.gravity_timer += 1
    if self.gravity_timer >= self.gravity_interval:
        self.gravity_timer = 0
        if self.can_move(1, 0):
            self.current_piece.row += 1
```

## Files to Modify

- `c:\Users\C544\Desktop\TTRS\main.py`

## Requirements

- [ ] `Game.__init__`에 `self.board = [[None] * self.board_columns for _ in range(self.board_rows)]` 추가
- [ ] `can_move(dr, dc)` — 경계 검사에 더해 `self.board[new_row][new_col] is not None` 충돌 검사 추가
- [ ] `lock_piece()` 메서드 추가 — piece.cells 각 셀을 `self.board[r][c] = piece.color`로 기록
- [ ] `spawn_piece()` 메서드 추가 — `Tetromino("T")` 생성, row=0, col=3 초기화, `can_move(0,0)` 실패 시 `self.running = False`
- [ ] `update()` — 중력으로 하강 불가 시 `lock_piece()` → `spawn_piece()` 호출
- [ ] `draw_board()` — 기존 그리드 렌더링 유지, 추가로 `self.board[r][c]`가 None이 아닌 셀을 채운 사각형으로 렌더링

## 구현 명세

### Game.__init__ 추가

```python
# self.gravity_interval = FPS 바로 다음 줄
self.board = [[None] * self.board_columns for _ in range(self.board_rows)]
```

### can_move 수정

```python
def can_move(self, dr: int, dc: int) -> bool:
    piece = self.current_piece
    for cell_dr, cell_dc in piece.cells:
        new_row = piece.row + cell_dr + dr
        new_col = piece.col + cell_dc + dc
        if new_row < 0 or new_row >= self.board_rows:
            return False
        if new_col < 0 or new_col >= self.board_columns:
            return False
        if self.board[new_row][new_col] is not None:
            return False
    return True
```

### lock_piece 메서드 추가

```python
def lock_piece(self) -> None:
    piece = self.current_piece
    for dr, dc in piece.cells:
        r = piece.row + dr
        c = piece.col + dc
        if 0 <= r < self.board_rows and 0 <= c < self.board_columns:
            self.board[r][c] = piece.color
    self.gravity_timer = 0
```

### spawn_piece 메서드 추가

```python
def spawn_piece(self) -> None:
    self.current_piece = Tetromino("T")
    if not self.can_move(0, 0):
        self.running = False
```

### update 수정

```python
def update(self) -> None:
    self.gravity_timer += 1
    if self.gravity_timer >= self.gravity_interval:
        self.gravity_timer = 0
        if self.can_move(1, 0):
            self.current_piece.row += 1
        else:
            self.lock_piece()
            self.spawn_piece()
```

### draw_board 수정 (기존 그리드 그린 뒤 추가)

```python
# 기존 그리드 코드 끝 다음에 추가
for r in range(self.board_rows):
    for c in range(self.board_columns):
        if self.board[r][c] is not None:
            x = self.board_left + c * self.cell_size
            y = self.board_top + r * self.cell_size
            rect = pygame.Rect(x, y, self.cell_size - 1, self.cell_size - 1)
            pygame.draw.rect(self.screen, self.board[r][c], rect)
```

## Out of Scope

- 줄 삭제
- 점수, 레벨
- 랜덤 블록 생성 (다음 태스크에서)
- 블록 회전
- 하드 드롭
- 게임오버 화면 (running=False로 종료만)

## Verification

```powershell
python -m py_compile c:\Users\C544\Desktop\TTRS\main.py
python c:\Users\C544\Desktop\TTRS\main.py
```

## Expected Result

- 블록이 바닥까지 낙하 후 고정된다.
- 고정된 블록 위에 새 T 블록이 스폰된다.
- 블록이 계속 쌓인다.
- 블록이 최상단까지 쌓이면 창이 닫힌다.
- 기존 조작(LEFT/RIGHT/DOWN)은 유지된다.

## Codex Prompt

```
다음 지시에 따라 c:\Users\C544\Desktop\TTRS\main.py 파일만 수정하세요.

## 목표
블록이 바닥이나 쌓인 블록에 닿으면 고정하고, 새 블록을 스폰합니다.
블록이 최상단까지 쌓이면 게임을 종료합니다.

## 반드시 지킬 규칙
- main.py 이외의 파일은 생성하거나 수정하지 않습니다.
- Tetromino 클래스(SHAPES, COLORS, __init__)를 변경하지 않습니다.
- 기존 메서드 이름과 시그니처를 변경하지 않습니다.
- 기존 상수를 수정하거나 삭제하지 않습니다.
- 줄 삭제, 점수, 회전, 하드드롭은 구현하지 않습니다.

## 구현 내용

### 1. Game.__init__ 수정
self.gravity_interval = FPS 바로 다음 줄에 추가합니다.

  self.board = [[None] * self.board_columns for _ in range(self.board_rows)]

self.board는 board_rows×board_columns 크기의 2D 리스트입니다.
각 셀은 None(빈 칸) 또는 (R,G,B) 색상 튜플(고정된 블록)입니다.

### 2. can_move 수정
기존 경계 검사 뒤에 보드 충돌 검사를 추가합니다.

def can_move(self, dr: int, dc: int) -> bool:
    piece = self.current_piece
    for cell_dr, cell_dc in piece.cells:
        new_row = piece.row + cell_dr + dr
        new_col = piece.col + cell_dc + dc
        if new_row < 0 or new_row >= self.board_rows:
            return False
        if new_col < 0 or new_col >= self.board_columns:
            return False
        if self.board[new_row][new_col] is not None:
            return False
    return True

### 3. lock_piece 메서드 추가 (can_move 아래에 추가)

def lock_piece(self) -> None:
    piece = self.current_piece
    for dr, dc in piece.cells:
        r = piece.row + dr
        c = piece.col + dc
        if 0 <= r < self.board_rows and 0 <= c < self.board_columns:
            self.board[r][c] = piece.color
    self.gravity_timer = 0

### 4. spawn_piece 메서드 추가 (lock_piece 아래에 추가)

def spawn_piece(self) -> None:
    self.current_piece = Tetromino("T")
    if not self.can_move(0, 0):
        self.running = False

### 5. update 수정
기존 중력 로직에서 이동 불가 시 lock → spawn을 호출합니다.

def update(self) -> None:
    self.gravity_timer += 1
    if self.gravity_timer >= self.gravity_interval:
        self.gravity_timer = 0
        if self.can_move(1, 0):
            self.current_piece.row += 1
        else:
            self.lock_piece()
            self.spawn_piece()

### 6. draw_board 수정
기존 그리드 렌더링 코드(세로선, 가로선 그리는 for 루프) 다음에 아래 코드를 추가합니다.

for r in range(self.board_rows):
    for c in range(self.board_columns):
        if self.board[r][c] is not None:
            x = self.board_left + c * self.cell_size
            y = self.board_top + r * self.cell_size
            rect = pygame.Rect(x, y, self.cell_size - 1, self.cell_size - 1)
            pygame.draw.rect(self.screen, self.board[r][c], rect)

## 완료 후 제출 형식
1. 변경한 파일 목록
2. 추가/수정된 메서드 목록
3. python -m py_compile 결과
```
