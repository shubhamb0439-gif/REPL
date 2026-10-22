// Demo data. When the local RYPL server is running and Instagram is connected,
// these are replaced by live data from /api/*.

export type Brand = {
  name: string
  tagline: string
  about: string
  services: string[]
  audience: string
  tone: string[]
  avoid: string[]
  colors: { primary: string; secondary: string; accent: string; bg: string }
  handle: string
  cta: string
  /** engine/uploads/… path of the logo (PNG/SVG, ideally transparent). Rendered on every post. */
  logo?: string
  /** How big the logo is placed on posts and reels. Default 'large' (wide wordmarks need it). */
  logoSize?: 'small' | 'medium' | 'large'
  /** Free-text brand guidelines: fonts, do/don't, voice examples, layout rules. */
  guidelines?: string
  /** Uploaded guideline files (PDF brand book, reference posts…) — Claude reads these before creating. */
  guideFiles?: { path: string; name: string }[]
  /** Sub-brands / product lines. Each one is a full brand profile; Studio lets you pick which one to post as. */
  subBrands?: SubBrand[]
  /** Last edit time — the newest copy wins when two laptops share the brand. */
  updatedAt?: string
}

export type SubBrand = Omit<Brand, 'subBrands'> & { id: string }

/** The brand profile to create content as: the master brand, or one of its sub-brands. */
export const resolveBrand = (b: Brand, subId?: string): Brand & { parent?: string } => {
  const sub = subId ? b.subBrands?.find((s) => s.id === subId) : undefined
  return sub ? { ...sub, parent: b.name } : b
}

export const defaultBrand: Brand = {
  name: 'AXIon',
  tagline: 'AI that works while you sleep.',
  about:
    'AXIon builds AI products for growing businesses: Recipto (AI receptionist for WhatsApp, Instagram & calls), RYPL (AI social media manager) and immersive virtual property tours.',
  services: [
    'Recipto — AI receptionist (WhatsApp, Instagram, calls)',
    'RYPL — AI social media manager',
    'Virtual property tours for real estate',
    'Custom AI automation',
  ],
  audience: 'Indian SMB owners: clinics, salons, gyms, coaching institutes, real estate developers & brokers',
  tone: ['Bold', 'Witty', 'Confident', 'Founder-to-founder'],
  avoid: ['Fake urgency', 'Over-promising results', 'Jargon without explanation'],
  colors: { primary: '#C6FF3D', secondary: '#7C5CFF', accent: '#22D3EE', bg: '#05050A' },
  handle: '@axion.ai',
  cta: 'DM "DEMO" to see it live',
  guidelines: '',
  guideFiles: [],
  subBrands: [],
}

// ---------- Holidays & content moments (Nov 2026 → Oct 2027) ----------
// verify:true = lunar/religious calendar date; confirm locally before scheduling.
export type Moment = { date: string; name: string; type: 'festival' | 'national' | 'global' | 'commerce' | 'awareness'; verify?: boolean }

export const moments: Moment[] = [
  { date: '2026-10-31', name: 'Halloween', type: 'global' },
  { date: '2026-11-06', name: 'Dhanteras', type: 'festival', verify: true },
  { date: '2026-11-08', name: 'Diwali', type: 'festival', verify: true },
  { date: '2026-11-11', name: 'Bhai Dooj', type: 'festival', verify: true },
  { date: '2026-11-13', name: 'World Kindness Day', type: 'awareness' },
  { date: '2026-11-14', name: "Children's Day", type: 'national' },
  { date: '2026-11-15', name: 'Chhath Puja', type: 'festival', verify: true },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti', type: 'festival', verify: true },
  { date: '2026-11-26', name: 'Constitution Day', type: 'national' },
  { date: '2026-11-27', name: 'Black Friday', type: 'commerce' },
  { date: '2026-11-30', name: 'Cyber Monday', type: 'commerce' },
  { date: '2026-12-25', name: 'Christmas', type: 'festival' },
  { date: '2026-12-31', name: "New Year's Eve", type: 'global' },
  { date: '2027-01-01', name: 'New Year', type: 'global' },
  { date: '2027-01-12', name: 'National Youth Day', type: 'national' },
  { date: '2027-01-13', name: 'Lohri', type: 'festival' },
  { date: '2027-01-14', name: 'Makar Sankranti / Pongal', type: 'festival', verify: true },
  { date: '2027-01-26', name: 'Republic Day', type: 'national' },
  { date: '2027-02-14', name: "Valentine's Day", type: 'global' },
  { date: '2027-03-08', name: "International Women's Day", type: 'global' },
  { date: '2027-03-22', name: 'Holi', type: 'festival', verify: true },
  { date: '2027-04-07', name: 'World Health Day', type: 'awareness' },
  { date: '2027-04-22', name: 'Earth Day', type: 'awareness' },
  { date: '2027-05-01', name: 'Labour Day', type: 'global' },
  { date: '2027-05-09', name: "Mother's Day", type: 'global' },
  { date: '2027-06-20', name: "Father's Day", type: 'global' },
  { date: '2027-06-21', name: 'International Yoga Day', type: 'global' },
  { date: '2027-06-30', name: 'World Social Media Day', type: 'awareness' },
  { date: '2027-07-01', name: "National Doctors' Day", type: 'national' },
  { date: '2027-08-01', name: 'Friendship Day', type: 'global' },
  { date: '2027-08-15', name: 'Independence Day', type: 'national' },
  { date: '2027-09-05', name: "Teachers' Day", type: 'national' },
  { date: '2027-09-15', name: "Engineers' Day", type: 'national' },
  { date: '2027-10-02', name: 'Gandhi Jayanti', type: 'national' },
  { date: '2027-10-10', name: 'World Mental Health Day', type: 'awareness' },
]

// ---------- Instagram analytics (demo) ----------
const seed = (n: number) => {
  const x = Math.sin(n * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

export const viewsSeries = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 8, 22 + i)
  const base = 2200 + i * 140
  const spike = i === 18 ? 21000 : i === 19 ? 12500 : i === 25 ? 9800 : 0
  return {
    day: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    views: Math.round(base + seed(i) * 1800 + spike),
    reach: Math.round((base + seed(i) * 1800 + spike) * 0.62),
  }
})

export const kpis = [
  { label: 'Views · 30d', value: 184_320, delta: 0.42, spark: viewsSeries.map((v) => v.views) },
  { label: 'Reach', value: 96_410, delta: 0.31, spark: viewsSeries.map((v) => v.reach) },
  { label: 'Followers', value: 4_812, delta: 0.087, spark: viewsSeries.map((_, i) => 4300 + i * 17 + seed(i + 3) * 30) },
  { label: 'Avg watch time', value: 7.8, suffix: 's', delta: 0.19, spark: viewsSeries.map((_, i) => 5 + i * 0.09 + seed(i + 7)) },
  { label: 'Shares', value: 1_946, delta: 0.64, spark: viewsSeries.map((_, i) => 20 + i * 2 + (i === 18 ? 400 : 0) + seed(i + 11) * 25) },
]

export type Reel = {
  id: string
  title: string
  date: string
  views: number
  watch: number
  shares: number
  saves: number
  score: number
  hue: number
}

export const topReels: Reel[] = [
  { id: 'r1', title: 'Your receptionist sleeps. Ours doesn’t.', date: '9 Oct', views: 38_200, watch: 11.2, shares: 612, saves: 840, score: 94, hue: 75 },
  { id: 'r2', title: '3am WhatsApp lead → booked appointment', date: '15 Oct', views: 21_940, watch: 9.4, shares: 288, saves: 401, score: 88, hue: 260 },
  { id: 'r3', title: 'POV: you missed 40 DMs this week', date: '2 Oct', views: 12_310, watch: 7.1, shares: 140, saves: 122, score: 71, hue: 190 },
  { id: 'r4', title: 'Walk through a 3BHK from your sofa', date: '27 Sep', views: 8_720, watch: 6.2, shares: 96, saves: 210, score: 64, hue: 330 },
]

export const bestTimes = [
  { day: 'Mon', slots: [0.2, 0.4, 0.5, 0.7, 0.6, 0.3] },
  { day: 'Tue', slots: [0.3, 0.5, 0.6, 0.9, 0.7, 0.4] },
  { day: 'Wed', slots: [0.2, 0.4, 0.7, 0.8, 0.9, 0.5] },
  { day: 'Thu', slots: [0.3, 0.6, 0.6, 0.8, 0.7, 0.4] },
  { day: 'Fri', slots: [0.4, 0.5, 0.6, 0.7, 1.0, 0.8] },
  { day: 'Sat', slots: [0.5, 0.6, 0.5, 0.6, 0.8, 0.9] },
  { day: 'Sun', slots: [0.6, 0.7, 0.4, 0.5, 0.7, 0.7] },
]
export const timeSlots = ['8a', '11a', '2p', '5p', '8p', '11p']

// ---------- Scheduled content ----------
export type ContentItem = { id: string; date: string; title: string; format: 'Post' | 'Carousel' | 'Reel' | 'Story' | 'Shoot'; status: 'Idea' | 'Generated' | 'Approved' | 'Scheduled' | 'Posted' }

export const content: ContentItem[] = [
  { id: 'c1', date: '2026-10-22', title: 'Myth vs fact: AI receptionists', format: 'Carousel', status: 'Approved' },
  { id: 'c2', date: '2026-10-23', title: 'Clinic owner reacts to Recipto', format: 'Shoot', status: 'Idea' },
  { id: 'c3', date: '2026-10-24', title: 'Weekend DMs never sleep', format: 'Reel', status: 'Scheduled' },
  { id: 'c4', date: '2026-10-27', title: 'Behind the build: RYPL', format: 'Reel', status: 'Generated' },
  { id: 'c5', date: '2026-10-29', title: 'Before/after: response time', format: 'Post', status: 'Generated' },
  { id: 'c6', date: '2026-10-31', title: 'Scariest thing: unanswered leads', format: 'Reel', status: 'Approved' },
  { id: 'c7', date: '2026-11-03', title: 'Diwali offer teaser', format: 'Story', status: 'Idea' },
  { id: 'c8', date: '2026-11-06', title: 'Dhanteras: invest in AI', format: 'Post', status: 'Idea' },
  { id: 'c9', date: '2026-11-08', title: 'Happy Diwali from AXIon', format: 'Reel', status: 'Generated' },
  { id: 'c10', date: '2026-10-19', title: '5 signs you need a receptionist', format: 'Carousel', status: 'Posted' },
  { id: 'c11', date: '2026-10-15', title: '3am WhatsApp lead → booked', format: 'Reel', status: 'Posted' },
]

// ---------- CRM ----------
export type Stage = 'New' | 'Contacted' | 'Demo' | 'Pilot' | 'Won'
export type Lead = {
  id: string
  name: string
  company: string
  niche: string
  source: 'IG Comment' | 'IG DM' | 'Recipto' | 'LinkedIn' | 'Google Maps' | 'Referral'
  value: number
  stage: Stage
  product: ('Recipto' | 'RYPL' | 'Tours')[]
  city: string
  last: string
  phone?: string
  note?: string
  /** Instagram username (no @) for leads synced from comments */
  instagram?: string
  /** Post the lead engaged with */
  link?: string
}

export const stages: Stage[] = ['New', 'Contacted', 'Demo', 'Pilot', 'Won']

export const leads: Lead[] = [
  { id: 'l1', name: 'Dr. Ananya Rao', company: 'SmileCraft Dental', niche: 'Clinic', source: 'IG Comment', value: 4999, stage: 'New', product: ['Recipto'], city: 'Pune', last: '2h ago', note: 'Commented "price?" on 3am reel' },
  { id: 'l2', name: 'Rahul Mehta', company: 'Skyline Developers', niche: 'Real estate', source: 'LinkedIn', value: 45000, stage: 'Demo', product: ['Tours', 'Recipto', 'RYPL'], city: 'Mumbai', last: 'Yesterday', note: 'Wants property stack for 2 new towers' },
  { id: 'l3', name: 'Priya Kapoor', company: 'Glow Studio', niche: 'Salon', source: 'IG DM', value: 2999, stage: 'Contacted', product: ['Recipto'], city: 'Delhi', last: '5h ago' },
  { id: 'l4', name: 'Arjun Nair', company: 'FitForge Gym', niche: 'Gym', source: 'Recipto', value: 7999, stage: 'Pilot', product: ['Recipto', 'RYPL'], city: 'Bengaluru', last: '1d ago', note: 'Pilot day 4/7 — 31 leads handled' },
  { id: 'l5', name: 'Sneha Iyer', company: 'BrightPath Coaching', niche: 'Coaching', source: 'Google Maps', value: 4999, stage: 'New', product: ['Recipto'], city: 'Chennai', last: '3h ago' },
  { id: 'l6', name: 'Vikram Singh', company: 'Urban Nest Realty', niche: 'Real estate', source: 'Referral', value: 24999, stage: 'Won', product: ['Tours', 'Recipto'], city: 'Gurugram', last: '3d ago' },
  { id: 'l7', name: 'Meera Joshi', company: 'DermaLux Clinic', niche: 'Clinic', source: 'IG Comment', value: 9999, stage: 'Demo', product: ['Recipto', 'RYPL'], city: 'Ahmedabad', last: 'Today' },
  { id: 'l8', name: 'Karan Malhotra', company: 'Spice Route Kitchen', niche: 'Restaurant', source: 'IG DM', value: 2999, stage: 'Contacted', product: ['RYPL'], city: 'Jaipur', last: '2d ago' },
  { id: 'l9', name: 'Nisha Verma', company: 'StudyGlobe', niche: 'Study abroad', source: 'LinkedIn', value: 12999, stage: 'New', product: ['Recipto', 'RYPL'], city: 'Hyderabad', last: '6h ago' },
]

// ---------- Learned playbook (written by the learning loop) ----------
export const playbook = [
  { rule: 'Open with a pain-point question in the first 1.5s', evidence: '+38% avg watch time vs statement hooks (n=14)', confidence: 0.86 },
  { rule: 'Show the product result before explaining it', evidence: 'Top 3 reels all reveal outcome by 4s', confidence: 0.78 },
  { rule: 'Cut every 0.8–1.2s in the first 5 seconds', evidence: 'Retention drop at 3s halves with fast cuts', confidence: 0.71 },
  { rule: 'Post reels Fri 8pm or Wed 8pm IST', evidence: 'Highest reach windows across 30 days', confidence: 0.69 },
  { rule: 'End with a loop back to the hook line', evidence: 'Rewatch rate 1.4× on looped reels', confidence: 0.62 },
]
