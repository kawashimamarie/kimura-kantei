// 構造化データ（JSON-LD）の組み立て。
// ページに実際に表示している事実だけを入れる。表示していない情報を構造化データのためだけに加えない。
import { site, contact, company } from '../data/site';
import { profile } from '../data/profile';
import type { Faq } from '../data/faq';
import { abs } from './url';

export const ORG_ID = `${site.url}/#organization`;
export const PERSON_ID = `${site.url}/profile/#kimura-osamu`;
export const WEBSITE_ID = `${site.url}/#website`;

export const organization = () => ({
  '@type': 'ProfessionalService',
  '@id': ORG_ID,
  name: site.name,
  alternateName: site.nameEn,
  url: abs('/'),
  logo: abs('/assets/img/logo/kimura-logo.png'),
  image: abs('/assets/img/office/office-reception.jpg'),
  telephone: '+81-3-5356-9158',
  faxNumber: '+81-3-5356-9159',
  email: contact.email,
  foundingDate: company.founded,
  address: {
    '@type': 'PostalAddress',
    postalCode: contact.postalCode,
    addressRegion: contact.addressRegion,
    addressLocality: contact.addressLocality,
    streetAddress: contact.streetAddress,
    addressCountry: 'JP',
  },
  founder: { '@id': PERSON_ID },
});

export const website = () => ({
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: abs('/'),
  name: site.name,
  inLanguage: 'ja',
  publisher: { '@id': ORG_ID },
});

/** プロフィールページ用の詳しい Person。その他のページからは @id で参照する。 */
export const person = () => ({
  '@type': 'Person',
  '@id': PERSON_ID,
  name: profile.name,
  alternateName: profile.kana,
  jobTitle: '代表取締役',
  url: abs('/profile/'),
  image: abs(profile.photo),
  worksFor: { '@id': ORG_ID },
  alumniOf: { '@type': 'CollegeOrUniversity', name: '関西大学大学院 工学研究科' },
  hasCredential: profile.credentials.map((name) => ({
    '@type': 'EducationalOccupationalCredential',
    credentialCategory: '国家資格',
    name,
  })),
  knowsAbout: profile.expertise,
});

export const breadcrumbList = (items: { name: string; path: string }[]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: it.name,
    item: abs(it.path),
  })),
});

export const service = (o: { name: string; description: string; path: string; areaServed?: string }) => ({
  '@type': 'Service',
  '@id': `${abs(o.path)}#service`,
  name: o.name,
  description: o.description,
  url: abs(o.path),
  provider: { '@id': ORG_ID },
  ...(o.areaServed ? { areaServed: { '@type': 'Country', name: o.areaServed } } : {}),
});

export const article = (o: {
  headline: string;
  description: string;
  path: string;
  datePublished?: Date;
  dateModified?: Date;
  image?: string;
  author: 'organization' | 'kimura';
  citations?: { title: string; url?: string }[];
}) => ({
  '@type': 'Article',
  '@id': `${abs(o.path)}#article`,
  headline: o.headline,
  description: o.description,
  mainEntityOfPage: abs(o.path),
  ...(o.datePublished ? { datePublished: o.datePublished.toISOString().slice(0, 10) } : {}),
  ...(o.dateModified ? { dateModified: o.dateModified.toISOString().slice(0, 10) } : {}),
  ...(o.image ? { image: abs(o.image) } : {}),
  author: { '@id': o.author === 'kimura' ? PERSON_ID : ORG_ID },
  publisher: { '@id': ORG_ID },
  inLanguage: 'ja',
  ...(o.citations?.length
    ? { citation: o.citations.map((c) => ({ '@type': 'CreativeWork', name: c.title, ...(c.url ? { url: c.url } : {}) })) }
    : {}),
});

export const faqPage = (items: Faq[], path: string) => ({
  '@type': 'FAQPage',
  '@id': `${abs(path)}#faq`,
  mainEntity: items.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a.join('\n') },
  })),
});
