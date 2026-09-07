# Papyrus

한국어 | [English](./README.en.md)

> Obsidian에서 영감을 받은 로컬 마크다운 메모장

![Papyrus Screenshot](docs/screenshot.png)

로컬 파일을 직접 읽고 쓰는 WYSIWYG 마크다운 에디터입니다.
Obsidian의 Vault 개념과 Notion의 편집 경험을 결합해, 설치만 하면 바로 쓸 수 있는 가벼운 노트 앱을 목표로 만들었습니다.

---

## 주요 기능

### 에디터
- **WYSIWYG Live Preview** — 마크다운을 직접 렌더링하며 편집 (Notion 스타일)
- **`/` 슬래시 커맨드** — 제목, 목록, 코드 블록, 테이블, 토글 등 빠른 삽입
- **토글 블록** — 접고 펼칠 수 있는 Notion 스타일 콜랩서블
- **체크리스트** — 할 일 목록 (중첩 지원)
- **테이블** — 행/열 추가·삭제 툴바, 컬럼 리사이즈
- **자동 괄호 완성** — `[`, `(`, `{`, `"` 입력 시 닫는 문자 자동 삽입
- **탭 시스템** — 파일별 탭, `Ctrl+S` 수동 저장, 미저장 표시(●), 닫기 시 확인 다이얼로그

### Vault (폴더 기반 노트 관리)
- **로컬 폴더를 Vault로** — 폴더를 열어 `.md` 파일 전체를 관리
- **파일 트리** — 폴더/파일 탐색, 생성, 삭제, 드래그앤드롭 이동, 폴더 이름 변경(F2 또는 더블클릭)
- **`[[wikilink]]`** — 다른 노트로 이동하는 위키 링크, 저장 시 파일명 변경에 따라 자동 업데이트
- **`#태그`** — 인라인 태그 하이라이트 및 태그 패널
- **전체 텍스트 검색** — Vault 내 파일 전체 검색

### 그래프 뷰
- **D3.js 포스 시뮬레이션** — 파일 간 wikilink 관계를 노드-엣지 그래프로 시각화
- **노드 드래그** — 위치 고정, 리빌드 후에도 위치 유지
- **다중 선택** — 클릭으로 단일 선택, `Ctrl+클릭`으로 추가 선택, 고무밴드 드래그로 범위 선택
- **그룹** — 선택한 노드를 그룹으로 묶고 색상 라벨 표시
- **별도 창(PiP)** — 그래프를 독립 팝업 창으로 열기, 사이드바와 노드 위치 실시간 동기화

### 기타
- **다크/라이트 테마**
- **커스텀 타이틀바** (Electron 전용)
- **Firefox 미지원** — File System Access API 제약

---

## 기술 스택

| 역할 | 라이브러리 |
|------|-----------|
| 프레임워크 | Vite + React 19 + TypeScript |
| 에디터 | TipTap v3 (ProseMirror 기반) |
| 마크다운 | tiptap-markdown |
| 그래프 | D3.js v7 |
| 데스크탑 | Electron 44 + electron-builder |
| 파일 시스템 | File System Access API |

---

## 시작하기

### 개발 환경

```bash
# 의존성 설치
npm install

# 브라우저 개발 서버 (Chrome 권장)
npm run dev

# Electron 개발 모드
npm run electron:dev
```

### 빌드 및 배포

```bash
# 웹 빌드 (dist/ 폴더)
npm run build

# Electron 인스톨러 빌드 (release/ 폴더)
npm run electron:build
```

| 플랫폼 | 결과물 |
|--------|--------|
| Windows | `Papyrus Setup x.x.x.exe` (NSIS) |
| macOS | `Papyrus-x.x.x.dmg` |
| Linux | `Papyrus-x.x.x.AppImage` |

> **크로스 플랫폼 빌드**: 각 플랫폼에서 빌드해야 합니다. GitHub Actions를 이용하면 자동화 가능합니다.

---

## 프로젝트 구조

```
papyrus/
├── electron/
│   ├── main.cjs        # Electron 메인 프로세스
│   └── preload.cjs     # IPC 브릿지 (window 최소화/최대화/닫기)
├── src/
│   ├── components/
│   │   ├── Editor/     # TipTap 에디터 + 상태바 + 테이블 툴바
│   │   ├── FileTree/   # 파일/폴더 트리, 드래그앤드롭
│   │   ├── GraphView/  # D3 그래프 (사이드바 패널)
│   │   ├── Search/     # 전체 텍스트 검색
│   │   ├── TabBar/     # 탭 바
│   │   ├── TagPanel/   # 태그 인덱스 패널
│   │   └── TitleBar/   # 커스텀 윈도우 크롬
│   ├── extensions/
│   │   ├── Collapsible/        # 토글 블록 TipTap 확장
│   │   ├── SlashCommand/       # / 커맨드 메뉴
│   │   ├── AutoPair.ts         # 자동 괄호 완성
│   │   ├── TagDecorator.ts     # #태그 데코레이터
│   │   └── WikilinkDecorator.ts# [[wikilink]] 데코레이터
│   ├── hooks/
│   │   ├── useVault.ts     # Vault 열기/파일 CRUD
│   │   ├── useTabs.ts      # 탭 상태 관리
│   │   ├── useGraphData.ts # wikilink 파싱 → 그래프 데이터
│   │   ├── useSearch.ts    # 전체 텍스트 검색
│   │   └── useTagIndex.ts  # 태그 인덱스
│   ├── App.tsx         # 루트 레이아웃, 상태 조율
│   └── GraphWindow.tsx # PiP 그래프 창
└── public/
    └── icon.png
```

---

## Reference

- [Obsidian](https://obsidian.md) — Vault 개념, wikilink, 그래프 뷰
- [Notion](https://notion.so) — 블록 기반 WYSIWYG 편집 경험

Obsidian의 철학("당신의 파일, 당신의 폴더")을 따르면서,
설치 없이 브라우저에서도, 또는 Electron 앱으로도 동작하는 가볍고 빠른 대안을 목표로 합니다.

---

## 라이선스

MIT © 2025
