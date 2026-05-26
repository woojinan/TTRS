# Task 013 - T-Spin 판정 수정 + 액션 피드백 텍스트

## Goal

1. `detect_tspin()` 버그 수정: board에 셀 기록 전에 호출하도록 순서 변경, T 피스 자신의 셀도 코너 판정에 포함
2. 라인 클리어 시 화면에 액션 텍스트 표시 ("T-SPIN DOUBLE!", "TETRIS!", "B2B TETRIS!", "ALL CLEAR!" 등)

## Context

현재 `lock_piece()`의 순서:
```python
# 1. board에 셀 기록
for dr, dc in piece.cells:
    self.board[r][c] = piece.color

# 2. detect_tspin() 호출  ← 버그: T 피스가 이미 보드에 있음
tspin = self.detect_tspin()
```

T 피스 state 2 [(0,0),(0,1),(0,2),(1,1)] 기준:
- 코너 = (R,C), (R,C+2), (R+2,C), (R+2,C+2)
- T의 셀 (R,C)와 (R,C+2)가 코너와 겹침
- board 기록 후에 호출하면 이 두 코너가 항상 blocked = true → 오판정

올바른 로직:
- detect_tspin()을 board 기록 전에 호출
- detect_tspin 내부에서 T 피스 자신의 셀 위치도 "blocked"로 포함

시각 피드백 없음: T-Spin Double 성공해도 화면에 아무 표시 없음.

## Files to Modify

- `c:\Users\C544\Desktop\TTRS\main.py`

## 구현 명세

### 1. `Game.__init__`에 액션 피드백 필드 추가

```python
self.action_text  = ""
self.action_timer = 0
self.action_max   = 90   # 90프레임 = 1.5초
```

### 2. `detect_tspin()` 전체 교체

```python
def detect_tspin(self) -> str:
    if self.current_piece.shape != "T":
        return ""
    cr = self.current_piece.row + 1
    cc = self.current_piece.col + 1
    t_cells = {
        (self.current_piece.row + dr, self.current_piece.col + dc)
        for dr, dc in self.current_piece.cells
    }
    corners = [
        (cr - 1, cc - 1), (cr - 1, cc + 1),
        (cr + 1, cc - 1), (cr + 1, cc + 1),
    ]

    def occupied(r: int, c: int) -> bool:
        if (r, c) in t_cells:
            return True
        if r < 0 or r >= self.board_rows or c < 0 or c >= self.board_columns:
            return True
        return self.board[r][c] is not None

    blocked = sum(1 for r, c in corners if occupied(r, c))
    if blocked < 3:
        return ""
    state = self.current_piece.rotation_state
    if state == 0:   front = [(cr + 1, cc - 1), (cr + 1, cc + 1)]
    elif state == 1: front = [(cr - 1, cc - 1), (cr + 1, cc - 1)]
    elif state == 2: front = [(cr - 1, cc - 1), (cr - 1, cc + 1)]
    else:            front = [(cr - 1, cc + 1), (cr + 1, cc + 1)]
    front_blocked = sum(1 for r, c in front if occupied(r, c))
    return "full" if front_blocked == 2 else "mini"
```

### 3. `lock_piece()` 수정 — detect_tspin 호출 순서 변경 + 액션 텍스트 설정

```python
def lock_piece(self) -> None:
    # detect_tspin은 board 기록 전에 호출 (T 피스 셀 위치 기준)
    tspin = self.detect_tspin()

    piece = self.current_piece
    for dr, dc in piece.cells:
        r = piece.row + dr
        c = piece.col + dc
        if 0 <= r < self.board_rows and 0 <= c < self.board_columns:
            self.board[r][c] = piece.color
    self.gravity_timer = 0

    cleared = self.clear_lines()

    if cleared == 0:
        self.combo = 0
        self.last_was_tspin = False
        return

    if tspin == "full":
        base = {1: 800, 2: 1200, 3: 1600}.get(cleared, 1600)
        is_special = True
    elif tspin == "mini":
        base = {1: 200, 2: 400}.get(cleared, 400)
        is_special = True
    else:
        base = {1: 100, 2: 300, 3: 500, 4: 800}.get(cleared, 800)
        is_special = cleared == 4

    b2b_was_active = self.b2b_active
    if is_special and self.b2b_active:
        base = int(base * 1.5)
    self.b2b_active = is_special

    combo_bonus_table = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5]
    combo_bonus = combo_bonus_table[min(self.combo, len(combo_bonus_table) - 1)] * 100
    self.combo += 1

    pc_bonus = 0
    is_pc = all(
        self.board[r][c] is None
        for r in range(self.board_rows)
        for c in range(self.board_columns)
    )
    if is_pc:
        pc_bonus = 1000 * self.level

    self.score += (base + combo_bonus) * self.level + pc_bonus
    self.lines_cleared += cleared
    self.last_was_tspin = tspin != ""
    self.update_level()

    # 액션 텍스트 결정
    if is_pc:
        label = "ALL CLEAR"
    elif tspin == "full":
        label = {1: "T-SPIN SINGLE", 2: "T-SPIN DOUBLE", 3: "T-SPIN TRIPLE"}.get(cleared, "T-SPIN")
    elif tspin == "mini":
        label = "T-SPIN MINI"
    elif cleared == 4:
        label = "TETRIS"
    elif cleared == 3:
        label = "TRIPLE"
    elif cleared == 2:
        label = "DOUBLE"
    else:
        label = ""

    if label:
        prefix = "B2B " if (is_special and b2b_was_active) else ""
        self.action_text  = prefix + label
        self.action_timer = self.action_max
```

### 4. `update()` — action_timer 감소 추가 (game_over 체크 다음)

```python
if self.action_timer > 0:
    self.action_timer -= 1
```

### 5. `reset_game()` — 새 필드 초기화 추가

```python
self.action_text  = ""
self.action_timer = 0
```

### 6. `draw()` — action_text 렌더링 추가 (draw_ghost_piece 다음)

draw() 메서드 내 `self.draw_ghost_piece()` 다음 줄에 추가:
```python
self.draw_action_text()
```

### 7. `draw_action_text()` 메서드 추가 (draw_ghost_piece 아래)

```python
def draw_action_text(self) -> None:
    if not self.action_text or self.action_timer <= 0:
        return
    alpha = min(255, self.action_timer * 4)
    font = pygame.font.Font(None, 30)
    surf = font.render(self.action_text, True, (255, 220, 60))
    surf.set_alpha(alpha)
    cx = self.board_left + self.board_width // 2
    cy = self.board_top + self.board_height // 2 - 20
    self.screen.blit(surf, surf.get_rect(center=(cx, cy)))
```

## Out of Scope

- last_rotation 플래그 추적
- 액션 텍스트 애니메이션 (흔들림, 스케일 변화)
- Combo 카운터 화면 표시

## Verification

```powershell
python -m py_compile c:\Users\C544\Desktop\TTRS\main.py
python c:\Users\C544\Desktop\TTRS\main.py
```

## Expected Result

- T-Spin Double 성공 시 "T-SPIN DOUBLE" 텍스트가 보드 중앙에 1.5초간 표시
- B2B Tetris 성공 시 "B2B TETRIS" 표시
- ALL CLEAR 시 "ALL CLEAR" 표시
- T-Spin 판정이 모든 rotation state에서 올바르게 동작

## Codex Prompt

```
다음 지시에 따라 c:\Users\C544\Desktop\TTRS\main.py 파일만 수정하세요.

## 반드시 지킬 규칙
- main.py 이외의 파일은 수정하지 않습니다.
- 명시된 변경 외에 다른 코드는 수정하지 않습니다.

## 변경 1: Game.__init__ — action 필드 추가 (self.game_over = False 바로 앞)

        self.action_text  = ""
        self.action_timer = 0
        self.action_max   = 90

## 변경 2: detect_tspin 메서드 전체 교체

기존 detect_tspin 메서드 전체를 다음으로 교체합니다.

    def detect_tspin(self) -> str:
        if self.current_piece.shape != "T":
            return ""
        cr = self.current_piece.row + 1
        cc = self.current_piece.col + 1
        t_cells = {
            (self.current_piece.row + dr, self.current_piece.col + dc)
            for dr, dc in self.current_piece.cells
        }
        corners = [
            (cr - 1, cc - 1), (cr - 1, cc + 1),
            (cr + 1, cc - 1), (cr + 1, cc + 1),
        ]

        def occupied(r: int, c: int) -> bool:
            if (r, c) in t_cells:
                return True
            if r < 0 or r >= self.board_rows or c < 0 or c >= self.board_columns:
                return True
            return self.board[r][c] is not None

        blocked = sum(1 for r, c in corners if occupied(r, c))
        if blocked < 3:
            return ""
        state = self.current_piece.rotation_state
        if state == 0:   front = [(cr + 1, cc - 1), (cr + 1, cc + 1)]
        elif state == 1: front = [(cr - 1, cc - 1), (cr + 1, cc - 1)]
        elif state == 2: front = [(cr - 1, cc - 1), (cr - 1, cc + 1)]
        else:            front = [(cr - 1, cc + 1), (cr + 1, cc + 1)]
        front_blocked = sum(1 for r, c in front if occupied(r, c))
        return "full" if front_blocked == 2 else "mini"

## 변경 3: lock_piece 메서드 전체 교체

기존 lock_piece 메서드 전체를 다음으로 교체합니다.

    def lock_piece(self) -> None:
        tspin = self.detect_tspin()

        piece = self.current_piece
        for dr, dc in piece.cells:
            r = piece.row + dr
            c = piece.col + dc
            if 0 <= r < self.board_rows and 0 <= c < self.board_columns:
                self.board[r][c] = piece.color
        self.gravity_timer = 0

        cleared = self.clear_lines()

        if cleared == 0:
            self.combo = 0
            self.last_was_tspin = False
            return

        if tspin == "full":
            base = {1: 800, 2: 1200, 3: 1600}.get(cleared, 1600)
            is_special = True
        elif tspin == "mini":
            base = {1: 200, 2: 400}.get(cleared, 400)
            is_special = True
        else:
            base = {1: 100, 2: 300, 3: 500, 4: 800}.get(cleared, 800)
            is_special = cleared == 4

        b2b_was_active = self.b2b_active
        if is_special and self.b2b_active:
            base = int(base * 1.5)
        self.b2b_active = is_special

        combo_bonus_table = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5]
        combo_bonus = combo_bonus_table[min(self.combo, len(combo_bonus_table) - 1)] * 100
        self.combo += 1

        pc_bonus = 0
        is_pc = all(
            self.board[r][c] is None
            for r in range(self.board_rows)
            for c in range(self.board_columns)
        )
        if is_pc:
            pc_bonus = 1000 * self.level

        self.score += (base + combo_bonus) * self.level + pc_bonus
        self.lines_cleared += cleared
        self.last_was_tspin = tspin != ""
        self.update_level()

        if is_pc:
            label = "ALL CLEAR"
        elif tspin == "full":
            label = {1: "T-SPIN SINGLE", 2: "T-SPIN DOUBLE", 3: "T-SPIN TRIPLE"}.get(cleared, "T-SPIN")
        elif tspin == "mini":
            label = "T-SPIN MINI"
        elif cleared == 4:
            label = "TETRIS"
        elif cleared == 3:
            label = "TRIPLE"
        elif cleared == 2:
            label = "DOUBLE"
        else:
            label = ""

        if label:
            prefix = "B2B " if (is_special and b2b_was_active) else ""
            self.action_text  = prefix + label
            self.action_timer = self.action_max

## 변경 4: update() — action_timer 감소 추가

update() 메서드의 `if self.game_over: return` 바로 다음에 추가합니다.

        if self.action_timer > 0:
            self.action_timer -= 1

## 변경 5: reset_game() — 새 필드 초기화 추가

reset_game()의 self.game_over = False 바로 앞에 추가합니다.

        self.action_text  = ""
        self.action_timer = 0

## 변경 6: draw() 메서드 수정 — draw_action_text() 호출 추가

draw() 메서드 내 `self.draw_ghost_piece()` 다음 줄에 추가합니다.

        self.draw_action_text()

## 변경 7: draw_action_text 메서드 추가 (draw_ghost_piece 메서드 바로 아래)

    def draw_action_text(self) -> None:
        if not self.action_text or self.action_timer <= 0:
            return
        alpha = min(255, self.action_timer * 4)
        font = pygame.font.Font(None, 30)
        surf = font.render(self.action_text, True, (255, 220, 60))
        surf.set_alpha(alpha)
        cx = self.board_left + self.board_width // 2
        cy = self.board_top + self.board_height // 2 - 20
        self.screen.blit(surf, surf.get_rect(center=(cx, cy)))

## 완료 후 제출 형식
1. 변경한 파일 목록
2. 추가/수정된 메서드 목록
3. python -m py_compile 결과
```
