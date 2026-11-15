// 테마를 JS 로 바꾸므로(.dark 클래스) theme-color 도 따라 바꾼다. 값은 맨 위 sticky 바(data-topbar)의 실제 배경색.
// iOS 홈 화면 앱의 상태 표시줄은 그 바의 배경색으로 칠해지고, 브라우저의 주소창 색은 theme-color 를 따른다.
// Tailwind v4 색은 oklch 로 계산되므로 #rrggbb 로 바꿔 넣는다.
function toHex(color: string): string {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const ctx = c.getContext('2d');
  if (!ctx) return color;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const rgb = Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function syncThemeColor() {
  const bar = document.querySelector<HTMLElement>('[data-topbar]');
  const color = bar
    ? toHex(getComputedStyle(bar).backgroundColor)
    : document.documentElement.classList.contains('dark')
      ? '#030712'
      : '#ffffff';
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color));
}
