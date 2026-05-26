# Task 008 - DAS/ARR (방향키 자동 반복)

## Goal

LEFT/RIGHT 키를 누르고 있으면 초기 딜레이(DAS) 이후 일정 간격(ARR)으로 블록이 자동 이동한다.

## Context

현재 LEFT/RIGHT는 KEYDOWN 이벤트 1회만 처리하므로 키를 오래 눌러도 한 칸만 이동한다.
KEYUP 이벤트는 처리하지 않는다.

```python
# 현재 handle_keydown
elif key == pygame.K_LEFT:
    if self.can_move(0, -1):
        self.current_piece.col -= 1
elif key == pygame.K_RIGHT:
    if self.can_move(0, 1):
        self.current_piece.col += 1

# 현재 handle_events — KEYUP 없음
elif event.type == pygame.KEYDOWN:
    self.handle_keydown(event.key)

# 현재 update — DAS 없음
def update(self) -> None:
    self.gravity_timer += 1
    ...
```

표준 DAS/ARR 값:
- DAS delay: 10 프레임 (~167ms) — 키를 처음 누르고 자동 반복이 시작될 때까지 대기
- ARR rate: 2 프레임 (~33ms) — 자동 반복 간격

## Files to Modify

- `c:\Users\C544\Desktop\TTRS\main.py`

## Requirements

- [ ] `Game.__init__`에 `self.held_left`, `self.held_right`, `self.das_timer`, `self.das_delay`, `self.arr_timer`, `self.arr_rate` 추가
- [ ] `handle_keydown` — LEFT/RIGHT: held 플래그 set, 타이머 리셋, 즉시 1회 이동
- [ ] `handle_keyup(key)` 메서드 추가 — LEFT/RIGHT KEYUP 시 held 플래그 clear, 타이머 리셋
- [ ] `handle_events` — `pygame.KEYUP` 이벤트를 `handle_keyup`으로 연결
- [ ] `update` 끝에 DAS/ARR 로직 추가 — held 상태일 때 das_timer 증가, das_delay 도달 후 arr_rate마다 이동

## 구현 명세

### Game.__init__ 추가 (self.gravity_interval = FPS 다음 줄)

```python
self.held_left  = False
self.held_right = False
self.das_timer  = 0
self.das_delay  = 10   # 프레임 수: 자동 반복 시작까지 대기
self.arr_timer  = 0
self.arr_rate   = 2    # 프레임 수: 자동 반복 간격
```

### handle_keydown 수정 (K_LEFT, K_RIGHT 부분 교체)

```python
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
```

### handle_keyup 메서드 추가 (handle_keydown 아래)

```python
def handle_keyup(self, key: int) -> None:
    if key == pygame.K_LEFT:
        self.held_left = False
        self.das_timer = 0
        self.arr_timer = 0
    elif key == pygame.K_RIGHT:
        self.held_right = False
        self.das_timer = 0
        self.arr_timer = 0
```

### handle_events 수정

```python
def handle_events(self) -> None:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            self.running = False
        elif event.type == pygame.KEYDOWN:
            self.handle_keydown(event.key)
        elif event.type == pygame.KEYUP:
            self.handle_keyup(event.key)
```

### update 수정 (기존 중력 로직 끝에 추가)

```python
# DAS/ARR 자동 반복
if self.held_left or self.held_right:
    self.das_timer += 1
    if self.das_timer >= self.das_delay:
        self.arr_timer += 1
        if self.arr_timer >= self.arr_rate:
            self.arr_timer = 0
            if self.held_left and self.can_move(0, -1):
                self.current_piece.col -= 1
            elif self.held_right and self.can_move(0, 1):
                self.current_piece.col += 1
else:
    self.das_timer = 0
    self.arr_timer = 0
```

## Out of Scope

- 소프트드롭 자동 반복 (DOWN 키)
- DAS/ARR 수치 설정 화면
- 게임오버 상태에서의 입력 차단 (다음 태스크에서 처리)

## Verification

```powershell
python -m py_compile c:\Users\C544\Desktop\TTRS\main.py
python c:\Users\C544\Desktop\TTRS\main.py
```

## Expected Result

- LEFT/RIGHT 키를 짧게 누르면 1칸 이동 (기존 동일)
- LEFT/RIGHT 키를 길게 누르면 약 167ms 후 33ms마다 연속 이동
- 키를 떼면 즉시 이동 중단

## Codex Prompt

```
다음 지시에 따라 c:\Users\C544\Desktop\TTRS\main.py 파일만 수정하세요.

## 목표
LEFT/RIGHT 키를 누르고 있으면 초기 딜레이(DAS) 이후 자동 반복(ARR) 이동을 구현합니다.

## 반드시 지킬 규칙
- main.py 이외의 파일은 수정하지 않습니다.
- 기존 메서드 시그니처를 변경하지 않습니다.
- 기존 상수를 수정하거나 삭제하지 않습니다.

## 구현 내용

### 1. Game.__init__ 추가
self.gravity_interval = FPS 줄 다음에 아래를 추가합니다.

  self.held_left  = False
  self.held_right = False
  self.das_timer  = 0
  self.das_delay  = 10
  self.arr_timer  = 0
  self.arr_rate   = 2

### 2. handle_keydown의 K_LEFT, K_RIGHT 블록 교체

기존:
  elif key == pygame.K_LEFT:
      if self.can_move(0, -1):
          self.current_piece.col -= 1
  elif key == pygame.K_RIGHT:
      if self.can_move(0, 1):
          self.current_piece.col += 1

교체 후:
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

### 3. handle_keyup 메서드 추가 (handle_keydown 바로 아래)

def handle_keyup(self, key: int) -> None:
    if key == pygame.K_LEFT:
        self.held_left = False
        self.das_timer = 0
        self.arr_timer = 0
    elif key == pygame.K_RIGHT:
        self.held_right = False
        self.das_timer = 0
        self.arr_timer = 0

### 4. handle_events 수정
KEYUP 이벤트 처리를 추가합니다.

def handle_events(self) -> None:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            self.running = False
        elif event.type == pygame.KEYDOWN:
            self.handle_keydown(event.key)
        elif event.type == pygame.KEYUP:
            self.handle_keyup(event.key)

### 5. update 수정
기존 중력 로직(if self.gravity_timer >= ...) 블록 바로 다음에 아래를 추가합니다.

  if self.held_left or self.held_right:
      self.das_timer += 1
      if self.das_timer >= self.das_delay:
          self.arr_timer += 1
          if self.arr_timer >= self.arr_rate:
              self.arr_timer = 0
              if self.held_left and self.can_move(0, -1):
                  self.current_piece.col -= 1
              elif self.held_right and self.can_move(0, 1):
                  self.current_piece.col += 1
  else:
      self.das_timer = 0
      self.arr_timer = 0

## 완료 후 제출 형식
1. 변경한 파일 목록
2. 추가/수정된 메서드 목록
3. python -m py_compile 결과
```
