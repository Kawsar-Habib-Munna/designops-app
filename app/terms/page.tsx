import LegalPage from "@/app/components/LegalPage";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta(
  "Terms of Service — FLOW 53",
  "The terms that apply when you use the FLOW 53 website and client portal.",
  "/terms",
);

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="October 27, 2026"
      intro="By using the FLOW 53 client portal you agree to these terms."
      sections={[
        {
          heading: "Use of the portal",
          body: [
            "The portal is provided for clients of FLOW 53 to review project progress, share files, give feedback, approve work and sign agreements. You are responsible for keeping your account secure and for the accuracy of the information you provide.",
          ],
        },
        {
          heading: "Projects and agreements",
          body: [
            "Scope, deliverables, timelines and payments for each project are governed by the Statement of Work (SOW) you sign. If these terms conflict with a signed SOW, the SOW prevails.",
          ],
        },
        {
          heading: "Your content",
          body: [
            "You retain ownership of the materials you upload. You grant us permission to use them solely to deliver the agreed services.",
          ],
        },
        {
          heading: "Acceptable use",
          body: ["Do not misuse the portal, attempt to access other clients' data, or upload unlawful or harmful content."],
        },
        {
          heading: "Liability",
          body: ["The portal is provided as is. To the extent permitted by law, we are not liable for indirect or incidental damages arising from its use."],
        },
        {
          heading: "Changes",
          body: ["We may update these terms from time to time. Continued use of the portal means you accept the updated terms."],
        },
      ]}
    />
  );
}
