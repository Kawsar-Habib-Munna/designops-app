import LegalPage from "@/app/components/LegalPage";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta(
  "Privacy Policy — FLOW 53",
  "How FLOW 53 collects, uses and protects your information when you use our website and client portal.",
  "/privacy",
);

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="October 27, 2026"
      intro="This policy explains what information FLOW 53 (the DesignOps client portal) collects, how we use it, and the choices you have."
      sections={[
        {
          heading: "Information we collect",
          body: [
            "When you sign in with Google, we receive your name, email address and profile picture. We do not receive your Google password and we do not access your Gmail, Drive or any other Google data.",
            "We also store the information you provide in the portal, such as company details, project files, messages, feedback, approvals and signed agreements.",
          ],
        },
        {
          heading: "How we use it",
          body: [
            "We use your information to authenticate you, deliver and manage your projects, communicate with you about them, and maintain records such as agreements and payments.",
            "We do not sell your personal information or use it for advertising.",
          ],
        },
        {
          heading: "Storage and sharing",
          body: [
            "Data is stored with our infrastructure providers (such as Supabase and Vercel) who process it only to run the service. We share information with others only when required by law or with your consent.",
          ],
        },
        {
          heading: "Retention and your rights",
          body: [
            "We keep your data while your account or projects are active and as needed for legal and accounting records. You may request access, correction or deletion of your data at any time by contacting us.",
          ],
        },
        {
          heading: "Changes",
          body: ["We may update this policy from time to time. The date above shows the latest revision."],
        },
      ]}
    />
  );
}
