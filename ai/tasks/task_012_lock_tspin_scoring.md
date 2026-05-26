# Task 012 - Lock Delay + T-Spin + B2B + Combo + Perfect Clear + SDF

## Goal

1. Lock Delay — 착지 후 500ms 대기, 이동/회전 시 리셋 (최대 15회)
2. T-Spin 판정 — 3-corner rule
3. B2B (Back-to-Back) 보너스
4. Combo / REN 카운터
5. Perfect Clear 판정
6. SDF (Soft Drop Factor) — DOWN 키를 누르고 있으면 빠른 낙하

## Context

task_011 완료 후 진행. rotation_state, next_queue, hold 모두 구현된 상태.

현재 잠금 방식:
```python
# update()에서 중력 처리
if self.gravity_timer >= self.gravity_interval:
    self.gravity_timer = 0
    if self.can_move(1, 0):
        self.current_piece.row += 1
    else:
        self.lock_piece()
        self.spawn_piece()
```
착지 즉시 lock_piece() 호출됨 (Lock Delay 없음).

현재 점수 방식:
```python
points = {1: 100, 2: 300, 3: 500, 4: 800}
self.score += points.get(cleared, 800) * self.level
```
T-Spin/B2B/Combo/PC 없음.

## Files to Modify

- `c:\Users\C544\Desktop\TTRS\main.py`

## 구현 명세

### 1. `Game.__init__` 추가 항목 (기존 필드 이후)

```python
# Lock Delay
self.lock_delay_frames = 30      # 60fps 기준 30프레임 ≈ 500ms
self.lock_timer        = 0       # 착지 후 경과 프레임
self.lock_resets       = 0       # 이동/회전 시 리셋 횟수
self.max_lock_resets   = 15
self.on_ground         = False   # 현재 프레임에 바닥 접촉 여부

# 점수 보너스 상태
self.combo             = 0       # 연속 라인 클리어 카운터
self.b2b_active        = False   # Back-to-Back 활성 여부
self.last_was_tspin    = False   # 직전 잠금이 T-Spin이었는지
```

### 2. `update()` — 중력/잠금 로직 교체

```python
# 변경 전
self.gravity_timer += 1
if self.gravity_timer >= self.gravity_interval:
    self.gravity_timer = 0
    if self.can_move(1, 0):
        self.current_piece.row += 1
    else:
        self.lock_piece()
        self.spawn_piece()

# 변경 후
self.gravity_timer += 1
if self.soft_drop_held:
    sdf_interval = max(1, self.gravity_interval // 20)
    if self.gravity_timer >= sdf_interval:
        self.gravity_timer = 0
        if self.can_move(1, 0):
            self.current_piece.row += 1
elif self.gravity_timer >= self.gravity_interval:
    self.gravity_timer = 0
    if self.can_move(1, 0):
        self.current_piece.row += 1

grounded = not self.can_move(1, 0)
if grounded:
    self.lock_timer += 1
    if self.lock_timer >= self.lock_delay_frames or self.lock_resets >= self.max_lock_resets:
        self.on_ground = False
        self.lock_timer = 0
        self.lock_resets = 0
        self.lock_piece()
        self.spawn_piece()
else:
    self.on_ground = False
    self.lock_timer = 0
```

### 3. `__init__`에 soft_drop_held 필드 추가

```python
self.soft_drop_held = False
```

### 4. `handle_keydown` — DOWN 키를 soft_drop_held 플래그로 변경

```python
# 변경 전
elif key == pygame.K_DOWN:
    if self.can_move(1, 0):
        self.current_piece.row += 1

# 변경 후
elif key == pygame.K_DOWN:
    self.soft_drop_held = True
    if self.can_move(1, 0):
        self.current_piece.row += 1
```

### 5. `handle_keyup` — DOWN 키 추가

```python
# 기존 handle_keyup에 추가
elif key == pygame.K_DOWN:
    self.soft_drop_held = False
```

### 6. Lock Delay 리셋 — 이동/회전 시 카운터 증가

`try_rotate_cw`, `try_rotate_ccw` 성공 return 직전,
그리고 LEFT/RIGHT 이동 성공 직후에 아래를 추가합니다:

```python
# 이동/회전 성공 시 (바닥에 닿아 있는 경우만 리셋)
if not self.can_move(1, 0):
    self.lock_timer = 0
    self.lock_resets += 1
```

LEFT/RIGHT 키 핸들러 (held_left True로 세팅하는 부분):
```python
elif key == pygame.K_LEFT:
    self.held_left = True
    self.das_timer = 0
    self.arr_timer = 0
    if self.can_move(0, -1):
        self.current_piece.col -= 1
        if not self.can_move(1, 0):
            self.lock_timer = 0
            self.lock_resets += 1
elif key == pygame.K_RIGHT:
    self.held_right = True
    self.das_timer = 0
    self.arr_timer = 0
    if self.can_move(0, 1):
        self.current_piece.col += 1
        if not self.can_move(1, 0):
            self.lock_timer = 0
            self.lock_resets += 1
```

update()의 DAS/ARR 이동에도 추가:
```python
if self.held_left and self.can_move(0, -1):
    self.current_piece.col -= 1
    if not self.can_move(1, 0):
        self.lock_timer = 0
        self.lock_resets += 1
elif self.held_right and self.can_move(0, 1):
    self.current_piece.col += 1
    if not self.can_move(1, 0):
        self.lock_timer = 0
        self.lock_resets += 1
```

### 7. T-Spin 판정 메서드 추가

T-Spin 판정: T 피스가 회전으로 잠길 때 중심 기준 4개 대각선 중 3개 이상 막힌 경우.

```python
def detect_tspin(self) -> str:
    """T-Spin 판정. 'full', 'mini', '' 중 하나 반환."""
    if self.current_piece.shape != "T":
        return ""
    # T 피스 중심 = 셀 (1,1) 기준
    cr = self.current_piece.row + 1
    cc = self.current_piece.col + 1
    # 4개 대각선 코너
    corners = [
        (cr - 1, cc - 1), (cr - 1, cc + 1),
        (cr + 1, cc - 1), (cr + 1, cc + 1),
    ]
    blocked = sum(
        1 for r, c in corners
        if r < 0 or r >= self.board_rows or c < 0 or c >= self.board_columns
        or self.board[r][c] is not None
    )
    if blocked < 3:
        return ""
    # rotation_state 기준 "정면" 코너 2개 (돌기 반대편)
    state = self.current_piece.rotation_state
    if state == 0:   front = [(cr + 1, cc - 1), (cr + 1, cc + 1)]
    elif state == 1: front = [(cr - 1, cc - 1), (cr + 1, cc - 1)]
    elif state == 2: front = [(cr - 1, cc - 1), (cr - 1, cc + 1)]
    else:            front = [(cr - 1, cc + 1), (cr + 1, cc + 1)]
    front_blocked = sum(
        1 for r, c in front
        if r < 0 or r >= self.board_rows or c < 0 or c >= self.board_columns
        or self.board[r][c] is not None
    )
    if front_blocked == 2:
        return "full"
    return "mini"
```

### 8. `lock_piece` 수정 — T-Spin/B2B/Combo/PC 점수 반영

```python
def lock_piece(self) -> None:
    piece = self.current_piece
    for dr, dc in piece.cells:
        r = piece.row + dr
        c = piece.col + dc
        if 0 <= r < self.board_rows and 0 <= c < self.board_columns:
            self.board[r][c] = piece.color
    self.gravity_timer = 0

    tspin = self.detect_tspin()
    cleared = self.clear_lines()

    if cleared == 0:
        self.combo = 0
        self.last_was_tspin = False
        return

    # 기본 점수 테이블
    if tspin == "full":
        base = {1: 800, 2: 1200, 3: 1600}.get(cleared, 1600)
        is_special = True
    elif tspin == "mini":
        base = {1: 200, 2: 400}.get(cleared, 400)
        is_special = True
    else:
        base = {1: 100, 2: 300, 3: 500, 4: 800}.get(cleared, 800)
        is_special = cleared == 4  # Tetris

    # B2B 보너스
    if is_special and self.b2b_active:
        base = int(base * 1.5)
    self.b2b_active = is_special

    # Combo 보너스
    combo_bonus_table = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5]
    combo_bonus = combo_bonus_table[min(self.combo, len(combo_bonus_table) - 1)] * 100
    self.combo += 1

    # Perfect Clear 보너스
    pc_bonus = 0
    if all(self.board[r][c] is None for r in range(self.board_rows) for c in range(self.board_columns)):
        pc_bonus = 1000 * self.level

    self.score += (base + combo_bonus) * self.level + pc_bonus
    self.lines_cleared += cleared
    self.last_was_tspin = tspin != ""
    self.update_level()
```

### 9. `reset_game` 추가 필드 초기화

```python
self.soft_drop_held = False
self.lock_timer = 0
self.lock_resets = 0
self.on_ground = False
self.combo = 0
self.b2b_active = False
self.last_was_tspin = False
```

## Out of Scope

- 가비지(공격) 시스템
- 프레임 독립 타이밍 (ms 기반 리팩터링)
- DAS/ARR/SDF 수치 설정 화면
- 게임 모드 (Sprint, Cheese, etc.)

## Verification

```powershell
python -m py_compile c:\Users\C544\Desktop\TTRS\main.py
python c:\Users\C544\Desktop\TTRS\main.py
```

## Expected Result

- 블록이 착지해도 약 0.5초 대기 후 잠금 (이동/회전으로 리셋 가능, 최대 15회)
- T-Spin 라인 클리어 시 높은 점수
- Tetris / T-Spin 연속 시 B2B 보너스 (x1.5)
- 연속 라인 클리어 시 Combo 카운터 증가
- 클리어 후 보드 완전히 빈 경우 Perfect Clear 보너스
- DOWN 키를 누르고 있으면 빠른 낙하 (SDF 20배)

## Codex Prompt

```
다음 지시에 따라 c:\Users\C544\Desktop\TTRS\main.py 파일만 수정하세요.
task_011이 이미 완료된 상태에서 진행합니다.

## 반드시 지킬 규칙
- main.py 이외의 파일은 수정하지 않습니다.
- 명시된 변경 외에 다른 코드는 수정하지 않습니다.

## 변경 1: Game.__init__에 필드 추가 (self.game_over = False 다음 줄)

        self.lock_delay_frames = 30
        self.lock_timer        = 0
        self.lock_resets       = 0
        self.max_lock_resets   = 15
        self.on_ground         = False
        self.soft_drop_held    = False
        self.combo             = 0
        self.b2b_active        = False
        self.last_was_tspin    = False

## 변경 2: update() — 중력/잠금 블록 교체

기존:
        self.gravity_timer += 1
        if self.gravity_timer >= self.gravity_interval:
            self.gravity_timer = 0
            if self.can_move(1, 0):
                self.current_piece.row += 1
            else:
                self.lock_piece()
                self.spawn_piece()

변경 후:
        self.gravity_timer += 1
        if self.soft_drop_held:
            sdf_interval = max(1, self.gravity_interval // 20)
            if self.gravity_timer >= sdf_interval:
                self.gravity_timer = 0
                if self.can_move(1, 0):
                    self.current_piece.row += 1
        elif self.gravity_timer >= self.gravity_interval:
            self.gravity_timer = 0
            if self.can_move(1, 0):
                self.current_piece.row += 1

        grounded = not self.can_move(1, 0)
        if grounded:
            self.lock_timer += 1
            if self.lock_timer >= self.lock_delay_frames or self.lock_resets >= self.max_lock_resets:
                self.on_ground = False
                self.lock_timer = 0
                self.lock_resets = 0
                self.lock_piece()
                self.spawn_piece()
        else:
            self.on_ground = False
            self.lock_timer = 0

## 변경 3: handle_keydown — K_DOWN 블록 교체

기존:
        elif key == pygame.K_DOWN:
            if self.can_move(1, 0):
                self.current_piece.row += 1

변경 후:
        elif key == pygame.K_DOWN:
            self.soft_drop_held = True
            if self.can_move(1, 0):
                self.current_piece.row += 1

## 변경 4: handle_keydown — K_LEFT, K_RIGHT 블록 교체 (lock reset 추가)

기존:
        elif key == pygame.K_LEFT:
            self.held_left = True
            self.das_timer = 0
            self.arr_timer = 0
            if self.can_move(0, -1):
                self.current_piece.col -= 1
        elif key == pygame.K_RIGHT:
            self.held_right = True
            self.das_timer = 0
            self.arr_timer = 0
            if self.can_move(0, 1):
                self.current_piece.col += 1

변경 후:
        elif key == pygame.K_LEFT:
            self.held_left = True
            self.das_timer = 0
            self.arr_timer = 0
            if self.can_move(0, -1):
                self.current_piece.col -= 1
                if not self.can_move(1, 0):
                    self.lock_timer = 0
                    self.lock_resets += 1
        elif key == pygame.K_RIGHT:
            self.held_right = True
            self.das_timer = 0
            self.arr_timer = 0
            if self.can_move(0, 1):
                self.current_piece.col += 1
                if not self.can_move(1, 0):
                    self.lock_timer = 0
                    self.lock_resets += 1

## 변경 5: handle_keyup — K_DOWN 추가

기존 handle_keyup에 다음 elif 추가:
        elif key == pygame.K_DOWN:
            self.soft_drop_held = False

## 변경 6: try_rotate_cw, try_rotate_ccw — 회전 성공 시 lock reset 추가

try_rotate_cw의 return 직전에 추가:
                if not self.can_move(1, 0):
                    self.lock_timer = 0
                    self.lock_resets += 1
                return

try_rotate_ccw의 return 직전에도 동일하게 추가.

## 변경 7: update() DAS/ARR 이동 — lock reset 추가

기존:
                    if self.held_left and self.can_move(0, -1):
                        self.current_piece.col -= 1
                    elif self.held_right and self.can_move(0, 1):
                        self.current_piece.col += 1

변경 후:
                    if self.held_left and self.can_move(0, -1):
                        self.current_piece.col -= 1
                        if not self.can_move(1, 0):
                            self.lock_timer = 0
                            self.lock_resets += 1
                    elif self.held_right and self.can_move(0, 1):
                        self.current_piece.col += 1
                        if not self.can_move(1, 0):
                            self.lock_timer = 0
                            self.lock_resets += 1

## 변경 8: detect_tspin 메서드 추가 (lock_piece 바로 앞)

    def detect_tspin(self) -> str:
        if self.current_piece.shape != "T":
            return ""
        cr = self.current_piece.row + 1
        cc = self.current_piece.col + 1
        corners = [
            (cr - 1, cc - 1), (cr - 1, cc + 1),
            (cr + 1, cc - 1), (cr + 1, cc + 1),
        ]
        blocked = sum(
            1 for r, c in corners
            if r < 0 or r >= self.board_rows or c < 0 or c >= self.board_columns
            or self.board[r][c] is not None
        )
        if blocked < 3:
            return ""
        state = self.current_piece.rotation_state
        if state == 0:   front = [(cr + 1, cc - 1), (cr + 1, cc + 1)]
        elif state == 1: front = [(cr - 1, cc - 1), (cr + 1, cc - 1)]
        elif state == 2: front = [(cr - 1, cc - 1), (cr - 1, cc + 1)]
        else:            front = [(cr - 1, cc + 1), (cr + 1, cc + 1)]
        front_blocked = sum(
            1 for r, c in front
            if r < 0 or r >= self.board_rows or c < 0 or c >= self.board_columns
            or self.board[r][c] is not None
        )
        return "full" if front_blocked == 2 else "mini"

## 변경 9: lock_piece 메서드 전체 교체

기존 lock_piece 메서드 전체를 다음으로 교체합니다.

    def lock_piece(self) -> None:
        piece = self.current_piece
        for dr, dc in piece.cells:
            r = piece.row + dr
            c = piece.col + dc
            if 0 <= r < self.board_rows and 0 <= c < self.board_columns:
                self.board[r][c] = piece.color
        self.gravity_timer = 0

        tspin = self.detect_tspin()
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

        if is_special and self.b2b_active:
            base = int(base * 1.5)
        self.b2b_active = is_special

        combo_bonus_table = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5]
        combo_bonus = combo_bonus_table[min(self.combo, len(combo_bonus_table) - 1)] * 100
        self.combo += 1

        pc_bonus = 0
        if all(self.board[r][c] is None for r in range(self.board_rows) for c in range(self.board_columns)):
            pc_bonus = 1000 * self.level

        self.score += (base + combo_bonus) * self.level + pc_bonus
        self.lines_cleared += cleared
        self.last_was_tspin = tspin != ""
        self.update_level()

## 변경 10: reset_game에 새 필드 초기화 추가 (self.game_over = False 앞)

        self.soft_drop_held = False
        self.lock_timer = 0
        self.lock_resets = 0
        self.on_ground = False
        self.combo = 0
        self.b2b_active = False
        self.last_was_tspin = False

## 완료 후 제출 형식
1. 변경한 파일 목록
2. 추가/수정된 메서드 목록
3. python -m py_compile 결과
```
