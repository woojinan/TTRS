# Task 006 - 블록 회전

## Goal

UP 키로 현재 블록을 시계방향 90도 회전한다. 회전 후 경계 또는 보드 블록과 충돌하면 회전을 취소한다.

## Context

Task 005 완료 후 상태:
- `can_move(dr, dc)` — 경계 + 보드 충돌 검사
- `Tetromino.cells` — 상대 (row, col) 오프셋 리스트
- UP 키는 아직 처리되지 않음

회전 구현 전략:
- 수학적 CW 회전: (dr, dc) → (dc, -dr)
- 회전 후 최소 row/col 오프셋으로 정규화 (음수 좌표 제거)
- 회전된 cells와 현재 위치로 can_place 검사 후 통과 시 적용

## Files to Modify

- `c:\Users\C544\Desktop\TTRS\main.py`

## Requirements

- [ ] `can_place(cells, row, col) -> bool` 메서드 추가 — 임의 cells+위치로 충돌 검사 (can_move를 일반화)
- [ ] `can_move()` 수정 — `can_place(piece.cells, piece.row+dr, piece.col+dc)` 위임
- [ ] Tetromino에 `rotate_cw()` 메서드 추가 — cells를 CW 변환 후 정규화한 새 리스트 반환
- [ ] `handle_keydown` — UP 키 추가: rotate_cw() 결과를 can_place로 검사, 통과 시 piece.cells 교체

## 구현 명세

### can_place 메서드 (can_move 위에 추가)

```python
def can_place(self, cells: list, row: int, col: int) -> bool:
    """Return True if given cells can be placed at (row, col)."""
    for dr, dc in cells:
        r = row + dr
        c = col + dc
        if r < 0 or r >= self.board_rows:
            return False
        if c < 0 or c >= self.board_columns:
            return False
        if self.board[r][c] is not None:
            return False
    return True
```

### can_move 수정

```python
def can_move(self, dr: int, dc: int) -> bool:
    piece = self.current_piece
    return self.can_place(piece.cells, piece.row + dr, piece.col + dc)
```

### Tetromino.rotate_cw 메서드 추가 (__init__ 아래에 추가)

```python
def rotate_cw(self) -> list:
    """Return cells rotated 90° clockwise, normalized to (0,0) origin."""
    rotated = [(dc, -dr) for dr, dc in self.cells]
    min_r = min(r for r, c in rotated)
    min_c = min(c for r, c in rotated)
    return [(r - min_r, c - min_c) for r, c in rotated]
```

### handle_keydown 수정 (K_DOWN elif 다음에 추가)

```python
elif key == pygame.K_UP:
    rotated = self.current_piece.rotate_cw()
    if self.can_place(rotated, self.current_piece.row, self.current_piece.col):
        self.current_piece.cells = rotated
```

## Out of Scope

- SRS 벽킥 (충돌 시 단순 취소)
- CCW 회전 (Z/X 키)
- 180도 회전
- 하드드롭, 고스트

## Verification

```powershell
python -m py_compile c:\Users\C544\Desktop\TTRS\main.py
python c:\Users\C544\Desktop\TTRS\main.py
```

## Expected Result

- UP 키로 블록이 시계방향 90도 회전한다.
- 벽이나 보드 블록과 겹치면 회전이 취소된다.
- 기존 LEFT/RIGHT/DOWN 이동, 중력, 락, 줄 삭제는 정상 동작한다.

## Codex Prompt

```
다음 지시에 따라 c:\Users\C544\Desktop\TTRS\main.py 파일만 수정하세요.

## 목표
UP 키로 현재 블록을 시계방향 90도 회전합니다.
회전 후 경계 또는 고정 블록과 충돌하면 회전을 취소합니다.

## 반드시 지킬 규칙
- main.py 이외의 파일은 생성하거나 수정하지 않습니다.
- 기존 메서드 이름과 시그니처를 변경하지 않습니다.
- 기존 상수를 수정하거나 삭제하지 않습니다.
- SRS 벽킥, CCW 회전, 하드드롭, 고스트는 구현하지 않습니다.

## 구현 내용

### 1. Tetromino.rotate_cw 메서드 추가
Tetromino.__init__ 아래에 추가합니다.

def rotate_cw(self) -> list:
    rotated = [(dc, -dr) for dr, dc in self.cells]
    min_r = min(r for r, c in rotated)
    min_c = min(c for r, c in rotated)
    return [(r - min_r, c - min_c) for r, c in rotated]

설명:
- (dr, dc) → (dc, -dr): CW 90도 회전 공식
- min_r, min_c 로 정규화하여 음수 좌표 제거

### 2. Game.can_place 메서드 추가
기존 can_move 바로 위에 추가합니다.

def can_place(self, cells: list, row: int, col: int) -> bool:
    for dr, dc in cells:
        r = row + dr
        c = col + dc
        if r < 0 or r >= self.board_rows:
            return False
        if c < 0 or c >= self.board_columns:
            return False
        if self.board[r][c] is not None:
            return False
    return True

### 3. Game.can_move 수정
기존 구현을 아래 한 줄로 교체합니다.

def can_move(self, dr: int, dc: int) -> bool:
    piece = self.current_piece
    return self.can_place(piece.cells, piece.row + dr, piece.col + dc)

### 4. handle_keydown 수정
기존 K_DOWN elif 블록 다음에 아래를 추가합니다.

elif key == pygame.K_UP:
    rotated = self.current_piece.rotate_cw()
    if self.can_place(rotated, self.current_piece.row, self.current_piece.col):
        self.current_piece.cells = rotated

## 완료 후 제출 형식
1. 변경한 파일 목록
2. 추가/수정된 메서드 목록
3. python -m py_compile 결과
```
