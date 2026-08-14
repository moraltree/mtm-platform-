import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { PageSections } from "@/components/patterns/PageSections";
import { getPageByPageId, getProducts } from "@/lib/sanity/queries";
import { adaptSections } from "@/lib/pageSections";
import { urlFor } from "@/lib/sanity/image";
import { getProductPrice } from "@/lib/stripe";
import { formatPrice } from "@/lib/format";
import { buildMetadata } from "@/lib/metadata";
import styles from "./page.module.css";

// Listing page — an empty catalogue is a normal state (like Story Worlds/
// News), not a 404.

const INTERVAL_SUFFIX: Record<string, string> = {
  day: "/day",
  week: "/wk",
  month: "/mo",
  year: "/yr",
};

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageByPageId("shop");
  return buildMetadata(
    page?.seo?.metaTitle || page?.title || "Shop",
    page?.seo,
  );
}

export default async function ShopIndexPage() {
  const [page, products] = await Promise.all([
    getPageByPageId("shop"),
    getProducts(),
  ]);
  const sections = adaptSections(page?.sections);
  const opensWithHero = sections[0]?._type === "heroBlock";

  const productsWithPrices = products
    ? await Promise.all(
        products.map(async (product) => ({
          product,
          price: await getProductPrice(product.stripePriceId),
        })),
      )
    : null;

  return (
    <Container className={styles.wrap}>
      {!opensWithHero && <h1>{page?.title || "Shop"}</h1>}

      {page && <PageSections sections={sections} />}

      {productsWithPrices && productsWithPrices.length > 0 ? (
        <div className={styles.grid}>
          {productsWithPrices.map(({ product, price }) => {
            const firstImage = product.images?.[0];
            const imageSrc = firstImage
              ? urlFor(firstImage)?.width(800).url()
              : undefined;
            return (
              <Card
                key={product._id}
                title={product.title}
                meta={
                  price
                    ? `${formatPrice(price.unitAmount, price.currency)}${
                        price.recurringInterval
                          ? INTERVAL_SUFFIX[price.recurringInterval]
                          : ""
                      }`
                    : undefined
                }
                image={
                  imageSrc
                    ? { src: imageSrc, alt: firstImage?.alt || "" }
                    : undefined
                }
                href={`/shop/${product.slug.current}`}
              />
            );
          })}
        </div>
      ) : (
        <p className={styles.empty}>Our shop is coming soon.</p>
      )}
    </Container>
  );
}
