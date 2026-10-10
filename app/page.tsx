import { redirect } from "next/navigation";

/**
 * New employees start at Activate Account; activated employees go to /login
 * directly. Signed-in users never reach this page: proxy.ts sends them to
 * their dashboard.
 */
export default function Home() {
  redirect("/activate");
}
