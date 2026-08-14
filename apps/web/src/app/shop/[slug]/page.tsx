import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { RichText } from "@/components/patterns/RichText";
import { AddToCartButton } from "@/components/patterns/AddToCartButton";
import { getProductBySlug, getProducts } from "@/lib/sanity/queries";
import { resolveInternalRef } from "@/lib/links";
import { urlFor } from "@/lib/sanity/image";
import { getProductPrice } from "@/lib/stripe";
import { formatPrice } from "@/lib/format";
import { buildMetadata } from "@/lib/metadata";
import styles from "./page.module.css";

// The one reusable template for every product — content lookup by slug,
// so a missing/inactive product is a real 404 (same rule as About/Founder/
// Story-World-by-slug, not the listing-page rule the shop index uses).

const INTERVAL_SUFFIX: Record<string, string> = {
  day: "/day",
  week: "/wk",
  month: "/mo",
  year: "/yr",
};

export async function generateStaticParams() {
  const products = await getProducts();
  return (products ?? []).map((product) => ({ slug: product.slug.current }));
}

export async function generateMetadata(
  props: PageProps<"/shop/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);
  if (!product) return {};

  return buildMetadata(product.seo?.metaTitle || product.title, product.seo);
}

export default async function ProductPage(props: PageProps<"/shop/[slug]">) {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const price = await getProductPrice(product.stripePriceId);
  const images = product.images ?? [];
  const [firstImage, ...restImages] = images;
  const firstImageSrc = firstImage
    ? urlFor(firstImage)?.width(1200).url()
    : undefined;

  return (
    <>
      <Container className={styles.header}>
        <h1>{product.title}</h1>
        {price && (
          <p className={styles.price}>
            {formatPrice(price.unitAmount, price.currency)}
            {price.recurringInterval
              ? INTERVAL_SUFFIX[price.recurringInterval]
              : ""}
          </p>
        )}
      </Container>

      {firstImageSrc && (
        <Container>
          <div className={styles.gallery}>
            <Image
              src={firstImageSrc}
              alt={firstImage.alt || ""}
              fill
              sizes="(min-width: 48rem) 40rem, 100vw"
              className={styles.galleryImage}
              priority
            />
          </div>
        </Container>
      )}

      {restImages.length > 0 && (
        <Container className={styles.thumbs}>
          {restImages.map((image, index) => {
            const src = urlFor(image)?.width(400).url();
            if (!src) return null;
            return (
              <div key={image._key ?? index} className={styles.thumb}>
                <Image
                  src={src}
                  alt={image.alt || ""}
                  fill
                  sizes="10rem"
                  className={styles.thumbImage}
                />
              </div>
            );
          })}
        </Container>
      )}

      {product.description && (
        <Container className={styles.description}>
          <RichText
            value={product.description}
            resolveInternalLink={resolveInternalRef}
          />
        </Container>
      )}

      <Container className={styles.actions}>
        {price ? (
          <AddToCartButton
            item={{
              productId: product._id,
              slug: product.slug.current,
              stripePriceId: product.stripePriceId,
              title: product.title,
              priceType: product.priceType,
              unitAmount: price.unitAmount,
              currency: price.currency,
              imageSrc: firstImageSrc,
            }}
          />
        ) : (
          <p>This item isn&rsquo;t available to buy right now.</p>
        )}
      </Container>
    </>
  );
}
