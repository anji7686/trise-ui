import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProviderSetupWorkbook } from './provider-setup-workbook';

describe('provider setup workbook', () => {
  it('guides admins through download, secure return, validation, and separate documents', () => {
    const markup = renderToStaticMarkup(<ProviderSetupWorkbook providerId="provider-1" operationCode="ELEVATOR_SERVICES" revision={3} canManage onImported={() => undefined} />);
    expect(markup).toContain('Download or email the workbook');
    expect(markup).toContain('Email blank workbook to an active provider contact');
    expect(markup).toContain('Validate workbook');
    expect(markup).toContain('Do not email completed workbooks or identity documents.');
    expect(markup).toContain('Documents and logo are separate uploads.');
    expect(markup).toContain('Workflow TODO list');
    expect(markup).toContain('Upload the operation’s required and applicable conditional documents');
    expect(markup).toContain('5 MiB');
    expect(markup).toContain('elevator service coverage and published configuration master selections');
  });

  it('keeps mutations and email controls unavailable to read-only users', () => {
    const markup = renderToStaticMarkup(<ProviderSetupWorkbook providerId="provider-1" operationCode="ELEVATOR_SERVICES" revision={3} canManage={false} onImported={() => undefined} />);
    expect(markup).toContain('Provider administrator access required');
    expect(markup).not.toContain('Email blank workbook to an active provider contact');
    expect(markup).toContain('disabled=""');
  });

  it('supports platform initiated sharing by contact or email and platform side uploads', () => {
    const markup = renderToStaticMarkup(<ProviderSetupWorkbook providerId="provider-1" operationCode="ELEVATOR_SERVICES" revision={3} canManage platformMode platformContacts={[]} onImported={() => undefined} />);
    expect(markup).toContain('Share workbook with a provider contact or email address');
    expect(markup).toContain('Enter email address');
    expect(markup).toContain('Email workbook and link');
    expect(markup).toContain('Upload the provider’s returned workbook here');
    expect(markup).toContain('Save the selected Business Operation before downloading, emailing, validating or importing a workbook.');
    expect(markup).toContain('Download workbook</button>');
  });

  it('directs platform admins to assign an active primary Business Operation first', () => {
    const markup = renderToStaticMarkup(<ProviderSetupWorkbook providerId="provider-1" operationCode="" revision={3} canManage canDownload platformMode onConfigureOperation={() => undefined} onImported={() => undefined} />);
    expect(markup).toContain('Active primary Business Operation required');
    expect(markup).toContain('Select an active primary Business Operation here before downloading, emailing, validating, or importing');
    expect(markup).toContain('Open Business Operations');
    expect(markup).not.toContain('Choose completed workbook');
  });
});
