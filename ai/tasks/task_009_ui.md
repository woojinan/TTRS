# Task 009 - UI 개선 · 게임오버 화면 · 재시작

## Goal

셀 3D 렌더링, 좌우 패널 박스, 상단 타이틀을 정리하여 시각적 완성도를 높인다.
게임오버 시 오버레이를 표시하고 R 키로 재시작한다.

## Context

Task 008 완료 후 상태:
- `self.held_left`, `self.held_right`, `self.das_timer`, `self.arr_timer` 존재
- `spawn_piece()` — `self.running = False`로 창을 바로 닫음
- `draw_next_piece()`, `draw_status_text()` — 별도 메서드로 분리돼 있음
- `SCREEN_WIDTH = 520`: board_left = 140, 좌우 각 140px 여백 있음

현재 레이아웃 수치:
- board_left = 140, board_top = 80, board_width = 240, board_height = 480
- 좌측 패널 가용 공간: x 0~130 (130px)
- 우측 패널 가용 공간: x 390~510 (120px)

## Files to Modify

- `c:\Users\C544\Desktop\TTRS\main.py`

## Requirements

- [ ] 새 상수 3개 추가: `COLOR_PANEL`, `COLOR_PANEL_BDR`, `COLOR_BOARD_BG`
- [ ] `Game.__init__`에 `self.game_over = False` 추가, 폰트 4개 캐싱
- [ ] `spawn_piece()` 수정: `self.running = False` → `self.game_over = True`
- [ ] `update()` 첫 줄에 `if self.game_over: return` 추가
- [ ] `handle_keydown()` 첫 블록: game_over 상태면 R/ESC만 처리 후 return
- [ ] `reset_game()` 메서드 추가 — 보드·점수·레벨·타이머·DAS·game_over 초기화
- [ ] `draw_cell(x, y, color)` 헬퍼 추가 — 하이라이트/그림자 선으로 3D 셀
- [ ] `draw_panel(x, y, w, h)` 헬퍼 추가 — 어두운 배경 + 테두리 박스
- [ ] `draw_game_over()` 메서드 추가 — 반투명 오버레이 + GAME OVER + 점수 + 재시작 안내
- [ ] `draw_side_panels()` 메서드 추가 — 좌측 패널(SCORE/LEVEL/LINES) + 우측 패널(NEXT)
- [ ] `draw_board()` 수정 — 보드 배경 추가, 고정 셀 렌더링에 `draw_cell()` 사용
- [ ] `draw_current_piece()` 수정 — `draw_cell()` 사용
- [ ] `draw()` 수정 — `draw_side_panels()` 호출, game_over 시 `draw_game_over()` 호출, 타이틀 렌더링
- [ ] `draw_next_piece()`, `draw_status_text()` 제거 (`draw_side_panels()`로 통합)

## 구현 명세

### 새 상수 (COLOR_TEXT 다음 줄에 추가)

```python
COLOR_PANEL     = (28, 28, 38)
COLOR_PANEL_BDR = (60, 60, 80)
COLOR_BOARD_BG  = (12, 12, 18)
```

### Game.__init__ 추가

```python
# self.gravity_interval = FPS 다음 줄 (DAS 변수들 다음)
self.game_over = False

# 폰트 캐싱 (self.font 기존 줄 교체 또는 추가)
self.font_title = pygame.font.Font(None, 48)
self.font_label = pygame.font.Font(None, 20)
self.font_value = pygame.font.Font(None, 28)
self.font_over  = pygame.font.Font(None, 56)
```

기존 self.font = pygame.font.Font(None, 32) 는 삭제해도 됩니다.

### spawn_piece 수정

```python
def spawn_piece(self) -> None:
    self.current_piece = self.next_piece
    self.next_piece    = self.next_from_bag()
    if not self.can_move(0, 0):
        self.game_over = True
```

### update 수정 (첫 줄 추가)

```python
def update(self) -> None:
    if self.game_over:
        return
    # 기존 중력 및 DAS 코드 유지
```

### handle_keydown 수정 (메서드 첫 블록 추가)

```python
def handle_keydown(self, key: int) -> None:
    if self.game_over:
        if key == pygame.K_r:
            self.reset_game()
        elif key == pygame.K_ESCAPE:
            self.running = False
        return
    # 기존 ESC, LEFT, RIGHT, DOWN, UP, SPACE 처리 유지
```

### reset_game 메서드 추가 (spawn_piece 아래)

```python
def reset_game(self) -> None:
    self.board          = [[None] * self.board_columns for _ in range(self.board_rows)]
    self.bag            = []
    self.score          = 0
    self.lines_cleared  = 0
    self.level          = 1
    self.gravity_interval = FPS
    self.gravity_timer  = 0
    self.held_left      = False
    self.held_right     = False
    self.das_timer      = 0
    self.arr_timer      = 0
    self.next_piece     = self.next_from_bag()
    self.current_piece  = self.next_from_bag()
    self.game_over      = False
```

### draw_cell 메서드 추가 (draw 메서드 위에 추가)

```python
def draw_cell(self, x: int, y: int, color: tuple) -> None:
    s = self.cell_size
    pygame.draw.rect(self.screen, color, (x, y, s - 1, s - 1))
    hi = tuple(min(255, v + 60) for v in color)
    sh = tuple(max(0,   v - 60) for v in color)
    pygame.draw.line(self.screen, hi, (x,         y        ), (x + s - 2, y        ))
    pygame.draw.line(self.screen, hi, (x,         y        ), (x,         y + s - 2))
    pygame.draw.line(self.screen, sh, (x + s - 2, y + 1    ), (x + s - 2, y + s - 2))
    pygame.draw.line(self.screen, sh, (x + 1,     y + s - 2), (x + s - 2, y + s - 2))
```

### draw_panel 메서드 추가 (draw_cell 아래)

```python
def draw_panel(self, x: int, y: int, w: int, h: int) -> None:
    pygame.draw.rect(self.screen, COLOR_PANEL,     (x, y, w, h), border_radius=4)
    pygame.draw.rect(self.screen, COLOR_PANEL_BDR, (x, y, w, h), width=1, border_radius=4)
```

### draw_game_over 메서드 추가 (draw_panel 아래)

```python
def draw_game_over(self) -> None:
    overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
    overlay.fill((0, 0, 0, 160))
    self.screen.blit(overlay, (0, 0))
    cx, cy = SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2
    title = self.font_over.render("GAME OVER", True, (240, 60, 60))
    score = self.font_value.render(f"SCORE  {self.score}", True, COLOR_TEXT)
    hint  = self.font_label.render("R — RESTART        ESC — QUIT", True, (160, 160, 180))
    self.screen.blit(title, title.get_rect(center=(cx, cy - 60)))
    self.screen.blit(score, score.get_rect(center=(cx, cy)))
    self.screen.blit(hint,  hint.get_rect(center=(cx, cy + 50)))
```

### draw_side_panels 메서드 추가 (draw_game_over 아래)

```python
def draw_side_panels(self) -> None:
    # 좌측 패널: SCORE / LEVEL / LINES
    lx, ly, lw, lh = 10, self.board_top, 120, 160
    self.draw_panel(lx, ly, lw, lh)
    for i, (label, value) in enumerate([
        ("SCORE", str(self.score)),
        ("LEVEL", str(self.level)),
        ("LINES", str(self.lines_cleared)),
    ]):
        yb = ly + 16 + i * 48
        self.screen.blit(
            self.font_label.render(label, True, (130, 130, 160)), (lx + 10, yb))
        self.screen.blit(
            self.font_value.render(value, True, COLOR_TEXT),       (lx + 10, yb + 18))

    # 우측 패널: NEXT 피스
    rx = self.board_left + self.board_width + 10
    ry, rw, rh = self.board_top, 120, 110
    self.draw_panel(rx, ry, rw, rh)
    self.screen.blit(
        self.font_label.render("NEXT", True, (130, 130, 160)), (rx + 10, ry + 10))
    piece  = self.next_piece
    off_x  = rx + (rw - 4 * self.cell_size) // 2
    off_y  = ry + 34
    for dr, dc in piece.cells:
        self.draw_cell(off_x + dc * self.cell_size, off_y + dr * self.cell_size, piece.color)
```

### draw_board 수정

```python
def draw_board(self) -> None:
    # 보드 배경
    pygame.draw.rect(self.screen, COLOR_BOARD_BG,
        (self.board_left, self.board_top, self.board_width, self.board_height))
    # 그리드 테두리
    pygame.draw.rect(self.screen, COLOR_PANEL_BDR,
        (self.board_left, self.board_top, self.board_width, self.board_height), width=1)
    # 격자 선
    for column in range(1, self.board_columns):
        x = self.board_left + column * self.cell_size
        pygame.draw.line(self.screen, COLOR_GRID,
            (x, self.board_top), (x, self.board_top + self.board_height))
    for row in range(1, self.board_rows):
        y = self.board_top + row * self.cell_size
        pygame.draw.line(self.screen, COLOR_GRID,
            (self.board_left, y), (self.board_left + self.board_width, y))
    # 고정된 블록 (draw_cell 사용)
    for r in range(self.board_rows):
        for c in range(self.board_columns):
            if self.board[r][c] is not None:
                self.draw_cell(
                    self.board_left + c * self.cell_size,
                    self.board_top  + r * self.cell_size,
                    self.board[r][c])
```

### draw_current_piece 수정

```python
def draw_current_piece(self) -> None:
    piece = self.current_piece
    for dr, dc in piece.cells:
        self.draw_cell(
            self.board_left + (piece.col + dc) * self.cell_size,
            self.board_top  + (piece.row + dr) * self.cell_size,
            piece.color)
```

### draw 수정

```python
def draw(self) -> None:
    self.screen.fill(COLOR_BACKGROUND)
    # 상단 타이틀
    title = self.font_title.render("TETRIS", True, COLOR_TEXT)
    self.screen.blit(title, title.get_rect(center=(SCREEN_WIDTH // 2, 42)))
    self.draw_board()
    self.draw_ghost_piece()
    self.draw_current_piece()
    self.draw_side_panels()
    if self.game_over:
        self.draw_game_over()
    pygame.display.flip()
```

### draw_next_piece, draw_status_text 제거

draw_side_panels로 통합되므로 두 메서드를 삭제합니다.

## Out of Scope

- 홀드 피스 패널
- 애니메이션 (줄 삭제 플래시 등)
- 사운드

## Verification

```powershell
python -m py_compile c:\Users\C544\Desktop\TTRS\main.py
python c:\Users\C544\Desktop\TTRS\main.py
```

## Expected Result

- 블록에 상단 하이라이트 + 하단 그림자 선이 생겨 입체적으로 보인다.
- 좌측 패널 박스에 SCORE / LEVEL / LINES가 표시된다.
- 우측 패널 박스에 NEXT 피스가 표시된다.
- 상단에 TETRIS 타이틀이 표시된다.
- 게임오버 시 반투명 오버레이에 GAME OVER + 점수 + R/ESC 안내가 표시된다.
- R 키로 게임이 리셋되고 새 게임이 시작된다.
- ESC는 게임오버 상태에서만 창을 닫는다.

## Codex Prompt

```
다음 지시에 따라 c:\Users\C544\Desktop\TTRS\main.py 파일만 수정하세요.

## 목표
UI를 개선하고 게임오버 오버레이 + R키 재시작을 추가합니다.

## 반드시 지킬 규칙
- main.py 이외의 파일은 수정하지 않습니다.
- Tetromino 클래스(SHAPES, COLORS, __init__, rotate_cw)를 변경하지 않습니다.
- can_move, can_place, lock_piece, clear_lines, update_level, next_from_bag, ghost_row, hard_drop 메서드의 기능을 변경하지 않습니다.
- SCREEN_WIDTH, SCREEN_HEIGHT, FPS, COLOR_BACKGROUND, COLOR_GRID, COLOR_TEXT를 삭제하거나 변경하지 않습니다.

## 구현 내용

### 1. 새 상수 추가 (COLOR_TEXT 다음 줄)

  COLOR_PANEL     = (28, 28, 38)
  COLOR_PANEL_BDR = (60, 60, 80)
  COLOR_BOARD_BG  = (12, 12, 18)

### 2. Game.__init__ 수정
DAS 변수(self.arr_rate = 2) 다음에 아래를 추가합니다.

  self.game_over = False

기존 self.font = pygame.font.Font(None, 32) 를 아래 4줄로 교체합니다.

  self.font_title = pygame.font.Font(None, 48)
  self.font_label = pygame.font.Font(None, 20)
  self.font_value = pygame.font.Font(None, 28)
  self.font_over  = pygame.font.Font(None, 56)

### 3. spawn_piece 수정
self.running = False 를 self.game_over = True 로 교체합니다.

### 4. update 수정
메서드 첫 줄에 아래를 추가합니다.

  if self.game_over:
      return

### 5. handle_keydown 수정
메서드 첫 부분(if key == pygame.K_ESCAPE 이전)에 아래 블록을 추가합니다.

  if self.game_over:
      if key == pygame.K_r:
          self.reset_game()
      elif key == pygame.K_ESCAPE:
          self.running = False
      return

### 6. reset_game 메서드 추가 (spawn_piece 아래)

def reset_game(self) -> None:
    self.board          = [[None] * self.board_columns for _ in range(self.board_rows)]
    self.bag            = []
    self.score          = 0
    self.lines_cleared  = 0
    self.level          = 1
    self.gravity_interval = FPS
    self.gravity_timer  = 0
    self.held_left      = False
    self.held_right     = False
    self.das_timer      = 0
    self.arr_timer      = 0
    self.next_piece     = self.next_from_bag()
    self.current_piece  = self.next_from_bag()
    self.game_over      = False

### 7. draw_cell 메서드 추가 (draw 메서드 위)

def draw_cell(self, x: int, y: int, color: tuple) -> None:
    s = self.cell_size
    pygame.draw.rect(self.screen, color, (x, y, s - 1, s - 1))
    hi = tuple(min(255, v + 60) for v in color)
    sh = tuple(max(0,   v - 60) for v in color)
    pygame.draw.line(self.screen, hi, (x,         y        ), (x + s - 2, y        ))
    pygame.draw.line(self.screen, hi, (x,         y        ), (x,         y + s - 2))
    pygame.draw.line(self.screen, sh, (x + s - 2, y + 1    ), (x + s - 2, y + s - 2))
    pygame.draw.line(self.screen, sh, (x + 1,     y + s - 2), (x + s - 2, y + s - 2))

### 8. draw_panel 메서드 추가 (draw_cell 아래)

def draw_panel(self, x: int, y: int, w: int, h: int) -> None:
    pygame.draw.rect(self.screen, COLOR_PANEL,     (x, y, w, h), border_radius=4)
    pygame.draw.rect(self.screen, COLOR_PANEL_BDR, (x, y, w, h), width=1, border_radius=4)

### 9. draw_game_over 메서드 추가 (draw_panel 아래)

def draw_game_over(self) -> None:
    overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
    overlay.fill((0, 0, 0, 160))
    self.screen.blit(overlay, (0, 0))
    cx, cy = SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2
    title = self.font_over.render("GAME OVER", True, (240, 60, 60))
    score = self.font_value.render(f"SCORE  {self.score}", True, COLOR_TEXT)
    hint  = self.font_label.render("R — RESTART        ESC — QUIT", True, (160, 160, 180))
    self.screen.blit(title, title.get_rect(center=(cx, cy - 60)))
    self.screen.blit(score, score.get_rect(center=(cx, cy)))
    self.screen.blit(hint,  hint.get_rect(center=(cx, cy + 50)))

### 10. draw_side_panels 메서드 추가 (draw_game_over 아래)

def draw_side_panels(self) -> None:
    lx, ly, lw, lh = 10, self.board_top, 120, 160
    self.draw_panel(lx, ly, lw, lh)
    for i, (label, value) in enumerate([
        ("SCORE", str(self.score)),
        ("LEVEL", str(self.level)),
        ("LINES", str(self.lines_cleared)),
    ]):
        yb = ly + 16 + i * 48
        self.screen.blit(self.font_label.render(label, True, (130, 130, 160)), (lx + 10, yb))
        self.screen.blit(self.font_value.render(value, True, COLOR_TEXT),       (lx + 10, yb + 18))

    rx = self.board_left + self.board_width + 10
    ry, rw, rh = self.board_top, 120, 110
    self.draw_panel(rx, ry, rw, rh)
    self.screen.blit(self.font_label.render("NEXT", True, (130, 130, 160)), (rx + 10, ry + 10))
    piece = self.next_piece
    off_x = rx + (rw - 4 * self.cell_size) // 2
    off_y = ry + 34
    for dr, dc in piece.cells:
        self.draw_cell(off_x + dc * self.cell_size, off_y + dr * self.cell_size, piece.color)

### 11. draw_board 수정 (전체 교체)

def draw_board(self) -> None:
    pygame.draw.rect(self.screen, COLOR_BOARD_BG,
        (self.board_left, self.board_top, self.board_width, self.board_height))
    pygame.draw.rect(self.screen, COLOR_PANEL_BDR,
        (self.board_left, self.board_top, self.board_width, self.board_height), width=1)
    for column in range(1, self.board_columns):
        x = self.board_left + column * self.cell_size
        pygame.draw.line(self.screen, COLOR_GRID,
            (x, self.board_top), (x, self.board_top + self.board_height))
    for row in range(1, self.board_rows):
        y = self.board_top + row * self.cell_size
        pygame.draw.line(self.screen, COLOR_GRID,
            (self.board_left, y), (self.board_left + self.board_width, y))
    for r in range(self.board_rows):
        for c in range(self.board_columns):
            if self.board[r][c] is not None:
                self.draw_cell(
                    self.board_left + c * self.cell_size,
                    self.board_top  + r * self.cell_size,
                    self.board[r][c])

### 12. draw_current_piece 수정 (전체 교체)

def draw_current_piece(self) -> None:
    piece = self.current_piece
    for dr, dc in piece.cells:
        self.draw_cell(
            self.board_left + (piece.col + dc) * self.cell_size,
            self.board_top  + (piece.row + dr) * self.cell_size,
            piece.color)

### 13. draw 수정 (전체 교체)

def draw(self) -> None:
    self.screen.fill(COLOR_BACKGROUND)
    title = self.font_title.render("TETRIS", True, COLOR_TEXT)
    self.screen.blit(title, title.get_rect(center=(SCREEN_WIDTH // 2, 42)))
    self.draw_board()
    self.draw_ghost_piece()
    self.draw_current_piece()
    self.draw_side_panels()
    if self.game_over:
        self.draw_game_over()
    pygame.display.flip()

### 14. draw_next_piece, draw_status_text 메서드 삭제
두 메서드는 draw_side_panels로 통합되므로 완전히 삭제합니다.

## 완료 후 제출 형식
1. 변경한 파일 목록
2. 추가/수정/삭제된 메서드 목록
3. python -m py_compile 결과
```
