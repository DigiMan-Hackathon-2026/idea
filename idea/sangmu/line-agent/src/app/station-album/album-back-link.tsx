import Link from "next/link";
import type { ComponentProps } from "react";
import styles from "./station-album.module.css";

export function AlbumBackLink({ href, label, mobileOnly }: {
  href: ComponentProps<typeof Link>["href"];
  label: string;
  mobileOnly?: boolean;
}) {
  return (
    <Link className={styles.albumBack} data-mobile-only={mobileOnly} href={href} prefetch={false} aria-label={label}>
      <span className={styles.albumBackLabel}>{label}</span>
    </Link>
  );
}
