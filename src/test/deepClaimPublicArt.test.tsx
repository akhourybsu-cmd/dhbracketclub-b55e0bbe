import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimClubIcon, DeepClaimCompanyCrest, DeepClaimProjectArt, DeepClaimShowcaseArt } from '@/components/deepClaim/renderer/DeepClaimClubArt';
import { PUBLIC_PROJECT_ART } from '@/components/deepClaim/renderer/clubSprites';
import { DEEP_CLAIM_ART_MANIFEST } from '@/components/deepClaim/renderer/artManifest';
import { SOCIAL_CATALOG } from '@/lib/deepClaim/catalog';
import { DEEP_CLAIM_DISCOVERY_KINDS, DEEP_CLAIM_DISCOVERY_QUALITIES, type DeepClaimPublicSpecimen } from '@/lib/deepClaim/types';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

const geode: DeepClaimPublicSpecimen = { kind: 'banded_geode', name: 'Banded geode', quality: 'fine', detail: 'A layered mineral specimen selected for the club case.' };
const journal: DeepClaimPublicSpecimen = { kind: 'survey_journal', name: 'Survey journal', quality: 'common', detail: 'An original survey journal, kept by its owner.' };
const cluster: DeepClaimPublicSpecimen = { kind: 'crystal_cluster', name: 'Crystal cluster', quality: 'exceptional', detail: 'A branching cluster from the company collection.' };

describe('Deep Claim original public club artwork', () => {
  it('names the four club screens with distinct local pixel geometry and supports decorative use', () => {
    const kinds = ['club', 'project', 'standings', 'showcase'] as const;
    const { container } = render(<>{kinds.map(kind => <DeepClaimClubIcon key={kind} kind={kind} />)}<DeepClaimClubIcon kind="club" decorative /></>);
    expect(screen.getAllByRole('img')).toHaveLength(4);
    expect(screen.getByRole('img', { name: 'Club operations' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Company standings' })).toBeInTheDocument();
    expect(new Set([...container.querySelectorAll('[role="img"]')].map(svg => svg.innerHTML)).size).toBe(4);
    expect(container.querySelector('[aria-hidden="true"]')).not.toHaveAttribute('aria-label');
    expect(container.querySelector('image,img,animate,animateTransform')).toBeNull();
  });

  it('covers the six canonical authored club projects with distinct bounded art and the correct names', () => {
    expect(Object.keys(PUBLIC_PROJECT_ART).sort()).toEqual(SOCIAL_CATALOG.projects.map(item => item.key).sort());
    const { container } = render(<>{SOCIAL_CATALOG.projects.map(project => <DeepClaimProjectArt key={project.key} projectKey={project.key} status="locked" />)}</>);
    const blueprints = [...container.querySelectorAll('[data-dc-project-blueprint]')];
    expect(new Set(blueprints.map(blueprint => blueprint.innerHTML)).size).toBe(6);
    for (const project of SOCIAL_CATALOG.projects) {
      expect(screen.getByRole('img', { name: `${project.name}, locked` })).toBeInTheDocument();
      expect(DEEP_CLAIM_ART_MANIFEST.projects).toContain(project.key);
    }
    for (const art of Object.values(PUBLIC_PROJECT_ART)) for (const [, x, y, width, height] of art.blocks) {
      expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(96); expect(y + height).toBeLessThanOrEqual(69);
    }
  });

  it('reflects only committed progress and an explicit completed status, with no time-based completion', () => {
    vi.useFakeTimers();
    const root = render(<DeepClaimProjectArt projectKey="camp_supply" status="open" progress={.25} />);
    expect(screen.getByRole('img', { name: 'Camp Supply, open, 25% contributed' })).toHaveAttribute('data-dc-project-progress', '0.25');
    act(() => { vi.advanceTimersByTime(3_600_000); });
    expect(screen.getByRole('img')).toHaveAttribute('data-dc-project-status', 'open');
    root.rerender(<DeepClaimProjectArt projectKey="camp_supply" status="open" progress={1} />);
    expect(screen.getByRole('img')).toHaveAttribute('data-dc-project-status', 'open');
    expect(screen.queryByRole('img', { name: /completed/ })).not.toBeInTheDocument();
    root.rerender(<DeepClaimProjectArt projectKey="camp_supply" status="completed" progress={1} />);
    expect(screen.getByRole('img', { name: 'Camp Supply, completed' })).toHaveAttribute('data-dc-project-progress', '1');
  });

  it('keeps a locked project locked and bounds invalid presentation ratios without inventing stock or a claim control', () => {
    const root = render(<DeepClaimProjectArt projectKey="deep_freight" status="locked" progress={1} />);
    expect(root.container.querySelector('[data-dc-project-lock]')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('data-dc-project-progress', '0');
    for (const [progress, expected] of [[-2, 0], [2, 1], [Number.NaN, 0], [Number.POSITIVE_INFINITY, 0]]) {
      root.rerender(<DeepClaimProjectArt projectKey="deep_freight" status="open" progress={progress} />);
      expect(screen.getByRole('img')).toHaveAttribute('data-dc-project-progress', String(expected));
    }
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(root.container.querySelector('image,img')).toBeNull();
  });

  it('uses unique clipping references for repeated project cards so one project cannot mask another', () => {
    const { container } = render(<><DeepClaimProjectArt projectKey="camp_supply" status="open" progress={.2} /><DeepClaimProjectArt projectKey="camp_supply" status="completed" /></>);
    const identifiers = [...container.querySelectorAll('clipPath')].map(clip => clip.id);
    expect(new Set(identifiers).size).toBe(2);
    for (const svg of container.querySelectorAll('svg')) {
      const localId = svg.querySelector('clipPath')!.id;
      expect(svg.querySelector('[data-dc-project-built]')).toHaveAttribute('clip-path', `url(#${localId})`);
    }
  });

  it('keeps an unpublished or empty collection visibly empty instead of substituting fake specimens', () => {
    const { container } = render(<DeepClaimShowcaseArt specimens={[]} companyName="Flint & Vale" />);
    const art = screen.getByRole('img', { name: 'Flint & Vale: Empty specimen showcase' });
    expect(art).toHaveAttribute('data-dc-showcase-count', '0');
    expect(container.querySelectorAll('[data-dc-showcase-slot]')).toHaveLength(3);
    expect(container.querySelector('[data-dc-specimen-kind]')).toBeNull();
    expect(art).toHaveAccessibleDescription('No specimens have been published in this case.');
  });

  it('shows only the three explicitly published specimens in order and describes their actual quality and details', () => {
    const extra: DeepClaimPublicSpecimen = { kind: 'meteorite_fragment', name: 'Unpublished extra', quality: 'flawless', detail: 'This must not appear in the case.' };
    const specimens = [geode, journal, cluster, extra], before = JSON.stringify(specimens);
    const { container } = render(<DeepClaimShowcaseArt specimens={specimens} companyName="Flint & Vale" />);
    const art = screen.getByRole('img', { name: 'Flint & Vale: 3 featured specimens' });
    expect([...container.querySelectorAll('[data-dc-specimen-kind]')].map(item => item.getAttribute('data-dc-specimen-kind'))).toEqual(['banded_geode', 'survey_journal', 'crystal_cluster']);
    expect(art).toHaveAccessibleDescription(`Fine ${geode.name}. ${geode.detail} Common ${journal.name}. ${journal.detail} Exceptional ${cluster.name}. ${cluster.detail}`);
    expect(container.textContent).not.toContain(extra.name);
    expect(JSON.stringify(specimens)).toBe(before);
  });

  it('supports every public specimen kind and quality without relying on color alone', () => {
    const root = render(<DeepClaimShowcaseArt specimens={[geode]} />);
    for (const kind of DEEP_CLAIM_DISCOVERY_KINDS) for (const quality of DEEP_CLAIM_DISCOVERY_QUALITIES) {
      root.rerender(<DeepClaimShowcaseArt specimens={[{ kind, quality, name: kind.replace(/_/g, ' '), detail: 'Explicitly published specimen.' }]} />);
      expect(root.container.querySelector('[data-dc-specimen-kind]')).toHaveAttribute('data-dc-specimen-quality', quality);
      expect(root.container.querySelectorAll('[data-dc-showcase-slot="0"] [data-dc-quality-mark]')).toHaveLength(DEEP_CLAIM_DISCOVERY_QUALITIES.indexOf(quality) + 1);
      expect(screen.getByRole('img')).toHaveAccessibleDescription(new RegExp(quality, 'i'));
    }
  });

  it('never spreads extra private fields, mounts a mine canvas, or fetches external artwork', () => {
    const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    const specimen = { ...geode, x: 41, y: 512, job_id: 'private-job', company_id: 'private-company', sale_value: 12345, salvage: { gold_ore: 99 }, seed: 'private-seed' };
    const { container } = render(<><DeepClaimShowcaseArt specimens={[specimen]} /><DeepClaimProjectArt projectKey="assay_observatory" status="open" progress={.1} /><DeepClaimCompanyCrest userId="public-owner-id" companyName="Published name" /></>);
    expect(context).not.toHaveBeenCalled();
    expect(container.querySelector('canvas,image,img,iframe,script')).toBeNull();
    for (const secret of ['private-job', 'private-company', '12345', 'private-seed', 'gold_ore']) expect(container.innerHTML).not.toContain(secret);
    expect(container.querySelector('[href],[xlink\\:href]')).toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps public company identity stable across renders without implying any earned rank', () => {
    const root = render(<DeepClaimCompanyCrest userId="public-owner-one" companyName="Flint & Vale" />);
    const variant = screen.getByRole('img', { name: 'Flint & Vale identity' }).getAttribute('data-dc-company-crest');
    expect(root.container.querySelector('text')).toHaveTextContent('FV');
    root.rerender(<DeepClaimCompanyCrest userId="public-owner-one" companyName="Renamed Company" />);
    expect(screen.getByRole('img', { name: 'Renamed Company identity' })).toHaveAttribute('data-dc-company-crest', variant);
    expect(root.container.querySelector('text')).toHaveTextContent('RC');
    expect(root.container.textContent).not.toMatch(/rank|winner|award|trophy/i);
    root.rerender(<DeepClaimCompanyCrest userId="public-owner-one" companyName="Renamed Company" decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(root.container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
