# 기능 명세서

> blog.divops.kr 프로젝트의 전체 기능을 케이스별로 정리한 명세서입니다.

---

## 1. 인증 (Auth)

### 1.1 GitHub OAuth 로그인

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| AUTH-001 | GitHub 로그인 성공 | 유효한 GitHub 계정 | 세션 생성, user 테이블에 저장, role=USER |
| AUTH-002 | 기존 사용자 재로그인 | 이미 가입된 GitHub 계정 | 기존 user 연결, 새 세션 생성 |
| AUTH-003 | 세션에 role 포함 | 로그인된 사용자 | session.user.role 반환 (USER 또는 ADMIN) |
| AUTH-004 | 세션에 id 포함 | 로그인된 사용자 | session.user.id 반환 |

### 1.2 인증 가드 (proxy.ts)

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| AUTH-010 | /admin 미인증 접근 | 세션 없음 + GET /admin/* | `/api/auth/signin`으로 리다이렉트 |
| AUTH-011 | /admin 인증 접근 | 유효 세션 + GET /admin/* | 통과 (undefined 반환) |
| AUTH-012 | 공개 페이지 접근 | 세션 없음 + GET / | 통과 (undefined 반환) |
| AUTH-013 | API 경로 접근 | 세션 없음 + GET /api/* | 통과 (proxy는 차단 안 함, API 자체에서 인증 처리) |

### 1.3 Admin Layout 인증 가드

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| AUTH-020 | 미인증 접근 | 세션 없음 | `/api/auth/signin`으로 redirect |
| AUTH-021 | 인증 접근 | 유효 세션 | 네비게이션 바 + children 렌더링 |
| AUTH-022 | 사용자 이름 표시 | 유효 세션 | nav에 session.user.name 표시 |

---

## 2. 글 CRUD API (`/api/posts`)

### 2.1 글 목록 조회 (GET /api/posts)

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| POST-001 | 기본 조회 | 파라미터 없음 | page=1, limit=10, published=true인 글만 반환 |
| POST-002 | 페이지네이션 | ?page=2&limit=5 | offset=5, limit=5로 조회 |
| POST-003 | 정렬 순서 | published 글 다수 | publishedAt 내림차순 정렬 |
| POST-004 | author 정보 포함 | - | author.name, author.image 포함 |
| POST-005 | total 카운트 | published 글 15개 | total=15 반환 |
| POST-006 | 비공개 글 제외 | published=false 글 존재 | 목록에 미포함 |
| POST-007 | 빈 결과 | published 글 0개 | posts=[], total=0 |

### 2.2 글 생성 (POST /api/posts)

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| POST-010 | 정상 생성 (초안) | title+content+slug, published=false | 201, published=false, publishedAt=null |
| POST-011 | 정상 생성 (발행) | title+content+slug, published=true | 201, published=true, publishedAt=현재시간 |
| POST-012 | 미인증 요청 | 세션 없음 | 401 Unauthorized |
| POST-013 | title 누락 | content+slug만 전송 | 400, "title, content, slug are required" |
| POST-014 | content 누락 | title+slug만 전송 | 400 |
| POST-015 | slug 누락 | title+content만 전송 | 400 |
| POST-016 | 선택 필드 포함 | excerpt+coverImage 포함 | 201, 해당 필드 저장됨 |
| POST-017 | published 미지정 | published 필드 없음 | published=false (기본값) |
| POST-018 | authorId 자동 설정 | 인증된 사용자 | session.user.id가 authorId로 설정 |

### 2.3 글 상세 조회 (GET /api/posts/:id)

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| POST-020 | 정상 조회 | 존재하는 ID | 200, 전체 필드 + author 정보 |
| POST-021 | 존재하지 않는 ID | 잘못된 ID | 404 Not found |
| POST-022 | author 정보 포함 | - | author.name, author.image 포함 |

### 2.4 글 수정 (PUT /api/posts/:id)

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| POST-030 | 정상 수정 | 본인 글 + 유효 데이터 | 200, 변경된 데이터 반환 |
| POST-031 | 미인증 요청 | 세션 없음 | 401 |
| POST-032 | 존재하지 않는 글 | 잘못된 ID | 404 |
| POST-033 | 다른 사용자의 글 | 다른 authorId | 403 Forbidden |
| POST-034 | 초안 → 발행 전환 | published: false→true | publishedAt이 현재 시간으로 설정 |
| POST-035 | 이미 발행된 글 수정 | published: true (변경 없음) | publishedAt 유지 (변경되지 않음) |
| POST-036 | updatedAt 자동 갱신 | 수정 요청 | updatedAt이 현재 시간으로 설정 |

### 2.5 글 삭제 (DELETE /api/posts/:id)

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| POST-040 | 정상 삭제 | 본인 글 | 200, { success: true } |
| POST-041 | 미인증 요청 | 세션 없음 | 401 |
| POST-042 | 존재하지 않는 글 | 잘못된 ID | 404 |
| POST-043 | 다른 사용자의 글 | 다른 authorId | 403 |

---

## 3. 이미지 업로드 API (`/api/upload`)

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| UPLOAD-001 | 정상 업로드 (JPEG) | image/jpeg, 1MB | 200, { url: "https://s3.../uploads/..." } |
| UPLOAD-002 | 정상 업로드 (PNG) | image/png | 200, url 반환 |
| UPLOAD-003 | 정상 업로드 (GIF) | image/gif | 200, url 반환 |
| UPLOAD-004 | 정상 업로드 (WebP) | image/webp | 200, url 반환 |
| UPLOAD-005 | 미인증 요청 | 세션 없음 | 401 Unauthorized |
| UPLOAD-006 | 파일 없음 | formData에 file 없음 | 400, "No file provided" |
| UPLOAD-007 | 허용되지 않은 타입 | image/svg+xml | 400, "File type not allowed..." |
| UPLOAD-008 | 허용되지 않은 타입 | application/pdf | 400 |
| UPLOAD-009 | 파일 크기 초과 | 6MB 파일 | 400, "File too large. Maximum 5MB." |
| UPLOAD-010 | 정확히 5MB | 5MB 파일 | 200, 업로드 성공 |
| UPLOAD-011 | 파일명에서 확장자 추출 | photo.jpg | key에 .jpg 확장자 포함 |
| UPLOAD-012 | UUID 포함 키 | - | key 형식: uploads/{timestamp}-{uuid}.{ext} |

---

## 4. 공개 블로그 페이지

### 4.1 메인 페이지 (/)

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| PAGE-001 | 제목 표시 | - | "blog.divops.kr" h1 렌더링 |
| PAGE-002 | 발행된 글 목록 | published 글 존재 | PostList 컴포넌트로 렌더링 |
| PAGE-003 | 빈 상태 | published 글 없음 | "아직 작성된 글이 없습니다." 표시 |
| PAGE-004 | 최대 20개 제한 | 30개 published 글 | 최신 20개만 표시 |
| PAGE-005 | 최신순 정렬 | - | publishedAt 내림차순 |
| PAGE-006 | dynamic 렌더링 | - | force-dynamic (SSR) |

### 4.2 글 상세 페이지 (/[slug])

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| PAGE-010 | 정상 렌더링 | 존재하는 slug | PostDetail 컴포넌트로 렌더링 |
| PAGE-011 | 존재하지 않는 slug | 잘못된 slug | 404 notFound() |
| PAGE-012 | ISR revalidate | - | 60초마다 재검증 |
| PAGE-013 | dynamicParams | - | true (빌드 시 미생성 경로도 허용) |
| PAGE-014 | generateStaticParams 실패 | DB 연결 불가 | 빈 배열 반환 (에러 무시) |

### 4.3 메타데이터 (SEO)

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| SEO-001 | 글 상세 메타데이터 | 존재하는 slug | title, description, openGraph 설정 |
| SEO-002 | OG type | - | "article" |
| SEO-003 | OG publishedTime | publishedAt 존재 | ISO 문자열로 변환 |
| SEO-004 | OG images | coverImage 존재 | 이미지 배열에 포함 |
| SEO-005 | coverImage 없음 | coverImage=null | images=[] |
| SEO-006 | 존재하지 않는 글 메타 | 잘못된 slug | 빈 객체 {} 반환 |

---

## 5. SEO

### 5.1 Sitemap (/sitemap.xml)

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| SEO-010 | 홈페이지 포함 | - | url: https://blog.divops.kr, priority: 1, changeFrequency: daily |
| SEO-011 | published 글 포함 | published 글 존재 | 각 글의 URL 포함, priority: 0.8 |
| SEO-012 | 비공개 글 제외 | draft 글 존재 | sitemap에 미포함 |
| SEO-013 | lastModified | - | 글의 updatedAt 사용 |
| SEO-014 | dynamic 렌더링 | - | force-dynamic |

### 5.2 Robots (/robots.txt)

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| SEO-020 | 모든 크롤러 허용 | - | userAgent: *, allow: / |
| SEO-021 | admin 차단 | - | disallow: /admin/ |
| SEO-022 | api 차단 | - | disallow: /api/ |
| SEO-023 | sitemap 링크 | - | sitemap: https://blog.divops.kr/sitemap.xml |

---

## 6. UI 컴포넌트

### 6.1 PostList

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| UI-001 | 빈 목록 | posts=[] | "아직 작성된 글이 없습니다." 표시 |
| UI-002 | 글 제목 렌더링 | posts 배열 | 각 글의 title을 h2로 렌더링 |
| UI-003 | 글 링크 | slug="test" | `/<slug>` 링크 |
| UI-004 | excerpt 표시 | excerpt 존재 | excerpt 텍스트 표시 |
| UI-005 | excerpt 없음 | excerpt=null | excerpt 영역 미렌더링 |
| UI-006 | 작성자 이름 | author.name 존재 | 이름 표시 |
| UI-007 | 작성자 없음 | author.name=null | 이름 영역 미렌더링 |
| UI-008 | 날짜 표시 | publishedAt 존재 | ko-KR 형식 날짜 표시 |
| UI-009 | 날짜 없음 | publishedAt=null | 날짜 영역 미렌더링 |

### 6.2 PostDetail

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| UI-010 | 제목 렌더링 | title="Test" | h1에 "Test" 표시 |
| UI-011 | 본문 렌더링 | content HTML | dangerouslySetInnerHTML로 렌더링 |
| UI-012 | 커버 이미지 | coverImage 존재 | Image 컴포넌트 렌더링 |
| UI-013 | 커버 이미지 없음 | coverImage=null | 이미지 미렌더링 |
| UI-014 | 작성자 아바타 | author.image 존재 | 32x32 rounded Image 렌더링 |
| UI-015 | 작성자 아바타 없음 | author.image=null | 아바타 미렌더링 |
| UI-016 | 날짜 표시 | publishedAt 존재 | time 태그 + ko-KR 형식 |

### 6.3 글 작성 페이지 (/admin/write)

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| UI-020 | 폼 렌더링 | - | title, slug, excerpt, content 필드 표시 |
| UI-021 | slug 자동 생성 | title 입력 후 blur | title을 slug 형식으로 변환 |
| UI-022 | slug 변환 규칙 | "Hello World!" | "hello-world" |
| UI-023 | 한글 slug | "안녕 세계" | "안녕-세계" |
| UI-024 | 특수문자 제거 | "Test@#$Post" | "testpost" |
| UI-025 | 초안 저장 | Save Draft 클릭 | POST /api/posts, published=false |
| UI-026 | 발행 | Publish 클릭 | POST /api/posts, published=true |
| UI-027 | 필수 필드 미입력 | title/content/slug 비어있음 | 제출 안 됨 (early return) |
| UI-028 | 저장 중 비활성화 | 저장 진행 중 | 버튼 disabled |
| UI-029 | 저장 성공 후 이동 | 201 응답 | /admin/posts로 라우팅 |

### 6.4 글 관리 페이지 (/admin/posts)

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| UI-030 | 테이블 렌더링 | 글 존재 | Title, Status, Date 컬럼 표시 |
| UI-031 | Published 배지 | published=true | 초록 배지 "Published" |
| UI-032 | Draft 배지 | published=false | 노랑 배지 "Draft" |
| UI-033 | 빈 상태 | 글 없음 | "No posts yet" 표시 |
| UI-034 | New Post 버튼 | - | /admin/write 링크 |
| UI-035 | 글 편집 링크 | 글 제목 클릭 | /admin/write?edit={id} 이동 |
| UI-036 | 최신순 정렬 | - | createdAt 내림차순 |

---

## 7. TipTap 에디터

| ID | 케이스 | 입력/조건 | 기대 결과 |
|----|--------|----------|----------|
| EDITOR-001 | 기본 렌더링 | content="" | 빈 에디터 + 툴바 |
| EDITOR-002 | Bold 토글 | B 버튼 클릭 | 볼드 모드 토글 |
| EDITOR-003 | Italic 토글 | I 버튼 클릭 | 이탤릭 모드 토글 |
| EDITOR-004 | H2 토글 | H2 버튼 클릭 | heading level 2 토글 |
| EDITOR-005 | H3 토글 | H3 버튼 클릭 | heading level 3 토글 |
| EDITOR-006 | 리스트 토글 | List 버튼 클릭 | bulletList 토글 |
| EDITOR-007 | 코드 블록 토글 | Code 버튼 클릭 | codeBlock 토글 |
| EDITOR-008 | 이미지 업로드 | Image 버튼 → 파일 선택 | /api/upload 호출 → 에디터에 삽입 |
| EDITOR-009 | onChange 콜백 | 에디터 내용 변경 | HTML 문자열로 onChange 호출 |
| EDITOR-010 | 허용 이미지 타입 | - | jpeg, png, gif, webp만 accept |

---

## 8. DB 스키마

### 8.1 User 테이블

| 필드 | 타입 | 제약 | 기본값 |
|------|------|------|--------|
| id | text | PK | createId() |
| name | text | nullable | - |
| email | text | unique, nullable | - |
| emailVerified | timestamp | nullable | - |
| image | text | nullable | - |
| role | enum(USER,ADMIN) | NOT NULL | USER |
| createdAt | timestamp | NOT NULL | now() |
| updatedAt | timestamp | NOT NULL | now() |

### 8.2 Post 테이블

| 필드 | 타입 | 제약 | 기본값 |
|------|------|------|--------|
| id | text | PK | createId() |
| title | text | NOT NULL | - |
| slug | text | UNIQUE, NOT NULL | - |
| content | text | NOT NULL | - |
| excerpt | text | nullable | - |
| coverImage | text | nullable | - |
| published | boolean | NOT NULL | false |
| publishedAt | timestamp | nullable | - |
| authorId | text | NOT NULL, FK→user.id | - |
| createdAt | timestamp | NOT NULL | now() |
| updatedAt | timestamp | NOT NULL | now() |

### 8.3 인덱스

| 인덱스 | 테이블 | 컬럼 | 타입 |
|--------|--------|------|------|
| post_slug_idx | post | slug | unique |
| post_published_publishedAt_idx | post | published, publishedAt | 일반 |
| account_provider_providerAccountId_key | account | provider, providerAccountId | unique |
| verificationToken_identifier_token_key | verificationToken | identifier, token | unique |
