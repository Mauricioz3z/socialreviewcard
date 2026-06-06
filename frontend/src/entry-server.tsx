import { renderToString } from 'react-dom/server';
import Landing from './Landing';

/** Renders the marketing landing to static HTML at build time (see prerender.mjs). */
export function render(): string {
  return renderToString(<Landing />);
}
