# Task 005 - 줄 삭제 · 점수 · 레벨 · 속도

## Goal

가득 찬 행을 삭제하고 위 블록들을 내린다. 삭제 줄 수에 따라 점수를 부여하고 레벨이 오를수록 낙하 속도를 높인다.

## Context

Task 004 완료 후 상태:
- `self.board` — 20×10 None/color 배열
- `lock_piece()` — 보드에 고정, gravity_timer 리셋
- `spawn_piece()` — 새 T 블록 생성, 게임오버 감지
- `update()` — 중력 → lock → spawn 루프 동작 중

줄 삭제 없음 → 블록이 쌓이기만 하고 사라지지 않음.

## Files to Modify

- `c:\Users\C544\Desktop\TTRS\main.py`

## Requirements

- [ ] `Game.__init__`에 `self.score = 0`, `self.lines_cleared = 0`, `self.level = 1` 추가
- [ ] `clear_lines()` 메서드 추가 — 가득 찬 행 제거 후 위 행들을 내림, 삭제 줄 수 반환
- [ ] 점수 계산: 1줄=100, 2줄=300, 3줄=500, 4줄=800, 레벨 곱산 적용
- [ ] `update_level()` 메서드 추가 — `level = lines_cleared // 10 + 1`, `gravity_interval = max(6, FPS - (level-1) * 5)`
- [ ] `lock_piece()` 끝에 `clear_lines()` 호출, 결과로 score/lines/level 갱신
- [ ] `draw_status_text()` — Score / Level / Lines 수치 표시

## 구현 명세

### Game.__init__ 추가 (self.board 줄 다음)

```python
self.score         = 0
self.lines_cleared = 0
self.level         = 1
```

### clear_lines 메서드

```python
def clear_lines(self) -> int:
    full_rows = [r for r in range(self.board_rows) if all(self.board[r][c] is not None for c in range(self.board_columns))]
    for r in full_rows:
        del self.board[r]
        self.board.insert(0, [None] * self.board_columns)
    return len(full_rows)
```

### update_level 메서드

```python
def update_level(self) -> None:
    self.level = self.lines_cleared // 10 + 1
    self.gravity_interval = max(6, FPS - (self.level - 1) * 5)
```

### lock_piece 수정 (gravity_timer = 0 다음에 추가)

```python
cleared = self.clear_lines()
if cleared > 0:
    points = {1: 100, 2: 300, 3: 500, 4: 800}
    self.score += points.get(cleared, 800) * self.level
    self.lines_cleared += cleared
    self.update_level()
```

### draw_status_text 수정

```python
def draw_status_text(self) -> None:
    items = [
        ("TETRIS",  (SCREEN_WIDTH // 2, 40),  32),
        (f"SCORE  {self.score}",  (SCREEN_WIDTH // 2, SCREEN_HEIGHT - 80), 24),
        (f"LEVEL  {self.level}",  (SCREEN_WIDTH // 2, SCREEN_HEIGHT - 55), 24),
        (f"LINES  {self.lines_cleared}", (SCREEN_WIDTH // 2, SCREEN_HEIGHT - 30), 24),
    ]
    for text, pos, size in items:
        font = pygame.font.Font(None, size)
        surf = font.render(text, True, COLOR_TEXT)
        rect = surf.get_rect(center=pos)
        self.screen.blit(surf, rect)
```

위 코드에서 font를 매번 생성하지 않으려면 __init__에 self.font_small = pygame.font.Font(None, 24) 를 추가해도 됩니다.

## Out of Scope

- 블록 회전
- 랜덤 블록 생성
- 하드 드롭
- 고스트 피스
- 게임오버 화면

## Verification

```powershell
python -m py_compile c:\Users\C544\Desktop\TTRS\main.py
python c:\Users\C544\Desktop\TTRS\main.py
```

## Expected Result

- 한 줄이 가득 차면 사라지고 위 블록들이 내려온다.
- 하단에 SCORE / LEVEL / LINES 수치가 표시된다.
- 줄을 지울수록 점수가 오른다.
- 10줄마다 레벨이 올라 블록이 빨라진다.

## Codex Prompt

```
다음 지시에 따라 c:\Users\C544\Desktop\TTRS\main.py 파일만 수정하세요.

## 목표
가득 찬 줄을 삭제하고 점수/레벨/속도 시스템을 추가합니다.

## 반드시 지킬 규칙
- main.py 이외의 파일은 생성하거나 수정하지 않습니다.
- 기존 메서드 이름과 시그니처를 변경하지 않습니다.
- 기존 상수를 수정하거나 삭제하지 않습니다.
- 회전, 하드드롭, 랜덤 생성, 고스트는 구현하지 않습니다.

## 구현 내용

### 1. Game.__init__ 추가
self.board 줄 바로 다음에 아래 세 줄을 추가합니다.

  self.score         = 0
  self.lines_cleared = 0
  self.level         = 1

### 2. clear_lines 메서드 추가 (spawn_piece 아래에 추가)

def clear_lines(self) -> int:
    full_rows = [r for r in range(self.board_rows)
                 if all(self.board[r][c] is not None for c in range(self.board_columns))]
    for r in full_rows:
        del self.board[r]
        self.board.insert(0, [None] * self.board_columns)
    return len(full_rows)

가득 찬 행의 인덱스 목록을 찾아 각 행을 제거하고 맨 위에 빈 행을 삽입합니다.
삭제된 줄 수를 반환합니다.

### 3. update_level 메서드 추가 (clear_lines 아래에 추가)

def update_level(self) -> None:
    self.level = self.lines_cleared // 10 + 1
    self.gravity_interval = max(6, FPS - (self.level - 1) * 5)

레벨 = 총 삭제 줄 // 10 + 1
gravity_interval = max(6, 60 - (레벨-1)*5)  → 레벨 1=60프레임, 레벨2=55, ..., 최소 6프레임

### 4. lock_piece 수정
기존 self.gravity_timer = 0 줄 다음에 아래 코드를 추가합니다.

  cleared = self.clear_lines()
  if cleared > 0:
      points = {1: 100, 2: 300, 3: 500, 4: 800}
      self.score += points.get(cleared, 800) * self.level
      self.lines_cleared += cleared
      self.update_level()

### 5. draw_status_text 수정
기존 메서드 내용을 아래로 교체합니다.

def draw_status_text(self) -> None:
    title_font = pygame.font.Font(None, 32)
    info_font  = pygame.font.Font(None, 24)

    title_surf = title_font.render("TETRIS", True, COLOR_TEXT)
    self.screen.blit(title_surf, title_surf.get_rect(center=(SCREEN_WIDTH // 2, 40)))

    for i, text in enumerate([
        f"SCORE  {self.score}",
        f"LEVEL  {self.level}",
        f"LINES  {self.lines_cleared}",
    ]):
        surf = info_font.render(text, True, COLOR_TEXT)
        self.screen.blit(surf, surf.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT - 80 + i * 25)))

## 완료 후 제출 형식
1. 변경한 파일 목록
2. 추가/수정된 메서드 목록
3. python -m py_compile 결과
```
