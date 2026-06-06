import {
  library,
  findIconDefinition,
  type IconName,
  type IconPrefix,
} from '@fortawesome/fontawesome-svg-core';
import {
  faEtsy,
  faShopify,
  faAmazon,
  faInstagram,
  faGoogle,
  faTiktok,
  faFacebook,
  faXTwitter,
  faYoutube,
  faPinterest,
  faEbay,
  faWhatsapp,
  faLinkedin,
} from '@fortawesome/free-brands-svg-icons';
import {
  faStore,
  faGlobe,
  faStar,
  faComment,
  faThumbsUp,
  faBuildingColumns,
  faCartShopping,
  faHeart,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// Register only the icons offered in ICON_CHOICES (tree-shaken) so the bundle
// stays small while still resolving icons by name string. Keep this in sync
// with ICON_CHOICES below.
library.add(
  faEtsy, faShopify, faAmazon, faInstagram, faGoogle, faTiktok, faFacebook,
  faXTwitter, faYoutube, faPinterest, faEbay, faWhatsapp, faLinkedin,
  faStore, faGlobe, faStar, faComment, faThumbsUp, faBuildingColumns, faCartShopping, faHeart,
);

const FALLBACK: [IconPrefix, IconName] = ['fas', 'store'];

/** Parses an "prefix:name" token (e.g. "fab:instagram"), falling back to a generic store. */
function parseToken(token: string): [IconPrefix, IconName] {
  const parts = (token || '').split(':');
  const prefix = (parts[0] || 'fas') as IconPrefix;
  const name = (parts[1] || parts[0] || 'store') as IconName;
  return findIconDefinition({ prefix, iconName: name }) ? [prefix, name] : FALLBACK;
}

export function PlatformIcon({
  token,
  size = 16,
  color,
  className,
}: {
  token: string;
  size?: number;
  color?: string;
  className?: string;
}) {
  const [prefix, name] = parseToken(token);
  return <FontAwesomeIcon icon={[prefix, name]} style={{ fontSize: size, color }} className={className} />;
}

/** Curated tokens offered in the admin icon picker (all registered above). */
export const ICON_CHOICES: string[] = [
  'fab:etsy',
  'fab:shopify',
  'fab:amazon',
  'fab:instagram',
  'fab:google',
  'fab:tiktok',
  'fab:facebook',
  'fab:x-twitter',
  'fab:youtube',
  'fab:pinterest',
  'fab:ebay',
  'fab:whatsapp',
  'fab:linkedin',
  'fas:store',
  'fas:globe',
  'fas:star',
  'fas:cart-shopping',
  'fas:comment',
  'fas:thumbs-up',
  'fas:building-columns',
  'fas:heart',
];
