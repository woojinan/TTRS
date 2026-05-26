# TTRS — Claude + Codex 개발 워크플로우

## 프로젝트 개요

Python + pygame-ce 기반 테트리스 게임. 단일 파일(`main.py`)로 시작하여 기능이 커지면 `src/` 구조로 분리.

상세 개발 규칙: `ai/rules/project_rules.md`

---

## 역할 분담

| 역할 | 담당 |
|------|------|
| **플래너** | Claude — 요구사항 분석, 작업 지시서 작성 |
| **구현자** | Codex — 실제 코드 수정 |
| **리뷰어** | Claude — 코드 검토, 수정 요청 or 승인 |

**Claude는 직접 코드를 수정하지 않는다. 구현은 항상 Codex를 통한다.**

---

## 워크플로우

**Claude가 모든 단계를 자동으로 실행한다. 사용자는 요청만 하면 된다.**

```
사용자: "기능 X 추가해줘"
    ↓
[1] Claude: 태스크 번호 자동 결정
    - ai/tasks/ 스캔 → 가장 높은 번호 + 1
    - ai/tasks/task_NNN_name.md 작성 (ttrs-planner 에이전트)
    ↓
[2] Claude: 하네스 직접 실행 (Bash 도구)
    - PowerShell: .\harness\start_task.ps1 "NNN_name"
    - Codex가 main.py 수정
    - run_check.ps1 문법 검증
    - ai/status/task_NNN_name.json → codex_done
    ↓
[3] Claude: 코드 리뷰 (ttrs-reviewer 에이전트)
    - task 요구사항 vs 실제 구현 비교
    - ai/reviews/review_NNN_name_R0.md 작성
    ↓ 이슈 있음?
   YES → [4] Claude: 수정 요청 작성 + 즉시 재실행
              - ai/requests/fix_NNN_name_R{n}.md 작성
              - PowerShell: .\harness\run_fix.ps1 -TaskId NNN_name -Round n
              - [3]으로 돌아감 (최대 3회 반복)
    ↓
   NO  → [5] 사용자에게 결과 보고
              - 변경 사항 요약 (추가/수정 메서드, 동작 변화)
              - ai/status → approved
```

### 태스크 번호 자동 결정 방법

```powershell
# Claude가 Glob으로 ai/tasks/task_*.md 스캔
# 파일명에서 숫자 추출 → max + 1 = 다음 번호
# 예: task_009_ui.md 존재 → 다음 태스크는 010
```

---

## 폴더 구조

```
TTRS/
├── CLAUDE.md                        ← 이 파일 (워크플로우 가이드)
├── main.py                          ← 게임 소스 (Codex가 수정)
├── requirements.txt
├── harness/
│   ├── run_check.ps1                ← 문법/환경 검증
│   ├── start_task.ps1               ← 진입점: .\harness\start_task.ps1 "NNN_name"
│   ├── start_codex_task.ps1         ← Codex 실행 + 로그 + status 기록
│   └── run_fix.ps1                  ← 수정 재실행: -TaskId -Round
└── ai/
    ├── rules/
    │   └── project_rules.md         ← 개발 규칙
    ├── tasks/
    │   └── task_NNN_name.md         ← 작업 지시서 (플래너 작성)
    ├── requests/
    │   ├── codex_auto_NNN_name.md   ← 초기 구현 프롬프트 (자동 생성)
    │   └── fix_NNN_name_R{n}.md     ← n번째 수정 요청 프롬프트
    ├── logs/
    │   ├── codex_NNN_name.log       ← 초기 실행 로그
    │   ├── codex_NNN_name.last.md   ← 초기 Codex 마지막 응답
    │   ├── fix_NNN_name_R{n}.log    ← n번째 수정 실행 로그
    │   └── fix_NNN_name_R{n}.last.md
    ├── reviews/
    │   └── review_NNN_name_R{n}.md  ← Claude 리뷰 결과 (n=0: 초기)
    └── status/
        └── task_NNN_name.json       ← 작업 상태 추적
```

---

## 하네스 명령어 (Claude가 Bash 도구로 직접 실행)

```powershell
# 신규 태스크 Codex 실행 — [2]단계에서 Claude가 자동 실행
.\harness\start_task.ps1 "NNN_name"

# 수정 요청 재실행 — [4]단계에서 Claude가 자동 실행
.\harness\run_fix.ps1 -TaskId "NNN_name" -Round 1
```

> 사용자가 직접 실행할 필요 없음. 요청 후 [5]단계 결과 보고를 기다리면 된다.

---

## 작업 상태 (ai/status/task_NNN_name.json)

| status | 의미 |
|--------|------|
| `codex_done` | Codex 완료, Claude 리뷰 대기 |
| `needs_fix` | 리뷰에서 이슈 발견, 수정 요청 작성됨 |
| `fix_done` | 수정 완료, Claude 재리뷰 대기 |
| `approved` | 리뷰 승인, 태스크 완료 |

---

## 태스크 파일 규칙

- 파일명: `task_<3자리 번호>_<이름>.md`
- 필수 섹션: `## Codex Prompt` (코드블록으로 감싸기)
- 구현 명세: 한글 설명 + Python 코드 예시
- 절대경로 명시: `c:\Users\C544\Desktop\TTRS\main.py`
