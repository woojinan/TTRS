# Task 011 - SRS 회전 + CCW + Hold + Next 큐 5개

## Goal

1. Tetromino에 rotation_state 추적 + SRS 표준 킥 테이블 적용
2. CCW (반시계방향) 회전 추가 (Z / Ctrl 키)
3. Hold 시스템 구현 (C / Shift 키)
4. Next 큐를 5개로 확장 및 UI 표시

## Context

현재 상태:
- `rotate_cw()` 메서드가 있으나 rotation_state 미추적
- K_UP 핸들러에 단순 col 오프셋 [0,-1,+1,-2,+2] 벽킥 사용 (SRS 아님)
- `self.next_piece` 단일 필드로 다음 1개 피스만 관리
- Hold, CCW 없음

## Files to Modify

- `c:\Users\C544\Desktop\TTRS\main.py`

## 구현 명세

### 1. Tetromino 클래스 수정

기존 `rotate_cw(self) -> list` 메서드를 제거하고 아래로 교체.
`__init__`에 `self.shape = shape`와 `self.rotation_state = 0` 추가.

#### 1-1. `__init__` 수정

```python
# 변경 전
def __init__(self, shape: str) -> None:
    self.cells = self.SHAPES[shape]
    self.color = self.COLORS[shape]
    self.row = 0
    self.col = 3

# 변경 후
def __init__(self, shape: str) -> None:
    self.shape = shape
    self.cells = list(self.SHAPES[shape])
    self.color = self.COLORS[shape]
    self.row = 0
    self.col = 3
    self.rotation_state = 0
```

#### 1-2. 클래스 상수 추가 (COLORS 딕셔너리 바로 아래)

```python
# SRS 킥 테이블 (dr, dc) — 각 배열: [state0→, state1→, state2→, state3→]
_KICKS_JLSTZ_CW = [
    [(0,0), (0,-1), (+1,-1), (-2,0), (-2,-1)],
    [(0,0), (0,+1), (-1,+1), (+2,0), (+2,+1)],
    [(0,0), (0,+1), (+1,+1), (-2,0), (-2,+1)],
    [(0,0), (0,-1), (-1,-1), (+2,0), (+2,-1)],
]
_KICKS_JLSTZ_CCW = [
    [(0,0), (0,+1), (+1,+1), (-2,0), (-2,+1)],
    [(0,0), (0,+1), (-1,+1), (+2,0), (+2,+1)],
    [(0,0), (0,-1), (+1,-1), (-2,0), (-2,-1)],
    [(0,0), (0,-1), (-1,-1), (+2,0), (+2,-1)],
]
_KICKS_I_CW = [
    [(0,0), (0,-2), (0,+1), (+1,-2), (-2,+1)],
    [(0,0), (0,-1), (0,+2), (-2,-1), (+1,+2)],
    [(0,0), (0,+2), (0,-1), (-1,+2), (+2,-1)],
    [(0,0), (0,+1), (0,-2), (+2,+1), (-1,-2)],
]
_KICKS_I_CCW = [
    [(0,0), (0,-1), (0,+2), (-2,-1), (+1,+2)],
    [(0,0), (0,+2), (0,-1), (-1,+2), (+2,-1)],
    [(0,0), (0,+1), (0,-2), (+2,+1), (-1,-2)],
    [(0,0), (0,-2), (0,+1), (+1,-2), (-2,+1)],
]
```

#### 1-3. 기존 `rotate_cw` 메서드 교체 (삭제 후 아래 3개 메서드 추가)

```python
def rotated_cells_cw(self) -> list:
    rotated = [(dc, -dr) for dr, dc in self.cells]
    min_r = min(r for r, c in rotated)
    min_c = min(c for r, c in rotated)
    return [(r - min_r, c - min_c) for r, c in rotated]

def rotated_cells_ccw(self) -> list:
    rotated = [(-dc, dr) for dr, dc in self.cells]
    min_r = min(r for r, c in rotated)
    min_c = min(c for r, c in rotated)
    return [(r - min_r, c - min_c) for r, c in rotated]

def kicks_cw(self) -> list:
    if self.shape == "I":
        return self._KICKS_I_CW[self.rotation_state]
    if self.shape == "O":
        return [(0, 0)]
    return self._KICKS_JLSTZ_CW[self.rotation_state]

def kicks_ccw(self) -> list:
    if self.shape == "I":
        return self._KICKS_I_CCW[self.rotation_state]
    if self.shape == "O":
        return [(0, 0)]
    return self._KICKS_JLSTZ_CCW[self.rotation_state]
```

### 2. Game 클래스 수정

#### 2-1. `__init__` — next_piece → next_queue, held_piece/can_hold 추가

```python
# 제거할 줄:
self.next_piece = self.next_from_bag()
...
self.current_piece = self.next_from_bag()

# 위 두 줄을 다음으로 교체 (self.bag = [] 바로 다음):
self.next_queue: list = []
for _ in range(6):
    self.next_queue.append(self.next_from_bag())
self.current_piece = self.next_queue.pop(0)
self.held_piece = None
self.can_hold = True
```

#### 2-2. 새 메서드 추가 (`next_from_bag` 바로 아래)

```python
def _refill_queue(self) -> None:
    while len(self.next_queue) < 5:
        self.next_queue.append(self.next_from_bag())

def try_rotate_cw(self) -> None:
    cells = self.current_piece.rotated_cells_cw()
    for dr, dc in self.current_piece.kicks_cw():
        nr = self.current_piece.row + dr
        nc = self.current_piece.col + dc
        if self.can_place(cells, nr, nc):
            self.current_piece.cells = cells
            self.current_piece.row = nr
            self.current_piece.col = nc
            self.current_piece.rotation_state = (self.current_piece.rotation_state + 1) % 4
            return

def try_rotate_ccw(self) -> None:
    cells = self.current_piece.rotated_cells_ccw()
    for dr, dc in self.current_piece.kicks_ccw():
        nr = self.current_piece.row + dr
        nc = self.current_piece.col + dc
        if self.can_place(cells, nr, nc):
            self.current_piece.cells = cells
            self.current_piece.row = nr
            self.current_piece.col = nc
            self.current_piece.rotation_state = (self.current_piece.rotation_state - 1) % 4
            return

def hold_piece(self) -> None:
    if not self.can_hold:
        return
    self.can_hold = False
    shape = self.current_piece.shape
    if self.held_piece is None:
        self.held_piece = Tetromino(shape)
        self.current_piece = self.next_queue.pop(0)
        self._refill_queue()
    else:
        new_cur = self.held_piece
        new_cur.row = 0
        new_cur.col = 3
        new_cur.rotation_state = 0
        new_cur.cells = list(Tetromino.SHAPES[new_cur.shape])
        self.held_piece = Tetromino(shape)
        self.current_piece = new_cur
    if not self.can_move(0, 0):
        self.game_over = True
```

#### 2-3. `spawn_piece` 수정

```python
# 변경 전
def spawn_piece(self) -> None:
    self.current_piece = self.next_piece
    self.next_piece = self.next_from_bag()
    if not self.can_move(0, 0):
        self.game_over = True

# 변경 후
def spawn_piece(self) -> None:
    self.can_hold = True
    self.current_piece = self.next_queue.pop(0)
    self._refill_queue()
    if not self.can_move(0, 0):
        self.game_over = True
```

#### 2-4. `reset_game` 수정 (next_piece → next_queue, held_piece/can_hold 추가)

```python
# 변경 전
self.next_piece = self.next_from_bag()
self.current_piece = self.next_from_bag()

# 위 두 줄을 다음으로 교체:
self.held_piece = None
self.can_hold = True
self.next_queue = []
for _ in range(6):
    self.next_queue.append(self.next_from_bag())
self.current_piece = self.next_queue.pop(0)
```

#### 2-5. `handle_keydown` K_UP 블록 교체 + K_z, K_c/LSHIFT/RSHIFT 추가

```python
# 변경 전
elif key == pygame.K_UP:
    rotated = self.current_piece.rotate_cw()
    for dc in [0, -1, 1, -2, 2]:
        if self.can_place(rotated, self.current_piece.row, self.current_piece.col + dc):
            self.current_piece.cells = rotated
            self.current_piece.col += dc
            break

# 변경 후 (K_UP 교체 + 아래 두 elif 추가)
elif key in (pygame.K_UP, pygame.K_x):
    self.try_rotate_cw()
elif key in (pygame.K_z, pygame.K_LCTRL, pygame.K_RCTRL):
    self.try_rotate_ccw()
elif key in (pygame.K_c, pygame.K_LSHIFT, pygame.K_RSHIFT):
    self.hold_piece()
```

#### 2-6. `draw_cell` — 선택적 size 파라미터 추가

```python
# 변경 전
def draw_cell(self, x: int, y: int, color: tuple) -> None:
    s = self.cell_size

# 변경 후
def draw_cell(self, x: int, y: int, color: tuple, size: int = 0) -> None:
    s = size if size > 0 else self.cell_size
```

(나머지 draw_cell 본문은 동일하게 유지)

#### 2-7. `draw_side_panels` 전체 교체

```python
def draw_side_panels(self) -> None:
    cs = 18  # 미리보기 셀 크기
    # 왼쪽 패널: SCORE / LEVEL / LINES / HOLD
    lx, ly, lw, lh = 10, self.board_top, 120, 270
    self.draw_panel(lx, ly, lw, lh)
    for i, (label, value) in enumerate([
        ("SCORE", str(self.score)),
        ("LEVEL", str(self.level)),
        ("LINES", str(self.lines_cleared)),
    ]):
        yb = ly + 16 + i * 48
        self.screen.blit(self.font_label.render(label, True, (130, 130, 160)), (lx + 10, yb))
        self.screen.blit(self.font_value.render(value, True, COLOR_TEXT), (lx + 10, yb + 18))
    hold_label_y = ly + 16 + 3 * 48 + 8
    self.screen.blit(self.font_label.render("HOLD", True, (130, 130, 160)), (lx + 10, hold_label_y))
    if self.held_piece is not None:
        p = self.held_piece
        color = p.color if self.can_hold else tuple(max(0, v - 100) for v in p.color)
        off_x = lx + (lw - 4 * cs) // 2
        off_y = hold_label_y + 18
        for dr, dc in p.cells:
            self.draw_cell(off_x + dc * cs, off_y + dr * cs, color, cs)
    # 오른쪽 패널: NEXT 5개
    rx = self.board_left + self.board_width + 10
    rw, rh = 120, 350
    ry = self.board_top
    self.draw_panel(rx, ry, rw, rh)
    self.screen.blit(self.font_label.render("NEXT", True, (130, 130, 160)), (rx + 10, ry + 10))
    for i, piece in enumerate(self.next_queue[:5]):
        py = ry + 30 + i * 64
        off_x = rx + (rw - 4 * cs) // 2
        for dr, dc in piece.cells:
            self.draw_cell(off_x + dc * cs, py + dr * cs, piece.color, cs)
```

## Out of Scope

- Lock Delay
- T-Spin 판정
- B2B / Combo / Perfect Clear
- SDF
- 프레임 독립 타이밍

## Verification

```powershell
python -m py_compile c:\Users\C544\Desktop\TTRS\main.py
python c:\Users\C544\Desktop\TTRS\main.py
```

## Expected Result

- ↑ / X: CW 회전 (SRS 킥 테이블 적용)
- Z / Ctrl: CCW 회전 (SRS 킥 테이블 적용)
- C / Shift: Hold (1회 제한, 재스폰 시 초기화)
- 오른쪽 패널에 다음 5개 피스 표시
- 왼쪽 패널 하단에 HOLD 피스 표시 (사용 불가 시 어둡게)

## Codex Prompt

```
다음 지시에 따라 c:\Users\C544\Desktop\TTRS\main.py 파일만 수정하세요.

## 반드시 지킬 규칙
- main.py 이외의 파일은 수정하지 않습니다.
- 명시된 변경 외에 다른 코드는 수정하지 않습니다.
- 기존 상수(SCREEN_WIDTH, SCREEN_HEIGHT, FPS, COLOR_*)는 변경하지 않습니다.

## 변경 1: Tetromino.__init__ 수정

기존:
    def __init__(self, shape: str) -> None:
        self.cells = self.SHAPES[shape]
        self.color = self.COLORS[shape]
        self.row = 0
        self.col = 3

변경 후:
    def __init__(self, shape: str) -> None:
        self.shape = shape
        self.cells = list(self.SHAPES[shape])
        self.color = self.COLORS[shape]
        self.row = 0
        self.col = 3
        self.rotation_state = 0

## 변경 2: Tetromino 클래스에 SRS 킥 테이블 상수 추가

COLORS 딕셔너리 닫는 중괄호(}) 바로 다음 줄에 추가합니다.

    _KICKS_JLSTZ_CW = [
        [(0,0), (0,-1), (+1,-1), (-2,0), (-2,-1)],
        [(0,0), (0,+1), (-1,+1), (+2,0), (+2,+1)],
        [(0,0), (0,+1), (+1,+1), (-2,0), (-2,+1)],
        [(0,0), (0,-1), (-1,-1), (+2,0), (+2,-1)],
    ]
    _KICKS_JLSTZ_CCW = [
        [(0,0), (0,+1), (+1,+1), (-2,0), (-2,+1)],
        [(0,0), (0,+1), (-1,+1), (+2,0), (+2,+1)],
        [(0,0), (0,-1), (+1,-1), (-2,0), (-2,-1)],
        [(0,0), (0,-1), (-1,-1), (+2,0), (+2,-1)],
    ]
    _KICKS_I_CW = [
        [(0,0), (0,-2), (0,+1), (+1,-2), (-2,+1)],
        [(0,0), (0,-1), (0,+2), (-2,-1), (+1,+2)],
        [(0,0), (0,+2), (0,-1), (-1,+2), (+2,-1)],
        [(0,0), (0,+1), (0,-2), (+2,+1), (-1,-2)],
    ]
    _KICKS_I_CCW = [
        [(0,0), (0,-1), (0,+2), (-2,-1), (+1,+2)],
        [(0,0), (0,+2), (0,-1), (-1,+2), (+2,-1)],
        [(0,0), (0,+1), (0,-2), (+2,+1), (-1,-2)],
        [(0,0), (0,-2), (0,+1), (+1,-2), (-2,+1)],
    ]

## 변경 3: Tetromino.rotate_cw 메서드를 4개 메서드로 교체

기존 rotate_cw 메서드(def rotate_cw(self) -> list: ... 전체)를 삭제하고 다음 4개로 교체합니다.

    def rotated_cells_cw(self) -> list:
        rotated = [(dc, -dr) for dr, dc in self.cells]
        min_r = min(r for r, c in rotated)
        min_c = min(c for r, c in rotated)
        return [(r - min_r, c - min_c) for r, c in rotated]

    def rotated_cells_ccw(self) -> list:
        rotated = [(-dc, dr) for dr, dc in self.cells]
        min_r = min(r for r, c in rotated)
        min_c = min(c for r, c in rotated)
        return [(r - min_r, c - min_c) for r, c in rotated]

    def kicks_cw(self) -> list:
        if self.shape == "I":
            return self._KICKS_I_CW[self.rotation_state]
        if self.shape == "O":
            return [(0, 0)]
        return self._KICKS_JLSTZ_CW[self.rotation_state]

    def kicks_ccw(self) -> list:
        if self.shape == "I":
            return self._KICKS_I_CCW[self.rotation_state]
        if self.shape == "O":
            return [(0, 0)]
        return self._KICKS_JLSTZ_CCW[self.rotation_state]

## 변경 4: Game.__init__ — next_piece/current_piece 초기화 교체 + held 추가

기존:
        self.bag = []
        self.next_piece = self.next_from_bag()
        self.score = 0
        self.lines_cleared = 0
        self.level = 1
        self.current_piece = self.next_from_bag()

변경 후:
        self.bag = []
        self.next_queue: list = []
        for _ in range(6):
            self.next_queue.append(self.next_from_bag())
        self.current_piece = self.next_queue.pop(0)
        self.held_piece = None
        self.can_hold = True
        self.score = 0
        self.lines_cleared = 0
        self.level = 1

## 변경 5: next_from_bag 메서드 바로 아래에 5개 메서드 추가

    def _refill_queue(self) -> None:
        while len(self.next_queue) < 5:
            self.next_queue.append(self.next_from_bag())

    def try_rotate_cw(self) -> None:
        cells = self.current_piece.rotated_cells_cw()
        for dr, dc in self.current_piece.kicks_cw():
            nr = self.current_piece.row + dr
            nc = self.current_piece.col + dc
            if self.can_place(cells, nr, nc):
                self.current_piece.cells = cells
                self.current_piece.row = nr
                self.current_piece.col = nc
                self.current_piece.rotation_state = (self.current_piece.rotation_state + 1) % 4
                return

    def try_rotate_ccw(self) -> None:
        cells = self.current_piece.rotated_cells_ccw()
        for dr, dc in self.current_piece.kicks_ccw():
            nr = self.current_piece.row + dr
            nc = self.current_piece.col + dc
            if self.can_place(cells, nr, nc):
                self.current_piece.cells = cells
                self.current_piece.row = nr
                self.current_piece.col = nc
                self.current_piece.rotation_state = (self.current_piece.rotation_state - 1) % 4
                return

    def hold_piece(self) -> None:
        if not self.can_hold:
            return
        self.can_hold = False
        shape = self.current_piece.shape
        if self.held_piece is None:
            self.held_piece = Tetromino(shape)
            self.current_piece = self.next_queue.pop(0)
            self._refill_queue()
        else:
            new_cur = self.held_piece
            new_cur.row = 0
            new_cur.col = 3
            new_cur.rotation_state = 0
            new_cur.cells = list(Tetromino.SHAPES[new_cur.shape])
            self.held_piece = Tetromino(shape)
            self.current_piece = new_cur
        if not self.can_move(0, 0):
            self.game_over = True

## 변경 6: spawn_piece 교체

기존:
    def spawn_piece(self) -> None:
        self.current_piece = self.next_piece
        self.next_piece = self.next_from_bag()
        if not self.can_move(0, 0):
            self.game_over = True

변경 후:
    def spawn_piece(self) -> None:
        self.can_hold = True
        self.current_piece = self.next_queue.pop(0)
        self._refill_queue()
        if not self.can_move(0, 0):
            self.game_over = True

## 변경 7: reset_game 내 next_piece/current_piece 초기화 교체

기존:
        self.next_piece = self.next_from_bag()
        self.current_piece = self.next_from_bag()

변경 후:
        self.held_piece = None
        self.can_hold = True
        self.next_queue = []
        for _ in range(6):
            self.next_queue.append(self.next_from_bag())
        self.current_piece = self.next_queue.pop(0)

## 변경 8: handle_keydown K_UP 블록 교체 + K_z, K_c/Shift 추가

기존:
        elif key == pygame.K_UP:
            rotated = self.current_piece.rotate_cw()
            for dc in [0, -1, 1, -2, 2]:
                if self.can_place(rotated, self.current_piece.row, self.current_piece.col + dc):
                    self.current_piece.cells = rotated
                    self.current_piece.col += dc
                    break

변경 후:
        elif key in (pygame.K_UP, pygame.K_x):
            self.try_rotate_cw()
        elif key in (pygame.K_z, pygame.K_LCTRL, pygame.K_RCTRL):
            self.try_rotate_ccw()
        elif key in (pygame.K_c, pygame.K_LSHIFT, pygame.K_RSHIFT):
            self.hold_piece()

## 변경 9: draw_cell — size 파라미터 추가

기존:
    def draw_cell(self, x: int, y: int, color: tuple) -> None:
        s = self.cell_size

변경 후:
    def draw_cell(self, x: int, y: int, color: tuple, size: int = 0) -> None:
        s = size if size > 0 else self.cell_size

(draw_cell의 나머지 본문은 변경 없음)

## 변경 10: draw_side_panels 전체 교체

기존 draw_side_panels 메서드 전체를 다음으로 교체합니다.

    def draw_side_panels(self) -> None:
        cs = 18
        lx, ly, lw, lh = 10, self.board_top, 120, 270
        self.draw_panel(lx, ly, lw, lh)
        for i, (label, value) in enumerate([
            ("SCORE", str(self.score)),
            ("LEVEL", str(self.level)),
            ("LINES", str(self.lines_cleared)),
        ]):
            yb = ly + 16 + i * 48
            self.screen.blit(self.font_label.render(label, True, (130, 130, 160)), (lx + 10, yb))
            self.screen.blit(self.font_value.render(value, True, COLOR_TEXT), (lx + 10, yb + 18))
        hold_label_y = ly + 16 + 3 * 48 + 8
        self.screen.blit(self.font_label.render("HOLD", True, (130, 130, 160)), (lx + 10, hold_label_y))
        if self.held_piece is not None:
            p = self.held_piece
            color = p.color if self.can_hold else tuple(max(0, v - 100) for v in p.color)
            off_x = lx + (lw - 4 * cs) // 2
            off_y = hold_label_y + 18
            for dr, dc in p.cells:
                self.draw_cell(off_x + dc * cs, off_y + dr * cs, color, cs)
        rx = self.board_left + self.board_width + 10
        rw, rh = 120, 350
        ry = self.board_top
        self.draw_panel(rx, ry, rw, rh)
        self.screen.blit(self.font_label.render("NEXT", True, (130, 130, 160)), (rx + 10, ry + 10))
        for i, piece in enumerate(self.next_queue[:5]):
            py = ry + 30 + i * 64
            off_x = rx + (rw - 4 * cs) // 2
            for dr, dc in piece.cells:
                self.draw_cell(off_x + dc * cs, py + dr * cs, piece.color, cs)

## 완료 후 제출 형식
1. 변경한 파일 목록
2. 추가/수정된 메서드 목록
3. python -m py_compile 결과
```
