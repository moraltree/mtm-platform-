import styles from "./admin.module.css";
export default function AdminNotFound() {
  return (
    <section className={styles.unavailable}>
      <p className={styles.eyebrow}>Moral Tree Media</p>
      <h1>Private access required</h1>
      <p>
        This console is available only to authorised Founder and Admin accounts.
      </p>
      <a href="/subscribe">Sign in with your existing account</a>
    </section>
  );
}
