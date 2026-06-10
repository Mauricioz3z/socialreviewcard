import { renderToString } from 'react-dom/server';
import Landing from './Landing';
import { UseCasePage } from './seo/UseCasePage';
import { findUseCase, USE_CASES } from './seo/useCases';

/**
 * Renders a route to static HTML at build time (see prerender.mjs).
 * "/" → marketing landing; "/{slug}" → programmatic-SEO use-case page.
 */
export function render(path: string = '/'): string {
  const useCase = findUseCase(path);
  if (useCase) return renderToString(<UseCasePage def={useCase} />);
  return renderToString(<Landing />);
}

/** Route metadata the prerender script uses to emit one HTML file per page. */
export const seoRoutes = USE_CASES.map((u) => ({
  slug: u.slug,
  title: u.title,
  description: u.description,
}));
