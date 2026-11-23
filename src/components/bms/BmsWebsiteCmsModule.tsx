import React, { useState, useEffect } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import {
  WebsiteConfigRecord,
  CustomPageRecord,
  ProductItem,
  CategoryItem,
  CakeDesignItem,
  BusinessSettings,
  INITIAL_WEBSITE_CONFIG,
} from '../../data/initialCatalogue';
import {
  Globe,
  Layout,
  FileText,
  Navigation,
  Search,
  Palette,
  Monitor,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Upload,
} from 'lucide-react';

interface WebsiteNavItem {
  label: string;
  labelHi?: string;
  path: string;
  isVisible?: boolean;
}

interface WebsiteSectionEntry {
  key: string;
  label: string;
  visible: boolean;
}

const SECTION_LABELS: Record<string, string> = {
  hero: 'Hero & 3D Cake/Pizza Showcase',
  categories: 'Signature Bakery & Pizza Categories',
  bestsellers: 'Bestsellers & Featured Menu',
  custom_cake: 'Custom Celebration Cake Studio',
  gallery: 'Visual Bakery & Store Gallery',
  story: 'Our Story & Heritage',
  contact: 'Store Location, Google Map & Contact',
};

function parseSectionsSummary(summary?: string): WebsiteSectionEntry[] {
  const defaultOrder = [
    'hero:true',
    'categories:true',
    'bestsellers:true',
    'custom_cake:true',
    'gallery:true',
    'story:true',
    'contact:true',
  ];
  const raw = (summary || defaultOrder.join('|')).split('|').filter(Boolean);
  return raw.map((item) => {
    const [key, vis] = item.split(':');
    return {
      key: key || 'hero',
      label: SECTION_LABELS[key] || key,
      visible: vis !== 'false',
    };
  });
}

function serializeSectionsSummary(entries: WebsiteSectionEntry[]): string {
  return entries.map((e) => `${e.key}:${e.visible ? 'true' : 'false'}`).join('|');
}

interface BmsWebsiteCmsModuleProps {
  subPath: string;
  onNavigate: (path: string) => void;
  websiteConfig: WebsiteConfigRecord;
  customPages: CustomPageRecord[];
  products?: ProductItem[];
  categories?: CategoryItem[];
  cakeDesigns?: CakeDesignItem[];
  settings?: BusinessSettings;
  userEmail: string;
  hasPermission: (perm: string) => boolean;
  recordAuditLog: (
    entityType: string,
    action: string,
    entityId: string,
    summary: string
  ) => Promise<void>;
}

export const BmsWebsiteCmsModule: React.FC<BmsWebsiteCmsModuleProps> = ({
  subPath,
  onNavigate,
  websiteConfig,
  customPages,
  products = [],
  categories = [],
  cakeDesigns = [],
  settings,
  userEmail,
  hasPermission,
  recordAuditLog,
}) => {
  const [localConfig, setLocalConfig] = useState<WebsiteConfigRecord>(
    websiteConfig || INITIAL_WEBSITE_CONFIG
  );
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [uploadingHero, setUploadingHero] = useState(false);

  // Page Editor State
  const [selectedPage, setSelectedPage] = useState<CustomPageRecord | null>(
    customPages[0] || null
  );
  const [isNewPage, setIsNewPage] = useState(false);

  // New Nav Link State
  const [newNavLabel, setNewNavLabel] = useState('');
  const [newNavLabelHi, setNewNavLabelHi] = useState('');
  const [newNavPath, setNewNavPath] = useState('/');

  useEffect(() => {
    if (websiteConfig) {
      setLocalConfig(websiteConfig);
    }
  }, [websiteConfig]);

  useEffect(() => {
    if (!selectedPage && customPages.length > 0 && !isNewPage) {
      setSelectedPage(customPages[0]);
    }
  }, [customPages, selectedPage, isNewPage]);

  const cmsTab =
    subPath === 'website/pages'
      ? 'pages'
      : subPath === 'website/navigation'
      ? 'navigation'
      : subPath === 'website/footer'
      ? 'footer'
      : subPath === 'website/seo'
      ? 'seo'
      : subPath === 'website/theme'
      ? 'theme'
      : 'homepage';

  const parsedSections = parseSectionsSummary(localConfig.sectionsOrderSummary);

  let parsedNavLinks: WebsiteNavItem[] = [];
  try {
    parsedNavLinks = JSON.parse(localConfig.navigationLinksJson || '[]');
  } catch {
    parsedNavLinks = [];
  }

  let parsedFooterLinks: Array<{ label: string; path: string }> = [];
  try {
    parsedFooterLinks = JSON.parse(localConfig.footerLinksJson || '[]');
  } catch {
    parsedFooterLinks = [];
  }

  const updateSections = (next: WebsiteSectionEntry[]) => {
    setLocalConfig((prev) => ({
      ...prev,
      sectionsOrderSummary: serializeSectionsSummary(next),
    }));
  };

  const updateNavLinks = (next: WebsiteNavItem[]) => {
    setLocalConfig((prev) => ({
      ...prev,
      navigationLinksJson: JSON.stringify(next),
    }));
  };

  const updateFooterLinks = (next: Array<{ label: string; path: string }>) => {
    setLocalConfig((prev) => ({
      ...prev,
      footerLinksJson: JSON.stringify(next),
    }));
  };

  const handleHeroImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHero(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setUploadingHero(false);
        return;
      }
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1280;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.86);
        try {
          const path = `cms/hero-${Date.now()}.jpg`;
          const sRef = storageRef(storage, path);
          await uploadString(sRef, compressed, 'data_url');
          const url = await getDownloadURL(sRef);
          setLocalConfig((prev) => ({ ...prev, heroImageUrl: url }));
        } catch {
          setLocalConfig((prev) => ({ ...prev, heroImageUrl: compressed }));
        } finally {
          setUploadingHero(false);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveWebsiteConfig = async (mode: 'draft' | 'published') => {
    if (mode === 'published' && !hasPermission('publish')) return;
    if (mode === 'draft' && !hasPermission('edit')) return;

    const nowIso = new Date().toISOString();
    const updated: WebsiteConfigRecord = {
      id: 'default',
      heroHeading: localConfig.heroHeading || INITIAL_WEBSITE_CONFIG.heroHeading,
      heroHeadingHi: localConfig.heroHeadingHi || '',
      heroSubparagraph: localConfig.heroSubparagraph || '',
      heroImageUrl: localConfig.heroImageUrl || INITIAL_WEBSITE_CONFIG.heroImageUrl,
      primaryCtaText: localConfig.primaryCtaText || 'Order Online from Menu',
      primaryCtaLink: localConfig.primaryCtaLink || '/menu',
      secondaryCtaText: localConfig.secondaryCtaText || 'Custom Cake Studio',
      secondaryCtaLink: localConfig.secondaryCtaLink || '/custom-cake',
      promoBannerTitle: localConfig.promoBannerTitle || '',
      promoBannerSubtitle: localConfig.promoBannerSubtitle || '',
      promoBannerActive: Boolean(localConfig.promoBannerActive),
      sectionsOrderSummary:
        localConfig.sectionsOrderSummary || INITIAL_WEBSITE_CONFIG.sectionsOrderSummary,
      navigationLinksJson:
        localConfig.navigationLinksJson || INITIAL_WEBSITE_CONFIG.navigationLinksJson,
      footerDescription: localConfig.footerDescription || '',
      footerCopyright: localConfig.footerCopyright || '',
      footerLinksJson: localConfig.footerLinksJson || INITIAL_WEBSITE_CONFIG.footerLinksJson,
      seoDefaultTitle: localConfig.seoDefaultTitle || '',
      seoDefaultDescription: localConfig.seoDefaultDescription || '',
      seoKeywords: localConfig.seoKeywords || '',
      ogImageUrl: localConfig.ogImageUrl || localConfig.heroImageUrl || '',
      themePalettePreset: localConfig.themePalettePreset || 'warm-ivory-cocoa-berry',
      themeTypographyPreset: localConfig.themeTypographyPreset || 'cormorant-plus-jakarta',
      themeButtonStyle: localConfig.themeButtonStyle || 'rounded-2xl',
      status: mode,
      updatedByEmail: userEmail,
      updatedAt: nowIso,
    };

    setLocalConfig(updated);

    try {
      await setDoc(doc(db, 'website_config', 'default'), updated);
      await recordAuditLog(
        'website',
        mode === 'published' ? 'WEBSITE_CONFIG_PUBLISHED' : 'WEBSITE_DRAFT_SAVED',
        'website_config/default',
        `${mode === 'published' ? 'Published live' : 'Saved draft'} website configuration (${cmsTab})`
      );
    } catch (err: any) {
      console.warn('Website config save:', err?.message || err);
    }
    setStatusBanner(
      mode === 'published'
        ? 'Published live! All storefront visitors now see your updated website content.'
        : 'Draft saved safely. Click "Publish to Live Website" when ready.'
    );
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const handleSaveCustomPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPage) return;
    const cleanSlug = selectedPage.slug.replace(/^\/+/, '').trim() || 'custom-page';
    const nowIso = new Date().toISOString();
    const pageToSave: CustomPageRecord = {
      id: selectedPage.id,
      slug: cleanSlug,
      title: selectedPage.title.trim(),
      subtitle: selectedPage.subtitle || '',
      content: selectedPage.content || '',
      heroImageUrl: selectedPage.heroImageUrl || '',
      imageAlt: selectedPage.imageAlt || selectedPage.title.trim(),
      seoTitle: selectedPage.seoTitle || selectedPage.title,
      seoDescription: selectedPage.seoDescription || '',
      canonicalUrl: selectedPage.canonicalUrl || '',
      noindex: Boolean(selectedPage.noindex),
      isPublished: Boolean(selectedPage.isPublished),
      updatedByEmail: userEmail,
      updatedAt: nowIso,
    };

    try {
      await setDoc(doc(db, 'custom_pages', pageToSave.id), pageToSave);
      await recordAuditLog(
        'website',
        isNewPage ? 'PAGE_CREATED' : 'PAGE_UPDATED',
        pageToSave.id,
        `Saved page "${pageToSave.title}" (/${pageToSave.slug})`
      );
    } catch (err: any) {
      console.warn('Custom page save:', err?.message || err);
    }
    setIsNewPage(false);
    setSelectedPage(pageToSave);
    setStatusBanner(`Saved page "${pageToSave.title}" (/${pageToSave.slug})!`);
    setTimeout(() => setStatusBanner(null), 3500);
  };

  const handleDeleteCustomPage = async (pg: CustomPageRecord) => {
    try {
      await deleteDoc(doc(db, 'custom_pages', pg.id));
      await recordAuditLog('website', 'PAGE_DELETED', pg.id, `Deleted page ${pg.title}`);
    } catch (err: any) {
      console.warn('Custom page delete:', err?.message || err);
    }
    setSelectedPage(customPages.find((p) => p.id !== pg.id) || null);
  };

  const moveSection = (index: number, dir: -1 | 1) => {
    const next = [...parsedSections];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    updateSections(next);
  };

  const toggleSectionVisibility = (key: string) => {
    const next = parsedSections.map((s) =>
      s.key === key ? { ...s, visible: !s.visible } : s
    );
    updateSections(next);
  };

  const moveNavLink = (index: number, dir: -1 | 1) => {
    const next = [...parsedNavLinks];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    updateNavLinks(next);
  };

  const handleAddNavLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNavLabel.trim() || !newNavPath.trim()) return;
    const item: WebsiteNavItem = {
      label: newNavLabel.trim(),
      labelHi: newNavLabelHi.trim() || newNavLabel.trim(),
      path: newNavPath.trim().startsWith('/') ? newNavPath.trim() : `/${newNavPath.trim()}`,
      isVisible: true,
    };
    updateNavLinks([...parsedNavLinks, item]);
    setNewNavLabel('');
    setNewNavLabelHi('');
    setNewNavPath('/');
  };

  const cmsSubTabs = [
    { id: 'homepage', path: '/admin/website/homepage', label: 'Homepage Visual Editor', icon: Layout },
    { id: 'pages', path: '/admin/website/pages', label: 'Pages & Policies', icon: FileText },
    { id: 'navigation', path: '/admin/website/navigation', label: 'Navigation Bar', icon: Navigation },
    { id: 'footer', path: '/admin/website/footer', label: 'Footer & Copyright', icon: Globe },
    { id: 'seo', path: '/admin/website/seo', label: 'SEO & OpenGraph', icon: Search },
    { id: 'theme', path: '/admin/website/theme', label: 'Theme & Styling', icon: Palette },
  ];

  return (
    <div className="space-y-6">
      {/* CMS Top Header & Draft/Publish Controls */}
      <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-lg bg-[#3B2824] text-[#E5B867] text-[10px] font-bold uppercase tracking-wider">
            Visual Website Content Management System (CMS)
          </span>
          <h2 className="font-serif text-2xl font-bold mt-1">
            Edit Storefront Without Touching Code
          </h2>
          <p className="text-xs text-[#6B544E]">
            Manage homepage hero, section ordering, navigation menus, policy pages, footer, and SEO metadata with Draft &amp; Live Publish controls.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleSaveWebsiteConfig('draft')}
            className="px-4 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] hover:bg-[#F5EBE1] text-xs font-semibold flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            Save as Draft
          </button>
          <button
            type="button"
            onClick={() => handleSaveWebsiteConfig('published')}
            className="px-5 py-2.5 rounded-xl bg-[#2D6A4F] hover:bg-[#23533D] text-white text-xs font-bold flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            Publish to Live Website
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="p-3.5 rounded-2xl bg-[#E8F5E9] border border-[#2D6A4F]/30 text-[#2D6A4F] text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* CMS Sub-navigation Bar */}
      <div className="flex flex-wrap gap-2">
        {cmsSubTabs.map((tab) => {
          const Icon = tab.icon;
          const active = cmsTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.path)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
                active
                  ? 'bg-[#3B2824] text-[#FFF8F1]'
                  : 'bg-white border border-[#E6D7C8] text-[#3B2824] hover:bg-[#F5EBE1]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. HOMEPAGE VISUAL EDITOR + LIVE RESPONSIVE PREVIEW */}
      {cmsTab === 'homepage' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-6 space-y-5">
            <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-4">
              <h3 className="font-serif text-lg font-bold">
                Hero Section &amp; Call-to-Action Buttons
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold mb-1">Hero Main Heading (English)</label>
                  <input
                    type="text"
                    value={localConfig.heroHeading}
                    onChange={(e) =>
                      setLocalConfig({ ...localConfig, heroHeading: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-serif text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Hero Subheading (Hindi)</label>
                  <input
                    type="text"
                    value={localConfig.heroHeadingHi || ''}
                    onChange={(e) =>
                      setLocalConfig({ ...localConfig, heroHeadingHi: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Hero Supporting Paragraph</label>
                  <textarea
                    rows={3}
                    value={localConfig.heroSubparagraph}
                    onChange={(e) =>
                      setLocalConfig({ ...localConfig, heroSubparagraph: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                  />
                </div>
              </div>

              {/* Hero Image Upload */}
              <div className="p-3.5 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={localConfig.heroImageUrl}
                    alt="Hero preview"
                    className="w-16 h-12 rounded-lg object-cover border border-[#E6D7C8]"
                  />
                  <div>
                    <p className="text-xs font-bold">Hero Showcase Visual</p>
                    <p className="text-[11px] text-[#6B544E]">
                      Upload a high-resolution bakery or pizza photography banner
                    </p>
                  </div>
                </div>
                <label className="px-3.5 py-2 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingHero ? 'Uploading...' : 'Replace Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleHeroImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold mb-1">Primary CTA Label</label>
                  <input
                    type="text"
                    value={localConfig.primaryCtaText}
                    onChange={(e) =>
                      setLocalConfig({ ...localConfig, primaryCtaText: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Primary CTA Target Link</label>
                  <input
                    type="text"
                    value={localConfig.primaryCtaLink}
                    onChange={(e) =>
                      setLocalConfig({ ...localConfig, primaryCtaLink: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Secondary CTA Label</label>
                  <input
                    type="text"
                    value={localConfig.secondaryCtaText || ''}
                    onChange={(e) =>
                      setLocalConfig({ ...localConfig, secondaryCtaText: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Secondary CTA Target Link</label>
                  <input
                    type="text"
                    value={localConfig.secondaryCtaLink || ''}
                    onChange={(e) =>
                      setLocalConfig({ ...localConfig, secondaryCtaLink: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                  />
                </div>
              </div>
            </div>

            {/* Promotional Banner & Section Ordering */}
            <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg font-bold">
                  Promotional Banner &amp; Section Visibility
                </h3>
                <label className="flex items-center gap-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={Boolean(localConfig.promoBannerActive)}
                    onChange={(e) =>
                      setLocalConfig({ ...localConfig, promoBannerActive: e.target.checked })
                    }
                  />
                  Show Promo Strip
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <input
                  type="text"
                  value={localConfig.promoBannerTitle || ''}
                  onChange={(e) =>
                    setLocalConfig({ ...localConfig, promoBannerTitle: e.target.value })
                  }
                  placeholder="Promo Title"
                  className="px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                />
                <input
                  type="text"
                  value={localConfig.promoBannerSubtitle || ''}
                  onChange={(e) =>
                    setLocalConfig({ ...localConfig, promoBannerSubtitle: e.target.value })
                  }
                  placeholder="Promo Subtitle"
                  className="px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                />
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-xs font-bold text-[#6B544E]">
                  Homepage Sections (Reorder or Hide/Show)
                </p>
                {parsedSections.map((sec, idx) => (
                  <div
                    key={sec.key}
                    className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-[#3B2824] text-[#FFF8F1] font-mono-num font-bold flex items-center justify-center text-[11px]">
                        {idx + 1}
                      </span>
                      <span
                        className={`font-bold ${
                          sec.visible ? 'text-[#3B2824]' : 'line-through text-[#6B544E]'
                        }`}
                      >
                        {sec.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => moveSection(idx, -1)}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg bg-white border border-[#E6D7C8] disabled:opacity-40"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSection(idx, 1)}
                        disabled={idx === parsedSections.length - 1}
                        className="p-1.5 rounded-lg bg-white border border-[#E6D7C8] disabled:opacity-40"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSectionVisibility(sec.key)}
                        className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 ${
                          sec.visible
                            ? 'bg-[#E8F5E9] text-[#2D6A4F]'
                            : 'bg-[#FFF5F5] text-[#B94E62]'
                        }`}
                      >
                        {sec.visible ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                        {sec.visible ? 'Visible' : 'Hidden'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live Desktop & Mobile Preview Pane */}
          <div className="xl:col-span-6 bg-white border border-[#E6D7C8] rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E6D7C8] pb-3 mb-4">
              <div>
                <h3 className="font-serif text-lg font-bold">Live Storefront Preview</h3>
                <p className="text-[11px] text-[#6B544E]">
                  Status:{' '}
                  <strong>
                    {localConfig.status === 'draft' ? 'Unpublished Draft' : 'Live on Storefront'}
                  </strong>
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                    previewDevice === 'desktop'
                      ? 'bg-[#3B2824] text-[#FFF8F1]'
                      : 'bg-[#F5EBE1] text-[#3B2824]'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                    previewDevice === 'mobile'
                      ? 'bg-[#3B2824] text-[#FFF8F1]'
                      : 'bg-[#F5EBE1] text-[#3B2824]'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Mobile
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#F5EBE1] rounded-2xl p-4 flex justify-center items-start overflow-y-auto">
              <div
                className={`bg-[#FFF8F1] border border-[#E6D7C8] rounded-2xl overflow-hidden shadow-md transition-all ${
                  previewDevice === 'mobile' ? 'w-[340px]' : 'w-full'
                }`}
              >
                <div className="bg-[#3B2824] text-[#FFF8F1] px-4 py-2.5 flex items-center justify-between text-[11px]">
                  <span className="font-serif font-bold">Lovey&apos;s Bakery &amp; Pizza</span>
                  <div className="flex gap-2">
                    {parsedNavLinks
                      .filter((n) => n.isVisible !== false)
                      .slice(0, previewDevice === 'mobile' ? 2 : 5)
                      .map((n, i) => (
                        <span key={`${n.path}-${i}`} className="text-[#E5B867]">
                          {n.label}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <h4 className="font-serif text-xl font-bold text-[#3B2824] leading-snug">
                    {localConfig.heroHeading}
                  </h4>
                  {localConfig.heroHeadingHi && (
                    <p className="text-xs text-[#B94E62] font-semibold">
                      {localConfig.heroHeadingHi}
                    </p>
                  )}
                  <p className="text-xs text-[#6B544E] leading-relaxed">
                    {localConfig.heroSubparagraph}
                  </p>
                  {localConfig.heroImageUrl && (
                    <img
                      src={localConfig.heroImageUrl}
                      alt="Preview"
                      className="w-full h-40 object-cover rounded-xl border border-[#E6D7C8]"
                    />
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="px-3.5 py-2 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-bold">
                      {localConfig.primaryCtaText}
                    </span>
                    {localConfig.secondaryCtaText && (
                      <span className="px-3.5 py-2 rounded-xl border border-[#3B2824] text-[#3B2824] text-xs font-bold">
                        {localConfig.secondaryCtaText}
                      </span>
                    )}
                  </div>
                </div>

                {localConfig.promoBannerActive && (
                  <div className="mx-5 mb-4 p-3 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs">
                    <p className="font-bold text-[#E5B867]">{localConfig.promoBannerTitle}</p>
                    <p className="text-[11px]">{localConfig.promoBannerSubtitle}</p>
                  </div>
                )}

                <div className="px-5 pb-5 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B544E]">
                    Active Section Sequence:
                  </p>
                  {parsedSections
                    .filter((s) => s.visible)
                    .map((s, i) => (
                      <div
                        key={s.key}
                        className="px-3 py-1.5 rounded-lg bg-white border border-[#E6D7C8] text-[11px] font-semibold flex justify-between"
                      >
                        <span>
                          {i + 1}. {s.label}
                        </span>
                        <span className="text-[#2D6A4F]">Visible</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PAGES & POLICIES EDITOR (/admin/website/pages) */}
      {cmsTab === 'pages' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-3 h-fit">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold">Public Pages &amp; Policies</h3>
              <button
                type="button"
                onClick={() => {
                  setIsNewPage(true);
                  setSelectedPage({
                    id: `page-${Date.now()}`,
                    slug: 'new-page',
                    title: 'New Custom Page',
                    subtitle: "Lovey's Bakery & Pizza Corners, Renukoot",
                    content: 'Write your page content here...',
                    seoTitle: "Lovey's Bakery & Pizza Corners",
                    seoDescription: 'Artisan bakery and pizzeria in Renukoot, Sonbhadra.',
                    isPublished: true,
                    updatedByEmail: userEmail,
                    updatedAt: new Date().toISOString(),
                  });
                }}
                className="px-3 py-1.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                New Page
              </button>
            </div>

            <div className="space-y-2">
              {customPages.map((pg) => (
                <div
                  key={pg.id}
                  onClick={() => {
                    setIsNewPage(false);
                    setSelectedPage(pg);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-center justify-between ${
                    selectedPage?.id === pg.id
                      ? 'bg-[#3B2824] text-[#FFF8F1] border-[#3B2824]'
                      : 'bg-[#FFF8F1] border-[#E6D7C8] text-[#3B2824] hover:bg-[#F5EBE1]'
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold">{pg.title}</p>
                    <p className="text-[11px] opacity-80 font-mono-num">/{pg.slug.replace(/^\/+/, '')}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      pg.isPublished ? 'bg-[#2D6A4F] text-white' : 'bg-[#B94E62] text-white'
                    }`}
                  >
                    {pg.isPublished ? 'Published' : 'Draft'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 bg-white border border-[#E6D7C8] rounded-2xl p-6">
            {selectedPage ? (
              <form onSubmit={handleSaveCustomPage} className="space-y-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6D7C8] pb-3">
                  <div>
                    <h3 className="font-serif text-xl font-bold">
                      {isNewPage ? 'Create New Page' : `Edit Page: ${selectedPage.title}`}
                    </h3>
                    <p className="text-[11px] text-[#6B544E]">
                      Accessible on the live website at{' '}
                      <strong>/{selectedPage.slug.replace(/^\/+/, '')}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isNewPage && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomPage(selectedPage)}
                        className="px-3 py-2 rounded-xl bg-[#FFF5F5] text-[#B94E62] font-semibold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-[#2D6A4F] text-white font-bold flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Save &amp; Update Page
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Page Title</label>
                    <input
                      type="text"
                      required
                      value={selectedPage.title}
                      onChange={(e) =>
                        setSelectedPage({ ...selectedPage, title: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">URL Slug</label>
                    <input
                      type="text"
                      required
                      value={selectedPage.slug}
                      onChange={(e) =>
                        setSelectedPage({ ...selectedPage, slug: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold mb-1">Page Subtitle</label>
                  <input
                    type="text"
                    value={selectedPage.subtitle || ''}
                    onChange={(e) =>
                      setSelectedPage({ ...selectedPage, subtitle: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Page Body Content</label>
                  <textarea
                    rows={10}
                    required
                    value={selectedPage.content}
                    onChange={(e) =>
                      setSelectedPage({ ...selectedPage, content: e.target.value })
                    }
                    className="w-full p-3.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#E6D7C8]">
                  <div>
                    <label className="block font-bold mb-1">SEO Meta Title</label>
                    <input
                      type="text"
                      value={selectedPage.seoTitle || ''}
                      onChange={(e) =>
                        setSelectedPage({ ...selectedPage, seoTitle: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">SEO Meta Description</label>
                    <input
                      type="text"
                      value={selectedPage.seoDescription || ''}
                      onChange={(e) =>
                        setSelectedPage({ ...selectedPage, seoDescription: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Canonical Override URL (Optional)</label>
                    <input
                      type="url"
                      value={selectedPage.canonicalUrl || ''}
                      onChange={(e) =>
                        setSelectedPage({ ...selectedPage, canonicalUrl: e.target.value })
                      }
                      placeholder={`https://demoloveysbakeryrenukoot.vercel.app/${selectedPage.slug.replace(/^\/+/, '')}`}
                      className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Hero Image Alt Text</label>
                    <input
                      type="text"
                      value={selectedPage.imageAlt || ''}
                      onChange={(e) =>
                        setSelectedPage({ ...selectedPage, imageAlt: e.target.value })
                      }
                      placeholder={`${selectedPage.title} — Lovey's Bakery & Pizza Corners, Renukoot`}
                      className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-6 pt-2">
                  <label className="flex items-center gap-2 font-bold">
                    <input
                      type="checkbox"
                      checked={selectedPage.isPublished}
                      onChange={(e) =>
                        setSelectedPage({ ...selectedPage, isPublished: e.target.checked })
                      }
                    />
                    Published on Live Website
                  </label>
                  <label className="flex items-center gap-2 font-bold text-[#B94E62]">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedPage.noindex)}
                      onChange={(e) =>
                        setSelectedPage({ ...selectedPage, noindex: e.target.checked })
                      }
                    />
                    Noindex Page (Exclude from Google Search &amp; Sitemap)
                  </label>
                </div>
              </form>
            ) : (
              <p className="text-xs text-[#6B544E] py-8 text-center">
                Select a page from the left sidebar or click &ldquo;New Page&rdquo; to create one.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 3. NAVIGATION BAR MANAGER (/admin/website/navigation) */}
      {cmsTab === 'navigation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleAddNavLink}
            className="lg:col-span-4 bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-3.5 h-fit text-xs"
          >
            <h3 className="font-serif text-lg font-bold">Add Navigation Link</h3>
            <div>
              <label className="block font-bold mb-1">Menu Label (English)</label>
              <input
                type="text"
                required
                value={newNavLabel}
                onChange={(e) => setNewNavLabel(e.target.value)}
                placeholder="e.g. Festive Combos"
                className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Menu Label (Hindi)</label>
              <input
                type="text"
                value={newNavLabelHi}
                onChange={(e) => setNewNavLabelHi(e.target.value)}
                placeholder="e.g. फेस्टिव कॉम्बो"
                className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Target Route / URL Path</label>
              <input
                type="text"
                required
                value={newNavPath}
                onChange={(e) => setNewNavPath(e.target.value)}
                placeholder="/menu"
                className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] font-semibold flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add to Navigation List
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-3">
            <h3 className="font-serif text-lg font-bold">
              Header Navigation Bar Links (Reorder, Rename, or Hide)
            </h3>
            <p className="text-xs text-[#6B544E]">
              Click &ldquo;Publish to Live Website&rdquo; at the top right after making changes.
            </p>
            <div className="space-y-2">
              {parsedNavLinks.map((nav, idx) => (
                <div
                  key={`${nav.path}-${idx}`}
                  className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-[#3B2824] text-[#FFF8F1] font-mono-num font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={nav.label}
                      onChange={(e) => {
                        const next = [...parsedNavLinks];
                        next[idx] = { ...nav, label: e.target.value };
                        updateNavLinks(next);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-[#E6D7C8] bg-white font-bold w-36"
                    />
                    <input
                      type="text"
                      value={nav.labelHi || ''}
                      onChange={(e) => {
                        const next = [...parsedNavLinks];
                        next[idx] = { ...nav, labelHi: e.target.value };
                        updateNavLinks(next);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-[#E6D7C8] bg-white w-32"
                    />
                    <input
                      type="text"
                      value={nav.path}
                      onChange={(e) => {
                        const next = [...parsedNavLinks];
                        next[idx] = { ...nav, path: e.target.value };
                        updateNavLinks(next);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-[#E6D7C8] bg-white font-mono-num w-32"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => moveNavLink(idx, -1)}
                      disabled={idx === 0}
                      className="p-1.5 rounded-lg bg-white border border-[#E6D7C8] disabled:opacity-40"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveNavLink(idx, 1)}
                      disabled={idx === parsedNavLinks.length - 1}
                      className="p-1.5 rounded-lg bg-white border border-[#E6D7C8] disabled:opacity-40"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...parsedNavLinks];
                        next[idx] = { ...nav, isVisible: nav.isVisible === false ? true : false };
                        updateNavLinks(next);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-semibold ${
                        nav.isVisible !== false
                          ? 'bg-[#E8F5E9] text-[#2D6A4F]'
                          : 'bg-[#FFF5F5] text-[#B94E62]'
                      }`}
                    >
                      {nav.isVisible !== false ? 'Visible' : 'Hidden'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateNavLinks(parsedNavLinks.filter((_, i) => i !== idx))
                      }
                      className="p-1.5 rounded-lg bg-[#FFF5F5] text-[#B94E62]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. FOOTER & COPYRIGHT EDITOR (/admin/website/footer) */}
      {cmsTab === 'footer' && (
        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-6 space-y-4 text-xs max-w-3xl">
          <h3 className="font-serif text-lg font-bold">
            Website Footer Description, Policy Links &amp; Copyright
          </h3>
          <div>
            <label className="block font-bold mb-1">Footer Brand Summary</label>
            <textarea
              rows={3}
              value={localConfig.footerDescription || ''}
              onChange={(e) =>
                setLocalConfig({ ...localConfig, footerDescription: e.target.value })
              }
              className="w-full p-3 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
            />
          </div>
          <div>
            <label className="block font-bold mb-1">Copyright Line</label>
            <input
              type="text"
              value={localConfig.footerCopyright || ''}
              onChange={(e) =>
                setLocalConfig({ ...localConfig, footerCopyright: e.target.value })
              }
              className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
            />
          </div>
          <div className="space-y-2 pt-2">
            <p className="font-bold">Footer Policy Links</p>
            {parsedFooterLinks.map((fl, idx) => (
              <div key={`${fl.path}-${idx}`} className="flex items-center gap-2">
                <input
                  type="text"
                  value={fl.label}
                  onChange={(e) => {
                    const next = [...parsedFooterLinks];
                    next[idx] = { ...fl, label: e.target.value };
                    updateFooterLinks(next);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#E6D7C8] bg-[#FFF8F1] flex-1"
                />
                <input
                  type="text"
                  value={fl.path}
                  onChange={(e) => {
                    const next = [...parsedFooterLinks];
                    next[idx] = { ...fl, path: e.target.value };
                    updateFooterLinks(next);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num w-48"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. SEO & OPENGRAPH MANAGER (/admin/website/seo) */}
      {cmsTab === 'seo' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
          <div className="lg:col-span-7 bg-white border border-[#E6D7C8] rounded-2xl p-6 space-y-4">
            <h3 className="font-serif text-lg font-bold">
              Search Engine Optimization (SEO), Meta Tags &amp; Social Cards
            </h3>
            <div>
              <label className="block font-bold mb-1">Default Homepage Meta Title</label>
              <input
                type="text"
                value={localConfig.seoDefaultTitle || ''}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, seoDefaultTitle: e.target.value })
                }
                placeholder="Lovey's Bakery & Pizza Corners | Bakery & Custom Cakes in Renukoot"
                className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Default Homepage Meta Description</label>
              <textarea
                rows={3}
                value={localConfig.seoDefaultDescription || ''}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, seoDefaultDescription: e.target.value })
                }
                className="w-full p-3 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">
                Open Graph / WhatsApp Social Share Image URL
              </label>
              <input
                type="text"
                value={localConfig.ogImageUrl || localConfig.heroImageUrl || ''}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, ogImageUrl: e.target.value })
                }
                placeholder="/assets/hero/loveys-hero-spread.jpg"
                className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">
                Target Local Keywords (Renukoot &amp; Sonbhadra Focus)
              </label>
              <input
                type="text"
                value={localConfig.seoKeywords || ''}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, seoKeywords: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
              />
            </div>

            {/* Google Search Result Snippet Preview */}
            <div className="p-4 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B544E]">
                Google Search Result Snippet Preview (Desktop &amp; Mobile)
              </p>
              <p className="text-[11px] text-[#2D6A4F] font-mono-num">
                https://demoloveysbakeryrenukoot.vercel.app &rsaquo; renukoot-sonbhadra
              </p>
              <p className="text-sm font-bold text-[#1A0DAB]">
                {localConfig.seoDefaultTitle ||
                  "Lovey's Bakery & Pizza Corners | Bakery & Custom Cakes in Renukoot"}
              </p>
              <p className="text-xs text-[#4D5156] line-clamp-2">
                {localConfig.seoDefaultDescription ||
                  "Order fresh celebration cakes, custom birthday cakes, pastries, and stone-baked pizzas from Lovey's Bakery & Pizza Corners in Renukoot, Sonbhadra."}
              </p>
            </div>

            {/* Open Graph / Social Sharing Card Preview */}
            <div className="p-4 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B544E]">
                Open Graph / WhatsApp &amp; Facebook Link Card Preview
              </p>
              <div className="rounded-xl overflow-hidden border border-[#E6D7C8] bg-white max-w-md">
                <img
                  src={
                    localConfig.ogImageUrl ||
                    localConfig.heroImageUrl ||
                    '/assets/hero/loveys-hero-spread.jpg'
                  }
                  alt="Social card preview"
                  className="w-full h-40 object-cover"
                />
                <div className="p-3 space-y-0.5">
                  <p className="text-[10px] uppercase text-[#6B544E] font-mono-num">
                    DEMOLOVEYSBAKERYRENUKOOT.VERCEL.APP
                  </p>
                  <p className="font-bold text-xs text-[#3B2824] line-clamp-1">
                    {localConfig.seoDefaultTitle ||
                      "Lovey's Bakery & Pizza Corners | Bakery & Custom Cakes in Renukoot"}
                  </p>
                  <p className="text-[11px] text-[#6B544E] line-clamp-2">
                    {localConfig.seoDefaultDescription}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Live SEO Health & Warnings Checklist (Phase 20) */}
          <div className="lg:col-span-5 bg-white border border-[#E6D7C8] rounded-2xl p-6 space-y-4 h-fit">
            <div>
              <span className="px-2.5 py-0.5 rounded-lg bg-[#3B2824] text-[#E5B867] text-[10px] font-bold uppercase">
                Automated SEO Diagnostics
              </span>
              <h3 className="font-serif text-lg font-bold mt-1">
                Live SEO Health, Sitemap &amp; Schema Checklist
              </h3>
              <p className="text-[11px] text-[#6B544E]">
                Real-time audit of your products, categories, custom pages, and local entity verification flags.
              </p>
            </div>

            {(() => {
              const unverifiedProducts = products.filter(
                (p) => p.publicationStatus === 'needs_owner_verification'
              );
              const verifiedProducts = products.filter(
                (p) =>
                  p.publicationStatus === 'published' || p.publicationStatus === 'approved'
              );
              const missingAltProducts = products.filter(
                (p) => !p.imageAlt || !p.imageAlt.trim()
              );
              const missingPriceProducts = products.filter(
                (p) => !(p.basePrice ?? p.price)
              );
              const missingImageProducts = products.filter(
                (p) => !p.imageUrl || !p.imageUrl.trim()
              );
              const unverifiedDesigns = cakeDesigns.filter(
                (d) => d.publicationStatus === 'needs_owner_verification'
              );
              const coordsVerified = Boolean(settings?.coordinatesVerifiedByOwner);
              const hoursVerified = Boolean(settings?.openingHoursVerifiedByOwner);

              return (
                <div className="space-y-2.5">
                  <div
                    className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                      unverifiedProducts.length > 0
                        ? 'bg-[#FFF5F5] border-[#B94E62]/30 text-[#B94E62]'
                        : 'bg-[#E8F5E9] border-[#2D6A4F]/30 text-[#2D6A4F]'
                    }`}
                  >
                    {unverifiedProducts.length > 0 ? (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">
                        {unverifiedProducts.length > 0
                          ? `${unverifiedProducts.length} Starter Products Awaiting Owner Verification`
                          : `All ${verifiedProducts.length} Products Verified & Indexed in Sitemap`}
                      </p>
                      <p className="text-[11px] opacity-90">
                        {unverifiedProducts.length > 0
                          ? 'Unverified starter products are currently excluded from /sitemap.xml and Product JSON-LD. Open Products to click "Verify & Index for SEO".'
                          : 'Verified products are live in /sitemap.xml with ProductGroup schema.'}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                      !coordsVerified || !hoursVerified
                        ? 'bg-[#FFF5F5] border-[#B94E62]/30 text-[#B94E62]'
                        : 'bg-[#E8F5E9] border-[#2D6A4F]/30 text-[#2D6A4F]'
                    }`}
                  >
                    {!coordsVerified || !hoursVerified ? (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">
                        {!coordsVerified || !hoursVerified
                          ? 'Store Coordinates / Opening Hours Pending Owner Confirmation'
                          : 'Store GeoCoordinates & OpeningHours Verified in Schema.org'}
                      </p>
                      <p className="text-[11px] opacity-90">
                        {!coordsVerified || !hoursVerified
                          ? 'Go to Settings (/admin/settings) to confirm your exact Renukoot map pin and daily opening hours.'
                          : 'Verified coordinates and hours are emitted in Bakery LocalBusiness JSON-LD.'}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                      missingAltProducts.length > 0
                        ? 'bg-[#FFF5F5] border-[#B94E62]/30 text-[#B94E62]'
                        : 'bg-[#E8F5E9] border-[#2D6A4F]/30 text-[#2D6A4F]'
                    }`}
                  >
                    {missingAltProducts.length > 0 ? (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">
                        {missingAltProducts.length > 0
                          ? `${missingAltProducts.length} Products Using Auto-Fallback Image Alt Text`
                          : 'All Products Have Custom Image Alt Text'}
                      </p>
                      <p className="text-[11px] opacity-90">
                        Custom alt text helps your cakes and pizzas rank in Google Images for Renukoot searches.
                      </p>
                    </div>
                  </div>

                  {(missingPriceProducts.length > 0 || missingImageProducts.length > 0) && (
                    <div className="p-3 rounded-xl border bg-[#FFF5F5] border-[#B94E62]/30 text-[#B94E62] flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">
                          Missing Product Price or Photograph Detected
                        </p>
                        <p className="text-[11px]">
                          {missingPriceProducts.length} without price · {missingImageProducts.length} without image.
                        </p>
                      </div>
                    </div>
                  )}

                  {unverifiedDesigns.length > 0 && (
                    <div className="p-3 rounded-xl border bg-[#FFF8F1] border-[#E6D7C8] text-[#3B2824] flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#B94E62]" />
                      <div>
                        <p className="font-bold">
                          {unverifiedDesigns.length} Custom Cake Templates Awaiting Verification
                        </p>
                        <p className="text-[11px] text-[#6B544E]">
                          Open Custom Cakes (/admin/cakes) to verify starter templates for `/cakes/:slug` indexing.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] space-y-1 text-[11px]">
                    <p className="font-bold text-[#3B2824]">Public SEO Endpoints Status:</p>
                    <p className="font-mono-num text-[#2D6A4F]">
                      &bull; Dynamic XML Sitemap: <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="underline">/sitemap.xml</a> ({categories.filter((c) => c.isActive).length} categories, {verifiedProducts.length} verified products)
                    </p>
                    <p className="font-mono-num text-[#2D6A4F]">
                      &bull; Crawler Policy: <a href="/robots.txt" target="_blank" rel="noreferrer" className="underline">/robots.txt</a> (Googlebot, Bingbot, OAI-SearchBot, Claude-SearchBot allowed)
                    </p>
                    <p className="font-mono-num text-[#2D6A4F]">
                      &bull; Bilingual Hindi Hub: <a href="/hi" target="_blank" rel="noreferrer" className="underline">/hi</a> (en-IN &amp; hi-IN hreflang active)
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 6. THEME & STYLING CONTROLS (/admin/website/theme) */}
      {cmsTab === 'theme' && (
        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-6 space-y-5 text-xs max-w-3xl">
          <h3 className="font-serif text-lg font-bold">
            Controlled Brand Palette, Typography &amp; Button Styling
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold mb-1">Color Palette Preset</label>
              <select
                value={localConfig.themePalettePreset || 'warm-ivory-cocoa-berry'}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, themePalettePreset: e.target.value })
                }
                className="w-full px-3 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-semibold"
              >
                <option value="warm-ivory-cocoa-berry">Warm Ivory, Roasted Cocoa &amp; Berry</option>
                <option value="royal-pistachio-gold">Royal Ivory, Pistachio &amp; Gold</option>
                <option value="dark-ganache-artisan">Dark Ganache &amp; Warm Cream</option>
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Typography Pairing</label>
              <select
                value={localConfig.themeTypographyPreset || 'cormorant-plus-jakarta'}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, themeTypographyPreset: e.target.value })
                }
                className="w-full px-3 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-semibold"
              >
                <option value="cormorant-plus-jakarta">Cormorant Garamond + Plus Jakarta Sans</option>
                <option value="editorial-serif-clean">Editorial Serif + JetBrains Mono</option>
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Button Corner Radius</label>
              <select
                value={localConfig.themeButtonStyle || 'rounded-2xl'}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, themeButtonStyle: e.target.value })
                }
                className="w-full px-3 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-semibold"
              >
                <option value="rounded-2xl">Soft Artisan (16px Rounded)</option>
                <option value="rounded-xl">Classic Patisserie (12px Rounded)</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
