import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TriseBrandHeader } from '@trise/ui';
import { VerificationHeader } from './verification-header';

describe('VerificationHeader', () => {
  it('uses the approved original TRISE logo artwork and secure context', () => {
    const markup = renderToStaticMarkup(<VerificationHeader />);

    expect(markup).toContain('/assets/trise-india-logo-dark-header.svg');
    expect(markup).toContain('alt="TRISE India"');
    expect(markup).toContain('Secure Business Access');
    expect(markup).not.toContain('/assets/trise-logo.png');
  });

  it('supports the approved light-background contrast variant', () => {
    expect(renderToStaticMarkup(<TriseBrandHeader variant="light" />)).toContain('/assets/trise-india-logo-light-header.svg');
  });
});
