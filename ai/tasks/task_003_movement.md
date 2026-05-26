# Task 003 - 블록 이동 및 중력 낙하

## Goal

키보드 좌/우/하 방향키로 현재 블록을 이동시키고, 매 FPS 주기로 블록이 자동 낙하하는 중력 타이머를 구현한다. 이동 및 낙하 전에 보드 경계와 바닥을 검사하여 범위 밖으로 나가지 않도록 한다.

## Context

Task 002에서 Tetromino 클래스와 draw_current_piece()가 완성되었다. 현재 T 블록이 보드 상단 중앙에 정적으로 표시되지만, 키 입력과 update()는 아무 동작도 하지 않는다.

현재 main.py의 관련 코드 발췌:

```python
# 상수
FPS = 60

# Tetromino
class Tetromino:
    def __init__(self, shape: str) -> None:
        self.cells = self.SHAPES[shape]   # list[tuple[int, int]] — 상대 (dr, dc)
        self.color = self.COLORS[shape]
        self.row = 0    # 보드 기준 현재 행
        self.col = 3    # 보드 기준 현재 열

# Game.__init__
self.board_columns = 10
self.board_rows    = 20
self.cell_size     = 24
self.current_piece = Tetromino("T")

# handle_keydown — ESC만 처리
def handle_keydown(self, key: int) -> None:
    if key == pygame.K_ESCAPE:
        self.running = False

# update — 아무것도 없음
def update(self) -> None:
    pass
```

## Files to Modify

- `c:\Users\C544\Desktop\TTRS\main.py` (단일 파일, 기존 구조 유지)

## Requirements

- [ ] `Game.__init__`에 `self.gravity_timer = 0` 과 `self.gravity_interval = FPS` 를 추가한다.
- [ ] `Game.can_move(dr, dc) -> bool` 메서드를 추가한다. piece의 모든 셀에 대해 이동 후 좌표가 보드 범위 내인지 확인한다.
- [ ] `Game.handle_keydown`에 LEFT, RIGHT, DOWN 키 처리를 추가한다.
  - LEFT(`pygame.K_LEFT`): `can_move(0, -1)` 통과 시 `piece.col -= 1`
  - RIGHT(`pygame.K_RIGHT`): `can_move(0, 1)` 통과 시 `piece.col += 1`
  - DOWN(`pygame.K_DOWN`): `can_move(1, 0)` 통과 시 `piece.row += 1`
- [ ] `Game.update`에 중력 로직을 추가한다. 매 프레임 `gravity_timer`를 1씩 증가시키고, `gravity_interval`에 도달하면 `can_move(1, 0)` 통과 시 `piece.row += 1` 후 타이머를 0으로 리셋한다.
- [ ] 바닥 또는 좌우 경계에 막히면 이동을 중단한다 (이동 불가 시 위치 변경 없음).
- [ ] 기존 ESC 처리, draw 순서, 메서드 시그니처는 변경하지 않는다.

## 구현 명세

### can_move(dr, dc) 메서드

```python
def can_move(self, dr: int, dc: int) -> bool:
    """Return True if current_piece can move by (dr, dc) without leaving the board."""
    piece = self.current_piece
    for cell_dr, cell_dc in piece.cells:
        new_row = piece.row + cell_dr + dr
        new_col = piece.col + cell_dc + dc
        if new_row < 0 or new_row >= self.board_rows:
            return False
        if new_col < 0 or new_col >= self.board_columns:
            return False
    return True
```

### Game.__init__ 추가 (self.current_piece 줄 바로 다음)

```python
self.gravity_timer    = 0
self.gravity_interval = FPS   # 60 프레임마다 1칸 낙하
```

### handle_keydown 수정

```python
def handle_keydown(self, key: int) -> None:
    if key == pygame.K_ESCAPE:
        self.running = False
    elif key == pygame.K_LEFT:
        if self.can_move(0, -1):
            self.current_piece.col -= 1
    elif key == pygame.K_RIGHT:
        if self.can_move(0, 1):
            self.current_piece.col += 1
    elif key == pygame.K_DOWN:
        if self.can_move(1, 0):
            self.current_piece.row += 1
```

### update 수정

```python
def update(self) -> None:
    self.gravity_timer += 1
    if self.gravity_timer >= self.gravity_interval:
        self.gravity_timer = 0
        if self.can_move(1, 0):
            self.current_piece.row += 1
```

## Out of Scope

- 블록 회전 (UP 키 포함)
- 보드 배열(`self.board`)에 블록 고정 저장
- 바닥 도달 후 새 블록 스폰 또는 랜덤 생성
- 줄 삭제 및 점수 계산
- 다음 블록 미리 보기
- 좌우 벽 통과(wrap-around)
- 하드 드롭(스페이스바)
- src/ 분리 또는 리팩토링

## Verification

```powershell
python -m py_compile c:\Users\C544\Desktop\TTRS\main.py
python c:\Users\C544\Desktop\TTRS\main.py
```

## Expected Result

- 문법 오류 없이 컴파일된다.
- 400x600 pygame 창이 열린다.
- 방향키 LEFT/RIGHT 로 블록이 좌우로 이동하며, 보드 경계에서 막힌다.
- 방향키 DOWN 으로 블록을 즉시 한 칸 내릴 수 있으며, 바닥에서 막힌다.
- 아무 키도 누르지 않아도 약 1초(60프레임)마다 블록이 한 칸 자동 낙하한다.
- 블록이 보드 바닥(row 19)에 도달하면 더 이상 내려가지 않고 그 자리에 멈춘다.
- ESC 또는 창 닫기로 정상 종료된다.
- 기존 보드 그리드, 블록 렌더링, 상태 텍스트 등 기존 동작이 유지된다.

## Codex Prompt

```
다음 지시에 따라 c:\Users\C544\Desktop\TTRS\main.py 파일만 수정하세요.

## 목표
현재 정적으로 표시되는 T 블록에 키보드 이동과 중력 낙하를 구현합니다.
main.py 단일 파일 구조를 유지하며, 지시된 범위 외의 기능은 추가하지 않습니다.

## 반드시 지킬 규칙
- main.py 이외의 파일은 생성하거나 수정하지 않습니다.
- 기존 Game 클래스의 run(), handle_events(), draw(), draw_board(),
  draw_current_piece(), draw_status_text(), quit() 메서드 이름, 시그니처,
  내부 동작을 변경하지 않습니다.
- 기존 상수(SCREEN_WIDTH, SCREEN_HEIGHT, FPS, COLOR_*)를 수정하거나
  삭제하지 않습니다.
- Tetromino 클래스의 SHAPES, COLORS, __init__ 을 변경하지 않습니다.
- 회전, 보드 고정 배열, 새 블록 스폰, 줄 삭제, 점수, 랜덤 생성은
  이번 작업에서 구현하지 않습니다.

## 구현 내용

### 1. Game.__init__ 수정
self.current_piece = Tetromino("T") 줄 바로 다음에 아래 두 줄을 추가합니다.

  self.gravity_timer    = 0
  self.gravity_interval = FPS   # 60프레임(약 1초)마다 1칸 낙하

### 2. Game에 can_move 메서드 추가
update 메서드 위(또는 handle_keydown 아래)에 아래 메서드를 추가합니다.

def can_move(self, dr: int, dc: int) -> bool:
    """Return True if current_piece can move by (dr, dc) without leaving the board."""
    piece = self.current_piece
    for cell_dr, cell_dc in piece.cells:
        new_row = piece.row + cell_dr + dr
        new_col = piece.col + cell_dc + dc
        if new_row < 0 or new_row >= self.board_rows:
            return False
        if new_col < 0 or new_col >= self.board_columns:
            return False
    return True

검사 대상:
- new_row 범위: 0 이상 self.board_rows(20) 미만
- new_col 범위: 0 이상 self.board_columns(10) 미만
- piece.cells 의 각 셀 (cell_dr, cell_dc) 에 piece.row, piece.col 과 이동량
  dr, dc 를 합산하여 계산합니다.

### 3. handle_keydown 수정
기존 ESC 처리는 그대로 유지하고, 아래 세 조건을 elif 로 추가합니다.

  elif key == pygame.K_LEFT:
      if self.can_move(0, -1):
          self.current_piece.col -= 1
  elif key == pygame.K_RIGHT:
      if self.can_move(0, 1):
          self.current_piece.col += 1
  elif key == pygame.K_DOWN:
      if self.can_move(1, 0):
          self.current_piece.row += 1

### 4. update 수정
기존 pass 를 제거하고 아래 중력 로직으로 교체합니다.

def update(self) -> None:
    self.gravity_timer += 1
    if self.gravity_timer >= self.gravity_interval:
        self.gravity_timer = 0
        if self.can_move(1, 0):
            self.current_piece.row += 1

매 프레임 gravity_timer 를 1 증가시키고, gravity_interval(60)에 도달하면
타이머를 0으로 리셋합니다. can_move(1, 0) 이 True 일 때만 row 를 1 증가시킵니다.
바닥에 도달해 can_move(1, 0) 이 False 면 row 를 변경하지 않습니다.

## 완료 후 제출 형식
1. 변경한 파일 목록
2. 변경 요약 (추가된 메서드, 수정된 메서드 목록)
3. 실행 명령어:
   python -m py_compile c:\Users\C544\Desktop\TTRS\main.py
   python c:\Users\C544\Desktop\TTRS\main.py
4. 예상 동작:
   - LEFT/RIGHT 키로 블록 좌우 이동, 경계에서 막힘
   - DOWN 키로 즉시 한 칸 낙하, 바닥에서 막힘
   - 약 1초마다 블록 자동 낙하, 바닥에서 정지
```
