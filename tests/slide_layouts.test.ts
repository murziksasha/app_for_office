import { describe, it, expect } from 'vitest';
import { createSlideLayout } from '../src/slides/pptxAdapter';

describe('Slide layouts', () => {
  it('creates blank layout with no elements', () => {
    const slide = createSlideLayout('blank', 1);
    expect(slide.elements).toHaveLength(0);
    expect(slide.title).toBe('Slide 1');
  });

  it('creates title layout with title and subtitle', () => {
    const slide = createSlideLayout('title', 1);
    expect(slide.elements).toHaveLength(2);

    const [title, subtitle] = slide.elements;
    expect(title.type).toBe('text');
    expect(title.fontSize).toBe(44);
    expect(title.bold).toBe(true);
    expect(title.align).toBe('center');

    expect(subtitle.type).toBe('text');
    expect(subtitle.fontSize).toBe(24);
    expect(subtitle.align).toBe('center');
    expect(subtitle.color).toBe('#666666');
  });

  it('creates title and content layout with title and body block', () => {
    const slide = createSlideLayout('titleContent', 2);
    expect(slide.elements).toHaveLength(2);

    const [title, content] = slide.elements;
    expect(title.type).toBe('text');
    expect(title.fontSize).toBe(36);
    expect(title.align).toBe('left');

    expect(content.type).toBe('text');
    expect(content.fontSize).toBe(20);
    expect(content.x).toBe(10);
    expect(content.width).toBe(80);
    expect(content.height).toBe(65);
  });

  it('creates two content layout with title and two side-by-side columns', () => {
    const slide = createSlideLayout('twoContent', 3);
    expect(slide.elements).toHaveLength(3);

    const [title, leftCol, rightCol] = slide.elements;
    expect(title.type).toBe('text');
    expect(title.fontSize).toBe(36);

    expect(leftCol.type).toBe('text');
    expect(leftCol.x).toBe(10);
    expect(leftCol.width).toBe(38);
    expect(leftCol.height).toBe(65);

    expect(rightCol.type).toBe('text');
    expect(rightCol.x).toBe(52);
    expect(rightCol.width).toBe(38);
    expect(rightCol.height).toBe(65);
  });
});

