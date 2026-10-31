import type { JSONContent } from '@tiptap/core';
import type { Sheet } from '@fortune-sheet/core';
import type { PresentationModel } from '../types';
import type { SupportedDocumentKind } from '../types';
import { t } from '../i18n/instance';

export interface TemplateDefinition {
  id: string;
  kind: SupportedDocumentKind;
  titleKey: string;
  descriptionKey: string;
  getContent: () => unknown;
}

export function createReportDocContent(): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Project Status Report' }],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Executive Summary' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'This report outlines core progress, strategic goals, and recent deliverable milestones.',
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Action Items' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Owner' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Status' }] }] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Security review' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Team A' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Complete' }] }] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Performance audit' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Team B' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'In Progress' }] }] },
            ],
          },
        ],
      },
    ],
  };
}

export function createResumeDocContent(): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Alex Johnson' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'alex.johnson@example.com | (555) 019-2834 | Chornomorsk, UA' }],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Professional Experience' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Senior Software Engineer' },
          { type: 'text', text: ' — TechCorp (2022–Present)' },
        ],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Architected local-first enterprise office applications.' }],
              },
            ],
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Streamlined memory usage and performance by 40%.' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Education' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'B.S. in Computer Science — State University (2018–2022)' }],
      },
    ],
  };
}

export function createBudgetSheetData(): Sheet[] {
  return [
    {
      id: 'sheet-budget-1',
      name: 'Monthly Budget',
      status: 1,
      order: 0,
      row: 20,
      column: 10,
      data: [
        [
          { v: 'Category', m: 'Category', bl: 1, bg: '#f1f5f9' },
          { v: 'Planned ($)', m: 'Planned ($)', bl: 1, bg: '#f1f5f9' },
          { v: 'Actual ($)', m: 'Actual ($)', bl: 1, bg: '#f1f5f9' },
          { v: 'Difference ($)', m: 'Difference ($)', bl: 1, bg: '#f1f5f9' },
        ],
        [
          { v: 'Housing', m: 'Housing' },
          { v: 1200, m: '1200', ct: { fa: 'General', t: 'n' } },
          { v: 1200, m: '1200', ct: { fa: 'General', t: 'n' } },
          { v: 0, m: '0', f: '=B2-C2', ct: { fa: 'General', t: 'n' } },
        ],
        [
          { v: 'Utilities', m: 'Utilities' },
          { v: 250, m: '250', ct: { fa: 'General', t: 'n' } },
          { v: 230, m: '230', ct: { fa: 'General', t: 'n' } },
          { v: 20, m: '20', f: '=B3-C3', ct: { fa: 'General', t: 'n' } },
        ],
        [
          { v: 'Groceries', m: 'Groceries' },
          { v: 600, m: '600', ct: { fa: 'General', t: 'n' } },
          { v: 640, m: '640', ct: { fa: 'General', t: 'n' } },
          { v: -40, m: '-40', f: '=B4-C4', ct: { fa: 'General', t: 'n' } },
        ],
        [
          { v: 'Transportation', m: 'Transportation' },
          { v: 180, m: '180', ct: { fa: 'General', t: 'n' } },
          { v: 160, m: '160', ct: { fa: 'General', t: 'n' } },
          { v: 20, m: '20', f: '=B5-C5', ct: { fa: 'General', t: 'n' } },
        ],
      ],
    },
  ];
}

export function createInvoiceSheetData(): Sheet[] {
  return [
    {
      id: 'sheet-invoice-1',
      name: 'Invoice',
      status: 1,
      order: 0,
      row: 20,
      column: 10,
      data: [
        [
          { v: 'COMMERCIAL INVOICE', m: 'COMMERCIAL INVOICE', bl: 1, fs: 14 },
          null,
          null,
          null,
        ],
        [
          { v: 'Invoice No: INV-2026-001', m: 'Invoice No: INV-2026-001' },
          null,
          { v: 'Date: 2026-10-31', m: 'Date: 2026-10-31' },
          null,
        ],
        [],
        [
          { v: 'Description', m: 'Description', bl: 1, bg: '#e2e8f0' },
          { v: 'Quantity', m: 'Quantity', bl: 1, bg: '#e2e8f0' },
          { v: 'Unit Price ($)', m: 'Unit Price ($)', bl: 1, bg: '#e2e8f0' },
          { v: 'Total ($)', m: 'Total ($)', bl: 1, bg: '#e2e8f0' },
        ],
        [
          { v: 'Software Engineering Services', m: 'Software Engineering Services' },
          { v: 40, m: '40', ct: { fa: 'General', t: 'n' } },
          { v: 75, m: '75', ct: { fa: 'General', t: 'n' } },
          { v: 3000, m: '3000', f: '=B5*C5', ct: { fa: 'General', t: 'n' } },
        ],
        [
          { v: 'System Architecture Consultation', m: 'System Architecture Consultation' },
          { v: 10, m: '10', ct: { fa: 'General', t: 'n' } },
          { v: 120, m: '120', ct: { fa: 'General', t: 'n' } },
          { v: 1200, m: '1200', f: '=B6*C6', ct: { fa: 'General', t: 'n' } },
        ],
      ],
    },
  ];
}

export function createPitchPresentationData(): PresentationModel {
  return {
    title: 'Pitch Deck',
    slideSize: '16:9',
    slides: [
      {
        id: 'pitch-s1',
        title: 'Title Slide',
        background: '#ffffff',
        elements: [
          {
            id: 'p1-title',
            type: 'text',
            text: 'Project Folio',
            fontSize: 44,
            bold: true,
            color: '#0f766e',
            x: 10,
            y: 30,
            width: 80,
            height: 18,
            align: 'center',
          },
          {
            id: 'p1-sub',
            type: 'text',
            text: 'Private, Local-First Office Suite',
            fontSize: 22,
            color: '#475569',
            x: 15,
            y: 52,
            width: 70,
            height: 14,
            align: 'center',
          },
        ],
      },
      {
        id: 'pitch-s2',
        title: 'Problem & Solution',
        background: '#ffffff',
        elements: [
          {
            id: 'p2-title',
            type: 'text',
            text: 'The Problem & Our Solution',
            fontSize: 32,
            bold: true,
            color: '#0f172a',
            x: 8,
            y: 10,
            width: 84,
            height: 14,
          },
          {
            id: 'p2-c1',
            type: 'text',
            text: 'Problem: Cloud vendor lock-in, data sovereignty concerns, and sluggish online-only editors.',
            fontSize: 18,
            color: '#334155',
            x: 8,
            y: 32,
            width: 40,
            height: 48,
          },
          {
            id: 'p2-c2',
            type: 'text',
            text: 'Solution: Native desktop performance, 100% on-device document privacy, and open standards.',
            fontSize: 18,
            color: '#0f766e',
            x: 52,
            y: 32,
            width: 40,
            height: 48,
          },
        ],
      },
      {
        id: 'pitch-s3',
        title: 'Market Opportunity',
        background: '#ffffff',
        elements: [
          {
            id: 'p3-title',
            type: 'text',
            text: 'Market Opportunity',
            fontSize: 32,
            bold: true,
            color: '#0f172a',
            x: 8,
            y: 10,
            width: 84,
            height: 14,
          },
          {
            id: 'p3-c1',
            type: 'text',
            text: 'Over 1 billion knowledge workers require dependable offline productivity software that respects user privacy.',
            fontSize: 18,
            color: '#334155',
            x: 8,
            y: 32,
            width: 84,
            height: 40,
          },
        ],
      },
    ],
  };
}

export function createReviewPresentationData(): PresentationModel {
  return {
    title: 'Business Review',
    slideSize: '16:9',
    slides: [
      {
        id: 'rev-s1',
        title: 'Title Slide',
        background: '#ffffff',
        elements: [
          {
            id: 'r1-title',
            type: 'text',
            text: 'Quarterly Business Review',
            fontSize: 42,
            bold: true,
            color: '#1e293b',
            x: 10,
            y: 32,
            width: 80,
            height: 18,
            align: 'center',
          },
          {
            id: 'r1-sub',
            type: 'text',
            text: 'Performance Metrics & Strategic Roadmap',
            fontSize: 20,
            color: '#64748b',
            x: 15,
            y: 54,
            width: 70,
            height: 14,
            align: 'center',
          },
        ],
      },
      {
        id: 'rev-s2',
        title: 'Highlights',
        background: '#ffffff',
        elements: [
          {
            id: 'r2-title',
            type: 'text',
            text: 'Key Performance Highlights',
            fontSize: 32,
            bold: true,
            color: '#0f172a',
            x: 8,
            y: 10,
            width: 84,
            height: 14,
          },
          {
            id: 'r2-c1',
            type: 'text',
            text: '• Reached 100% test coverage on local office formats\n• 40% reduction in memory overhead\n• Zero third-party telemetry',
            fontSize: 18,
            color: '#334155',
            x: 8,
            y: 32,
            width: 84,
            height: 48,
          },
        ],
      },
      {
        id: 'rev-s3',
        title: 'Roadmap',
        background: '#ffffff',
        elements: [
          {
            id: 'r3-title',
            type: 'text',
            text: 'Strategic Next Steps',
            fontSize: 32,
            bold: true,
            color: '#0f172a',
            x: 8,
            y: 10,
            width: 84,
            height: 14,
          },
          {
            id: 'r3-c1',
            type: 'text',
            text: 'Expanding document intelligence, responsive templates, and keyboard navigation shortcuts.',
            fontSize: 18,
            color: '#334155',
            x: 8,
            y: 32,
            width: 84,
            height: 40,
          },
        ],
      },
    ],
  };
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'doc-report',
    kind: 'document',
    titleKey: 'templates.reportDocTitle',
    descriptionKey: 'templates.reportDocDesc',
    getContent: createReportDocContent,
  },
  {
    id: 'doc-resume',
    kind: 'document',
    titleKey: 'templates.resumeDocTitle',
    descriptionKey: 'templates.resumeDocDesc',
    getContent: createResumeDocContent,
  },
  {
    id: 'sheet-budget',
    kind: 'spreadsheet',
    titleKey: 'templates.budgetSheetTitle',
    descriptionKey: 'templates.budgetSheetDesc',
    getContent: createBudgetSheetData,
  },
  {
    id: 'sheet-invoice',
    kind: 'spreadsheet',
    titleKey: 'templates.invoiceSheetTitle',
    descriptionKey: 'templates.invoiceSheetDesc',
    getContent: createInvoiceSheetData,
  },
  {
    id: 'pres-pitch',
    kind: 'presentation',
    titleKey: 'templates.pitchPresTitle',
    descriptionKey: 'templates.pitchPresDesc',
    getContent: createPitchPresentationData,
  },
  {
    id: 'pres-report',
    kind: 'presentation',
    titleKey: 'templates.reviewPresTitle',
    descriptionKey: 'templates.reviewPresDesc',
    getContent: createReviewPresentationData,
  },
];

export function getTemplateById(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByKind(kind: SupportedDocumentKind): TemplateDefinition[] {
  return TEMPLATES.filter((t) => t.kind === kind);
}

export function getLocalizedTemplates(): Array<{
  id: string;
  kind: SupportedDocumentKind;
  title: string;
  description: string;
}> {
  return TEMPLATES.map((tmpl) => ({
    id: tmpl.id,
    kind: tmpl.kind,
    title: t(tmpl.titleKey),
    description: t(tmpl.descriptionKey),
  }));
}

