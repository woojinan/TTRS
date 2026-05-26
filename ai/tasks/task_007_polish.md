# Task 007 - 7-bag 랜덤 · 다음 블록 · 하드드롭 · 고스트

## Goal

7-bag 랜덤 생성기로 블록을 공정하게 공급한다. 다음 블록을 미리 보여주고, Space로 즉시 하드드롭, 반투명 고스트로 착지 위치를 표시한다.

## Context

Task 006 완료 후 상태:
- 블록이 항상 "T"만 스폰됨
- `spawn_piece()` — `Tetromino("T")` 고정
- `can_place(cells, row, col)` — 충돌 검사 일반화 완료
- 다음 블록 미리보기 없음
- 하드드롭 없음
- 고스트 피스 없음

## Files to Modify

- `c:\Users\C544\Desktop\TTRS\main.py`

## Requirements

- [ ] `import random` 추가
- [ ] `Game.__init__`에 `self.bag = []`, `self.next_piece` 추가, `next_from_bag()` 호출로 초기화
- [ ] `next_from_bag()` 메서드 — bag 비어 있으면 7가지 셔플, 하나 꺼내 Tetromino 반환
- [ ] `spawn_piece()` 수정 — `next_from_bag()`으로 교체
- [ ] `ghost_row()` 메서드 — 현재 piece가 착지할 행 번호 반환
- [ ] `draw_ghost_piece()` 메서드 — ghost_row 위치에 outline 사각형으로 렌더링
- [ ] `draw_next_piece()` 메서드 — 보드 오른쪽 패널에 next_piece 렌더링
- [ ] `draw()` 수정 — `draw_ghost_piece()`, `draw_next_piece()` 호출 추가
- [ ] `handle_keydown` — Space: `hard_drop()` 호출
- [ ] `hard_drop()` 메서드 — ghost_row로 piece.row 이동 후 lock → spawn

## 구현 명세

### import random 추가
파일 상단 import 블록에 추가합니다.

```python
import random
```

### Game.__init__ 추가 (self.board 줄 다음)

```python
self.bag        = []
self.next_piece = self.next_from_bag()
```

### next_from_bag 메서드

```python
def next_from_bag(self) -> "Tetromino":
    if not self.bag:
        self.bag = list(Tetromino.SHAPES.keys())
        random.shuffle(self.bag)
    return Tetromino(self.bag.pop())
```

### spawn_piece 수정

```python
def spawn_piece(self) -> None:
    self.current_piece = self.next_piece
    self.next_piece    = self.next_from_bag()
    if not self.can_move(0, 0):
        self.running = False
```

### ghost_row 메서드

```python
def ghost_row(self) -> int:
    row = self.current_piece.row
    while self.can_place(self.current_piece.cells, row + 1, self.current_piece.col):
        row += 1
    return row
```

### hard_drop 메서드

```python
def hard_drop(self) -> None:
    self.current_piece.row = self.ghost_row()
    self.lock_piece()
    self.spawn_piece()
```

### draw_ghost_piece 메서드

```python
def draw_ghost_piece(self) -> None:
    piece   = self.current_piece
    g_row   = self.ghost_row()
    if g_row == piece.row:
        return
    for dr, dc in piece.cells:
        x = self.board_left + (piece.col + dc) * self.cell_size
        y = self.board_top  + (g_row  + dr)   * self.cell_size
        rect = pygame.Rect(x, y, self.cell_size - 1, self.cell_size - 1)
        pygame.draw.rect(self.screen, piece.color, rect, width=1)
```

### draw_next_piece 메서드

```python
def draw_next_piece(self) -> None:
    piece   = self.next_piece
    panel_x = self.board_left + self.board_width + 16
    panel_y = self.board_top  + 40
    label   = pygame.font.Font(None, 22).render("NEXT", True, COLOR_TEXT)
    self.screen.blit(label, (panel_x, panel_y - 20))
    for dr, dc in piece.cells:
        x = panel_x + dc * self.cell_size
        y = panel_y + dr * self.cell_size
        rect = pygame.Rect(x, y, self.cell_size - 1, self.cell_size - 1)
        pygame.draw.rect(self.screen, piece.color, rect)
```

### draw 수정

```python
def draw(self) -> None:
    self.screen.fill(COLOR_BACKGROUND)
    self.draw_board()
    self.draw_ghost_piece()
    self.draw_current_piece()
    self.draw_next_piece()
    self.draw_status_text()
    pygame.display.flip()
```

draw_ghost_piece()는 draw_current_piece() 보다 먼저 호출합니다 (현재 블록이 고스트 위에 그려짐).

### handle_keydown 수정 (K_UP elif 다음에 추가)

```python
elif key == pygame.K_SPACE:
    self.hard_drop()
```

## Out of Scope

- 홀드 피스
- SRS 벽킥
- 콤보, 백투백
- 게임오버 화면 (창 종료만)
- 멀티플레이, 가비지 라인

## Verification

```powershell
python -m py_compile c:\Users\C544\Desktop\TTRS\main.py
python c:\Users\C544\Desktop\TTRS\main.py
```

## Expected Result

- 블록이 7가지 중 랜덤으로 공정하게 공급된다.
- 보드 오른쪽에 다음 블록이 미리 표시된다.
- Space 키를 누르면 블록이 즉시 바닥(또는 쌓인 블록 위)에 착지한다.
- 반투명(outline) 고스트가 착지 위치를 보여준다.
- 기존 이동/회전/락/줄삭제/점수 기능은 그대로 동작한다.

## Codex Prompt

```
다음 지시에 따라 c:\Users\C544\Desktop\TTRS\main.py 파일만 수정하세요.

## 목표
7-bag 랜덤 생성, 다음 블록 미리보기, 하드드롭(Space), 고스트 피스를 추가합니다.

## 반드시 지킬 규칙
- main.py 이외의 파일은 생성하거나 수정하지 않습니다.
- 기존 메서드 이름과 시그니처를 변경하지 않습니다.
- 기존 상수를 수정하거나 삭제하지 않습니다.
- 홀드, SRS 벽킥, 콤보, 게임오버 화면은 구현하지 않습니다.

## 구현 내용

### 1. import random 추가
파일 맨 위 import 블록(import sys, import pygame 근처)에 추가합니다.

  import random

### 2. Game.__init__ 수정
self.board 줄 바로 다음에 아래 두 줄을 추가합니다.

  self.bag        = []
  self.next_piece = self.next_from_bag()

주의: next_from_bag() 는 아래 3번에서 추가하는 메서드입니다.
__init__ 에서 self.next_piece 를 할당하는 시점에 이 메서드가 이미 정의되어 있어야 합니다.
Game 클래스의 __init__ 은 다른 메서드들이 정의된 뒤에도 호출되므로 순서는 상관없습니다.

### 3. next_from_bag 메서드 추가 (spawn_piece 위에 추가)

def next_from_bag(self) -> "Tetromino":
    if not self.bag:
        self.bag = list(Tetromino.SHAPES.keys())
        random.shuffle(self.bag)
    return Tetromino(self.bag.pop())

bag가 비어 있으면 7가지 shape 키를 섞어서 채우고, 하나를 꺼내 Tetromino로 반환합니다.

### 4. spawn_piece 수정

def spawn_piece(self) -> None:
    self.current_piece = self.next_piece
    self.next_piece    = self.next_from_bag()
    if not self.can_move(0, 0):
        self.running = False

기존 Tetromino("T") 고정 생성을 next_piece 교체 방식으로 변경합니다.

### 5. ghost_row 메서드 추가 (hard_drop 위에 추가)

def ghost_row(self) -> int:
    row = self.current_piece.row
    while self.can_place(self.current_piece.cells, row + 1, self.current_piece.col):
        row += 1
    return row

현재 piece가 수직으로 떨어질 수 있는 가장 낮은 행 번호를 반환합니다.

### 6. hard_drop 메서드 추가 (ghost_row 아래에 추가)

def hard_drop(self) -> None:
    self.current_piece.row = self.ghost_row()
    self.lock_piece()
    self.spawn_piece()

### 7. draw_ghost_piece 메서드 추가 (draw_current_piece 위에 추가)

def draw_ghost_piece(self) -> None:
    piece = self.current_piece
    g_row = self.ghost_row()
    if g_row == piece.row:
        return
    for dr, dc in piece.cells:
        x = self.board_left + (piece.col + dc) * self.cell_size
        y = self.board_top  + (g_row  + dr)   * self.cell_size
        rect = pygame.Rect(x, y, self.cell_size - 1, self.cell_size - 1)
        pygame.draw.rect(self.screen, piece.color, rect, width=1)

width=1 로 테두리만 그려서 반투명 효과를 냅니다.

### 8. draw_next_piece 메서드 추가 (draw_status_text 위에 추가)

def draw_next_piece(self) -> None:
    piece   = self.next_piece
    panel_x = self.board_left + self.board_width + 16
    panel_y = self.board_top  + 40
    label   = pygame.font.Font(None, 22).render("NEXT", True, COLOR_TEXT)
    self.screen.blit(label, (panel_x, panel_y - 20))
    for dr, dc in piece.cells:
        x = panel_x + dc * self.cell_size
        y = panel_y + dr * self.cell_size
        rect = pygame.Rect(x, y, self.cell_size - 1, self.cell_size - 1)
        pygame.draw.rect(self.screen, piece.color, rect)

### 9. draw 메서드 수정
기존 draw 메서드를 아래로 교체합니다.

def draw(self) -> None:
    self.screen.fill(COLOR_BACKGROUND)
    self.draw_board()
    self.draw_ghost_piece()
    self.draw_current_piece()
    self.draw_next_piece()
    self.draw_status_text()
    pygame.display.flip()

draw_ghost_piece() 가 draw_current_piece() 보다 먼저 호출되어야 합니다.
(현재 블록이 고스트 위에 덮여서 보입니다)

### 10. handle_keydown 수정
기존 K_UP elif 블록 다음에 아래를 추가합니다.

elif key == pygame.K_SPACE:
    self.hard_drop()

## 완료 후 제출 형식
1. 변경한 파일 목록
2. 추가/수정된 메서드 목록
3. python -m py_compile 결과
```
