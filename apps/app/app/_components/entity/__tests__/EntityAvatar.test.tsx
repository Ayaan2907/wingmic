// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render } from '@testing-library/react';

afterEach(() => cleanup());
import {
  EntityAvatar,
  PersonAvatar,
  CompanyTile,
  EventDiamond,
  TopicGlyph,
  PinTile,
} from '../EntityAvatar';

describe('EntityAvatar primitives', () => {
  describe('PersonAvatar', () => {
    it('renders with kind=person and default 72px', () => {
      const { getByTestId } = render(<PersonAvatar name="priya" />);
      const el = getByTestId('entity-person');
      expect(el.getAttribute('data-entity-kind')).toBe('person');
      expect(el.style.width).toBe('72px');
      expect(el.style.height).toBe('72px');
      expect(el.textContent).toBe('p');
    });

    it('lowercases the initial', () => {
      const { getByTestId } = render(<PersonAvatar name="Priya Sharma" />);
      expect(getByTestId('entity-person').textContent).toBe('p');
    });

    it('respects accent prop override', () => {
      const { getByTestId } = render(
        <PersonAvatar name="sarah" accent="violet" />,
      );
      const el = getByTestId('entity-person');
      // violet token is #a78bfa = rgb(167, 139, 250) (jsdom normalizes)
      expect(el.style.background).toBe('rgb(167, 139, 250)');
    });

    it('picks accent deterministically from seed', () => {
      const r1 = render(<PersonAvatar name="x" seed="alpha" />);
      const a = r1.getByTestId('entity-person').style.background;
      r1.unmount();
      const r2 = render(<PersonAvatar name="x" seed="alpha" />);
      const b = r2.getByTestId('entity-person').style.background;
      r2.unmount();
      expect(a).toBe(b);
    });

    it('honors custom size', () => {
      const { getByTestId } = render(<PersonAvatar name="x" size={36} />);
      expect(getByTestId('entity-person').style.width).toBe('36px');
    });
  });

  describe('CompanyTile', () => {
    it('renders with kind=company, default 64px, uppercase initial', () => {
      const { getByTestId } = render(<CompanyTile name="cloudflare" />);
      const el = getByTestId('entity-company');
      expect(el.getAttribute('data-entity-kind')).toBe('company');
      expect(el.style.width).toBe('64px');
      expect(el.textContent).toBe('C');
    });

    it('passes domain through as data attr', () => {
      const { getByTestId } = render(
        <CompanyTile name="acme" domain="acme.com" />,
      );
      expect(getByTestId('entity-company').getAttribute('data-domain')).toBe(
        'acme.com',
      );
    });

    it('defaults to blue accent fill (#7dd3fc)', () => {
      const { getByTestId } = render(<CompanyTile name="acme" />);
      // #7dd3fc = rgb(125, 211, 252)
      expect(getByTestId('entity-company').style.background).toBe(
        'rgb(125, 211, 252)',
      );
    });

    it('accepts accent prop override', () => {
      const { getByTestId } = render(
        <CompanyTile name="acme" accent="mint" />,
      );
      // mint = #86efac = rgb(134, 239, 172)
      expect(getByTestId('entity-company').style.background).toBe(
        'rgb(134, 239, 172)',
      );
    });
  });

  describe('EventDiamond', () => {
    it('renders with kind=event and default 64px', () => {
      const { getByTestId } = render(<EventDiamond name="devconnect" />);
      const el = getByTestId('entity-event');
      expect(el.getAttribute('data-entity-kind')).toBe('event');
      expect(el.style.width).toBe('64px');
      expect(el.textContent).toBe('d');
    });
  });

  describe('TopicGlyph', () => {
    it('renders with kind=topic and default 24px lozenge', () => {
      const { getByTestId } = render(<TopicGlyph name="edge config" />);
      const el = getByTestId('entity-topic');
      expect(el.getAttribute('data-entity-kind')).toBe('topic');
      expect(el.style.width).toBe('24px');
      expect(el.getAttribute('data-topic-name')).toBe('edge config');
    });
  });

  describe('PinTile', () => {
    it('renders with kind=pin and default 32px', () => {
      const { getByTestId } = render(<PinTile />);
      const el = getByTestId('entity-pin');
      expect(el.getAttribute('data-entity-kind')).toBe('pin');
      expect(el.style.width).toBe('32px');
    });
  });

  describe('brutal-chrome border + shadow guards', () => {
    // jsdom normalizes #000 → rgb(0,0,0) in border; we check width+style are set.
    it('PersonAvatar has 1.5px solid border and 3px shadow', () => {
      const { getByTestId } = render(<PersonAvatar name="test" />);
      const el = getByTestId('entity-person');
      expect(el.style.border).toContain('1.5px solid');
      expect(el.style.boxShadow).toContain('3px 3px 0');
    });

    it('CompanyTile has 1.5px solid border and 3px shadow', () => {
      const { getByTestId } = render(<CompanyTile name="test" />);
      const el = getByTestId('entity-company');
      expect(el.style.border).toContain('1.5px solid');
      expect(el.style.boxShadow).toContain('3px 3px 0');
    });

    it('EventDiamond inner shape has 1.5px solid border and 3px shadow', () => {
      const { getByTestId } = render(<EventDiamond name="test" />);
      const outer = getByTestId('entity-event');
      // inner diamond is the first child div
      const inner = outer.querySelector('div') as HTMLElement;
      expect(inner.style.border).toContain('1.5px solid');
      expect(inner.style.boxShadow).toContain('3px 3px 0');
    });

    it('PinTile has 1.5px solid border and 3px shadow', () => {
      const { getByTestId } = render(<PinTile />);
      const el = getByTestId('entity-pin');
      expect(el.style.border).toContain('1.5px solid');
      expect(el.style.boxShadow).toContain('3px 3px 0');
    });
  });

  describe('EntityAvatar switch', () => {
    it('delegates to PersonAvatar for kind=person', () => {
      const { getByTestId } = render(
        <EntityAvatar kind="person" name="ayaan" />,
      );
      expect(getByTestId('entity-person')).toBeTruthy();
    });

    it('delegates to CompanyTile for kind=company', () => {
      const { getByTestId } = render(
        <EntityAvatar kind="company" name="acme" />,
      );
      expect(getByTestId('entity-company')).toBeTruthy();
    });

    it('delegates to EventDiamond for kind=event', () => {
      const { getByTestId } = render(
        <EntityAvatar kind="event" name="devconnect" />,
      );
      expect(getByTestId('entity-event')).toBeTruthy();
    });

    it('delegates to TopicGlyph for kind=topic', () => {
      const { getByTestId } = render(
        <EntityAvatar kind="topic" name="rust" />,
      );
      expect(getByTestId('entity-topic')).toBeTruthy();
    });

    it('delegates to PinTile for kind=pin', () => {
      const { getByTestId } = render(<EntityAvatar kind="pin" />);
      expect(getByTestId('entity-pin')).toBeTruthy();
    });
  });
});
