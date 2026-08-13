import { track } from './analytics';

type MetricName = 'lcp' | 'cls' | 'inp';

function routeClass(pathname: string) {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/search')) return 'search';
  if (pathname.startsWith('/explore') || pathname.startsWith('/timeline')) return 'explore';
  if (pathname.startsWith('/episodes') || pathname.startsWith('/streams')) return 'feed';
  if (pathname.startsWith('/topics/')) return 'topic';
  if (pathname.startsWith('/v/')) return 'episode';
  if (pathname.startsWith('/saved')) return 'saved';
  if (pathname.startsWith('/account')) return 'account';
  if (pathname.startsWith('/admin')) return 'admin';
  return 'other';
}

function report(metric: MetricName, value: number) {
  const width = window.innerWidth;
  track({
    type: 'web_vital',
    payload: {
      metric,
      value: Math.round(value * (metric === 'cls' ? 1000 : 1)) / (metric === 'cls' ? 1000 : 1),
      route_class: routeClass(window.location.pathname),
      viewport_class: width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop',
      build_version: String(import.meta.env.VITE_BUILD_VERSION || 'development').slice(0, 64),
    },
  });
}

export function registerWebVitals() {
  if (typeof PerformanceObserver === 'undefined') return;
  const supported = PerformanceObserver.supportedEntryTypes ?? [];
  let lcp = 0;
  let cls = 0;
  let inp = 0;
  let reported = false;

  if (supported.includes('largest-contentful-paint')) {
    new PerformanceObserver((list) => {
      lcp = list.getEntries().at(-1)?.startTime ?? lcp;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  }
  if (supported.includes('layout-shift')) {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & { value: number; hadRecentInput: boolean }
      >) {
        if (!entry.hadRecentInput) cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  }
  if (supported.includes('event')) {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & { duration: number; interactionId?: number }
      >) {
        if (entry.interactionId && entry.duration > inp) inp = entry.duration;
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
  }

  const flush = () => {
    if (reported) return;
    reported = true;
    if (lcp) report('lcp', lcp);
    report('cls', cls);
    if (inp) report('inp', inp);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush, { once: true });
}
