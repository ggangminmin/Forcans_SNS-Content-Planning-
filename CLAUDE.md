# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 참고할 가이드를 제공합니다.

## 언어 설정
**중요**: Claude는 이 프로젝트에서 모든 답변과 커뮤니케이션을 한국어로 해야 합니다.

## 프로젝트 개요

**기획자와 AI의 협업을 통한 목업 개발**을 위해 설계된 Next.js 14 프로젝트입니다. 하드코딩된 데이터와 최소한의 복잡성으로 빠른 프로토타이핑을 위한 단순하고 직관적인 패턴에 중점을 둡니다.

## 개발 명령어

```bash
# 개발 서버 시작
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 시작
npm start

# 린팅 실행
npm run lint
```

개발 서버는 http://localhost:3000 에서 실행됩니다.

## 아키텍처 및 핵심 패턴

### 기술 스택
- **Core**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **UI 컴포넌트**: Radix UI 기반 커스텀 컴포넌트 (shadcn/ui 아님)
- **아이콘**: Lucide React
- **폰트**: Pretendard (한국어 타이포그래피)
- **상태관리**: useState (로컬), Zustand (전역 상태 필요시)
- **폼**: React Hook Form + Zod 검증
- **데이터 관리**: 직접 더미데이터 활용 (목업 개발 최적화)
- **알림**: React Toastify
- **날짜 처리**: date-fns
- **스타일링 유틸리티**: clsx, tailwind-merge, class-variance-authority

### 레이아웃 구조
- **헤더 전용 레이아웃**: 사이드바 없이 중앙 정렬된 네비게이션을 가진 간단한 헤더
- **전체 높이 페이지**: `min-h-[calc(100vh-65px)]`를 사용하여 적절한 높이 계산
- **헤더 컴포넌트**: `src/components/layout/header.tsx`에 위치

### 컴포넌트 시스템
- **커스텀 UI 컴포넌트**: `src/components/ui/`에 위치
- **Radix UI 기반**: 접근성을 위한 Radix 프리미티브 사용
- **스타일링**: 조건부 클래스를 위한 `cn()` 유틸리티와 Tailwind CSS
- **임포트 패턴**: `import { Button } from '@/components/ui/button'`

### 데이터 및 상태 패턴
- **하드코딩된 데이터**: 즉각적인 시각적 피드백을 위한 더미 데이터 배열 사용
- **로컬 상태**: 컴포넌트 레벨 상태를 위한 useState
- **전역 상태**: 컴포넌트 간 상태 공유가 필요할 때 Zustand 사용
- **복잡한 API 호출 없음**: 목업을 위한 로딩 상태, 에러 처리 지양

### 폴더 구조
```
src/
├── app/                    # Next.js App Router 페이지들
├── components/
│   ├── ui/                # Radix UI 기반 커스텀 컴포넌트
│   └── layout/            # 레이아웃 컴포넌트 (header)
├── lib/                   # 유틸리티 (cn 함수가 있는 utils.ts)
├── store/                 # Zustand 스토어 (전역 상태 필요시)
├── types/                 # TypeScript 타입 정의
└── hooks/                 # 커스텀 훅
```

## 중요한 가이드라인

### 서브에이전트 활용 (필수)
**중요**: 이 프로젝트에서는 모든 개발 작업을 서브에이전트를 통해 수행해야 합니다. 직접 구현하지 마시고 반드시 아래 서브에이전트를 활용하세요.

#### 사용 가능한 서브에이전트 목록
- **base-ui-component-architect**: UI 컴포넌트, 폼 시스템 및 스타일링 구현
  - 재사용 가능한 Radix UI 기반 컴포넌트 구축
  - React Hook Form + Zod 검증을 포함한 완전한 폼 시스템
  - TypeScript와 Tailwind CSS를 활용한 타입 안전한 구현
  - 시각적 완성도 높은 디자인과 스타일링 적용

- **base-app-router-architect**: Next.js 14 App Router 페이지와 라우팅 구현
  - 새로운 페이지 생성 및 레이아웃 설정
  - API 라우트 구현 및 라우트 그룹 구성
  - 미들웨어 설정 작업

- **basic-auth-architect**: 인증 시스템 구현 (Mock 데이터 활용)
  - NextAuth.js 기반 인증 및 세션 관리
  - 역할 기반 접근 제어
  - Mock 데이터를 활용한 개발 환경 인증 시스템

- **basic-data-integrator**: 데이터 관리 및 상태 관리 시스템 구현
  - 직접 더미데이터 활용으로 즉각적인 결과 확인
  - useState 및 Zustand를 통한 효율적인 상태 관리
  - TypeScript 타입 안전성을 보장하는 데이터 구조 설계

- **base-state-validator**: 상태 관리 코드 검증 및 최적화
  - 상태 관리 패턴의 적절성 평가
  - 성능 이슈 진단 및 리팩터링 전 구조 검증

- **base-code-quality-validator**: 코드 품질 검증 및 프로젝트 규칙 준수
  - 일관성 문제, 성능 문제, 기존 패턴 준수 여부 검토

#### 서브에이전트 활용 원칙
1. **모든 작업은 서브에이전트를 통해 수행**: 복잡성과 관계없이 서브에이전트 활용 필수
2. **적절한 서브에이전트 선택**: 작업 특성에 맞는 전문 서브에이전트 사용
3. **처음부터 끝까지 구현**: 서브에이전트가 전체 기능을 완성도 있게 구현
4. **구현 완료 후 반드시 빌드 검증**: 서브에이전트가 구현을 완료한 후에는 반드시 `npm run build`를 실행하여 빌드 오류가 없는지 확인해야 합니다. `npm run build`로 프로덕션 빌드를 테스트하여 TypeScript 오류, ESLint 오류, 컴파일 오류 등을 사전에 발견하고 해결해야 합니다.


### 사용해야 할 것
- ✅ 즉각적인 결과를 위한 하드코딩된 더미 데이터
- ✅ 간단한 로컬 상태를 위한 useState
- ✅ 전역 상태를 위한 Zustand (꼭 필요한 경우만)
- ✅ `src/components/ui/`의 Radix UI 기반 커스텀 컴포넌트
- ✅ 스타일링을 위한 Tailwind CSS
- ✅ 폼을 위한 React Hook Form + Zod

### 사용하지 말아야 할 것
- ❌ 복잡한 API 호출이나 데이터 페칭
- ❌ Context API (대신 Zustand 사용)
- ❌ shadcn/ui (우리는 커스텀 Radix UI 컴포넌트 사용)
- ❌ 과도한 컴포넌트 엔지니어링
- ❌ 특별히 필요하지 않은 로딩/에러 상태

### 폰트 사용
프로젝트는 Pretendard 폰트를 사용합니다. 폰트 파일은 `public/fonts/`에 있으며 `globals.css`에서 `@font-face`로 로드됩니다.

## 개발 참고사항

### 서브에이전트 우선 개발 방식
- **모든 작업은 서브에이전트 활용**: 직접 구현 대신 적절한 서브에이전트를 선택하여 작업
- **기능별 전문 서브에이전트 활용**: UI는 `base-ui-component-architect`, 페이지는 `base-app-router-architect` 등
- **완성도 높은 구현**: 서브에이전트가 전체 기능을 처음부터 끝까지 완성