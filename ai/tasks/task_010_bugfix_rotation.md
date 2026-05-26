# Task 010 - T블록 스폰 방향 수정 + 벽킥(Wall Kick) 구현

## Goal

1. T 블록이 표준 방향(돌기 위)으로 스폰되도록 수정
2. 벽 근처에서도 회전이 가능하도록 Wall Kick 구현

## Context

### 버그 1: T 블록 스폰 방향

현재 T 블록 셀 정의:
```python
"T": [(0, 0), (0, 1), (0, 2), (1, 1)],
```
결과:
```
T T T
. T .
```
표준 테트리스(Guideline)는 돌기가 위를 향해야 함:
```
. T .
T T T
```

### 버그 2: 벽킥 없음

현재 회전 로직:
```python
elif key == pygame.K_UP:
    rotated = self.current_piece.rotate_cw()
    if self.can_place(rotated, self.current_piece.row, self.current_piece.col):
        self.current_piece.cells = rotated
```

벽 근처에서는 `can_place`가 False를 반환해 회전이 완전히 차단됨.
표준 구현: 회전 실패 시 열(col) 오프셋 [0, -1, +1, -2, +2] 순서로 시도.

## Files to Modify

- `c:\Users\C544\Desktop\TTRS\main.py`

## Requirements

- [ ] `Tetromino.SHAPES["T"]` 을 `[(0, 1), (1, 0), (1, 1), (1, 2)]` 로 변경
- [ ] `handle_keydown`의 `K_UP` 핸들러를 wall kick 로직으로 교체

## 구현 명세

### 1. T 블록 셀 정의 수정 (Tetromino.SHAPES)

```python
# 변경 전
"T": [(0, 0), (0, 1), (0, 2), (1, 1)],

# 변경 후
"T": [(0, 1), (1, 0), (1, 1), (1, 2)],
```

### 2. handle_keydown의 K_UP 블록 교체

```python
# 변경 전
elif key == pygame.K_UP:
    rotated = self.current_piece.rotate_cw()
    if self.can_place(rotated, self.current_piece.row, self.current_piece.col):
        self.current_piece.cells = rotated

# 변경 후
elif key == pygame.K_UP:
    rotated = self.current_piece.rotate_cw()
    for dc in [0, -1, 1, -2, 2]:
        if self.can_place(rotated, self.current_piece.row, self.current_piece.col + dc):
            self.current_piece.cells = rotated
            self.current_piece.col += dc
            break
```

## Out of Scope

- 전체 SRS 회전 시스템 (rotation state 추적)
- CCW 회전
- 180도 회전
- J, L, S, Z, I 개별 wall kick 테이블

## Verification

```powershell
python -m py_compile c:\Users\C544\Desktop\TTRS\main.py
python c:\Users\C544\Desktop\TTRS\main.py
```

## Expected Result

- T 블록 스폰 시 돌기가 위를 향함
- 블록이 벽에 붙어있어도 공간이 있으면 회전 가능 (최대 ±2칸 이동)

## Codex Prompt

```
다음 지시에 따라 c:\Users\C544\Desktop\TTRS\main.py 파일만 수정하세요.

## 반드시 지킬 규칙
- main.py 이외의 파일은 수정하지 않습니다.
- 기존 메서드 시그니처를 변경하지 않습니다.
- 명시된 2개 변경 외에는 아무것도 수정하지 않습니다.

## 변경 1: T 블록 스폰 방향 수정

Tetromino.SHAPES 딕셔너리에서 "T" 항목을 다음과 같이 변경합니다.

변경 전:
    "T": [(0, 0), (0, 1), (0, 2), (1, 1)],

변경 후:
    "T": [(0, 1), (1, 0), (1, 1), (1, 2)],

## 변경 2: K_UP 회전에 Wall Kick 추가

handle_keydown 메서드에서 `elif key == pygame.K_UP:` 블록을 다음으로 교체합니다.

변경 전:
        elif key == pygame.K_UP:
            rotated = self.current_piece.rotate_cw()
            if self.can_place(rotated, self.current_piece.row, self.current_piece.col):
                self.current_piece.cells = rotated

변경 후:
        elif key == pygame.K_UP:
            rotated = self.current_piece.rotate_cw()
            for dc in [0, -1, 1, -2, 2]:
                if self.can_place(rotated, self.current_piece.row, self.current_piece.col + dc):
                    self.current_piece.cells = rotated
                    self.current_piece.col += dc
                    break

## 완료 후 제출 형식
1. 변경한 파일 목록
2. 변경된 위치 (줄 번호)
3. python -m py_compile 결과
```
