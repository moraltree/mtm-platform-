import { VerifyForm } from "./VerifyForm";
export const metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function VerifyPage() {
  return (
    <main style={{ maxWidth: "48rem", margin: "3rem auto", padding: "1rem" }}>
      <h1>Confirm your email</h1>
      <p>
        Continue to your Moral Tree Media account. This link can be used once.
      </p>
      <VerifyForm />
    </main>
  );
}
