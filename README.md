# Tetris Battle

한국어 중심의 실시간 멀티플레이 테트리스 게임을 위한 FastAPI 프로젝트입니다.

## 현재 단계

Phase 1을 구현했습니다.

- FastAPI 애플리케이션
- `GET /health` 상태 확인 API
- 한국어 메인 로비 화면

## 실행

Python 3.12 이상에서 가상환경을 만들고 의존성을 설치합니다.

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

브라우저에서 `http://127.0.0.1:8000`을 열고, 상태 확인은 `http://127.0.0.1:8000/health`에서 할 수 있습니다.

## 테스트

```powershell
pytest
```

