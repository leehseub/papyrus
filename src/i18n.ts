export const translations = {
  ko: {
    // Sidebar
    openingVault: '여는 중...',
    openFolder: '폴더 열기',
    openFile: '파일 열기',
    noVaultOpen: '열린 Vault가 없습니다.',
    newFile: '새 파일',
    refresh: '새로고침',
    search: '검색',
    tagsNav: '태그',
    graphViewNav: '그래프 뷰',
    lightMode: '라이트 모드',
    darkMode: '다크 모드',
    language: '언어 설정',
    filePlaceholder: '파일을 선택해 편집을 시작하세요.',
    renameFolderFail: '폴더 이름 변경 실패 (최신 Chrome 필요)',
    moveFileFail: '이미 같은 이름의 파일이 있습니다',

    // Dialog — close tab
    saveChangesMsg: (name: string) => `"${name}"의 변경사항을 저장하시겠습니까?`,
    save: '저장',
    dontSave: '저장 안 함',
    cancel: '취소',

    // Dialog — delete file
    deleteFileMsg: (name: string) => `"${name}" 파일을 삭제하시겠습니까?`,
    deleteFileWarning: '이 작업은 되돌릴 수 없습니다.',
    delete: '삭제',

    // Editor
    titlePlaceholder: '제목 없음',
    addRow: '행 추가',
    addColumn: '열 추가',
    deleteRow: '행 삭제',
    deleteColumn: '열 삭제',
    deleteTable: '테이블 삭제',
    saving: '저장 중...',
    unsaved: '● 저장되지 않음',
    saved: '저장됨',

    // Search
    searchPlaceholder: '검색...',
    searching: '검색 중...',
    noResults: '결과 없음',

    // TagPanel
    tags: '태그',
    scan: '스캔',
    scanning: '스캔 중...',
    scanHint: '"스캔" 버튼으로 태그를 불러오세요.',
    refreshTagIndex: '태그 인덱스 갱신',

    // GraphView
    graphView: '그래프 뷰',
    analyze: '분석',
    analyzing: '분석 중...',
    selectionModeOn: '선택 모드 끄기 (Esc)',
    selectionModeOff: '선택 모드 (S / Ctrl+클릭)',
    openInWindow: '새 창으로 열기',
    buildingGraph: '파일 분석 중...',
    emptyGraph: '분석 버튼으로 그래프를 생성하세요.',
    noFiles: '파일이 없습니다.',
    selectedCount: (n: number) => `${n}개 선택됨`,
    createGroup: '그룹 만들기',
    deselect: '해제',
    groupNamePlaceholder: '그룹 이름',
    confirm: '확인',
    groups: '그룹',
    connectTarget: (name: string) => `→ ${name} 연결 대상 선택`,
    linkModeHint: '그룹을 선택하거나 캔버스의 노드를 클릭하세요',
    nodeCount: (n: number) => `${n}개`,
    connect: '연결',
    createLink: '연결 만들기',
    deleteGroup: '그룹 삭제',
    connections: '연결',
    deleteConnection: '연결 삭제',
    currentFile: '현재 파일',
    note: '노트',
  },

  en: {
    // Sidebar
    openingVault: 'Opening...',
    openFolder: 'Open Folder',
    openFile: 'Open File',
    noVaultOpen: 'No vault open.',
    newFile: 'New File',
    refresh: 'Refresh',
    search: 'Search',
    tagsNav: 'Tags',
    graphViewNav: 'Graph View',
    lightMode: 'Light mode',
    darkMode: 'Dark mode',
    language: 'Language',
    filePlaceholder: 'Select a file to start editing.',
    renameFolderFail: 'Rename failed (requires Chrome 121+)',
    moveFileFail: 'A file with that name already exists',

    // Dialog — close tab
    saveChangesMsg: (name: string) => `Save changes to "${name}"?`,
    save: 'Save',
    dontSave: "Don't Save",
    cancel: 'Cancel',

    // Dialog — delete file
    deleteFileMsg: (name: string) => `Delete "${name}"?`,
    deleteFileWarning: 'This action cannot be undone.',
    delete: 'Delete',

    // Editor
    titlePlaceholder: 'Untitled',
    addRow: 'Add Row',
    addColumn: 'Add Column',
    deleteRow: 'Delete Row',
    deleteColumn: 'Delete Column',
    deleteTable: 'Delete Table',
    saving: 'Saving...',
    unsaved: '● Unsaved',
    saved: 'Saved',

    // Search
    searchPlaceholder: 'Search...',
    searching: 'Searching...',
    noResults: 'No results',

    // TagPanel
    tags: 'Tags',
    scan: 'Scan',
    scanning: 'Scanning...',
    scanHint: 'Click "Scan" to load tags.',
    refreshTagIndex: 'Refresh tag index',

    // GraphView
    graphView: 'Graph View',
    analyze: 'Build',
    analyzing: 'Building...',
    selectionModeOn: 'Exit selection mode (Esc)',
    selectionModeOff: 'Selection mode (S / Ctrl+click)',
    openInWindow: 'Open in window',
    buildingGraph: 'Building graph...',
    emptyGraph: 'Click Build to generate the graph.',
    noFiles: 'No files.',
    selectedCount: (n: number) => `${n} selected`,
    createGroup: 'Create Group',
    deselect: 'Deselect',
    groupNamePlaceholder: 'Group name',
    confirm: 'OK',
    groups: 'Groups',
    connectTarget: (name: string) => `→ Select target for ${name}`,
    linkModeHint: 'Select a group or click a node on the canvas',
    nodeCount: (n: number) => `${n}`,
    connect: 'Connect',
    createLink: 'Create link',
    deleteGroup: 'Delete group',
    connections: 'Connections',
    deleteConnection: 'Delete connection',
    currentFile: 'Current file',
    note: 'Note',
  },
} as const

export type Translations = typeof translations.ko
