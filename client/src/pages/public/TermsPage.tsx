import { PolicyLayout } from './PolicyLayout';

export function TermsPage() {
  return (
    <PolicyLayout
      title="Terms of use"
      intro="The working rules for using CivicEye 360. This is a draft for the operating organization to review and complete."
      updated="October 2026"
    >
      <h2>1. The service</h2>
      <p>
        CivicEye 360 is a non-emergency civic issue reporting and workflow platform operated by{' '}
        <strong>[Operating organization]</strong>. It allows residents to submit reports and allows
        authorized municipal staff to review, assign, act on and document them. The service is not a
        substitute for emergency services or for any statutory complaint process unless the
        operating organization explicitly states otherwise.
      </p>

      <h2>2. Emergencies</h2>
      <p>
        Do not use CivicEye 360 to report a fire, gas leak, live electrical hazard, crime in
        progress, medical emergency or any situation involving immediate danger. Contact your local
        emergency service. Reports submitted here may not be monitored continuously.
      </p>

      <h2>3. Accounts and access</h2>
      <ul>
        <li>Provide accurate registration details and keep your password confidential.</li>
        <li>
          Resident accounts are for personal use. Staff accounts are provisioned by a platform
          administrator and may be changed or deactivated as operational needs require.
        </li>
        <li>
          You are responsible for activity through your session. Sign out on shared devices. Tell
          the operating organization if you suspect unauthorized access.
        </li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>You must not use the service to:</p>
      <ul>
        <li>submit knowingly false, misleading or duplicate reports intended to disrupt services;</li>
        <li>upload malware, unlawful content, another person’s private information, identity documents or unrelated images of people;</li>
        <li>harass staff or other residents, or attempt to identify them through the workflow;</li>
        <li>probe, scan, overload, circumvent access controls or interfere with the service;</li>
        <li>scrape, export or reuse personal information without authorization.</li>
      </ul>
      <p>
        The operating organization may moderate, restrict or remove content and accounts where
        reasonably necessary to protect people, service operations or the platform. Moderation
        decisions should be recorded internally and handled consistently with the privacy notice.
      </p>

      <h2>5. Your submissions</h2>
      <p>
        You retain ownership of the text and media you submit. You grant the operating organization
        a non-exclusive licence to store, process, display to authorized users, and use the material
        for the purpose of handling the report, maintaining records and producing de-identified
        service analytics. The exact licence wording must be reviewed by legal counsel before
        launch.
      </p>
      <p>
        Do not submit sensitive personal information about yourself or others. Reports may be
        visible to assigned staff and, where explicitly citizen-visible, on the report timeline.
      </p>

      <h2>6. AI assistance</h2>
      <p>
        Some screens offer AI or rules-based suggestions for category, priority, duplicate hints or
        summaries. These are advisory only and may be wrong. They do not create an obligation, a
        service deadline or a decision. Authorized people review and confirm consequential actions.
        If you believe a suggestion is wrong, correct it or contact the operating organization.
      </p>

      <h2>7. Municipal decisions and service targets</h2>
      <p>
        Submitting a report does not guarantee that work will be approved, scheduled or completed.
        Staff may reject a report, request more information, change its category or priority, mark it
        resolved, close it or reopen it under the configured workflow. Any service target shown is a
        configured operational target, not a legal guarantee, unless the operating organization says
        otherwise in writing.
      </p>

      <h2>8. Availability and changes</h2>
      <p>
        The service may be unavailable for maintenance, provider outages or security reasons.
        Features may change. Integrations such as AI, email and map tiles may be disabled; the
        interface should indicate when a capability is unavailable. The operating organization
        should publish a support route for urgent service issues.
      </p>

      <h2>9. Disclaimers and liability</h2>
      <p>
        <strong>[Liability and warranty wording must be completed by legal counsel.]</strong> This
        draft does not create a warranty, indemnity or limitation of liability. To the extent
        permitted by law, the operating organization should define its responsibility for service
        availability, decisions made by staff and third-party providers.
      </p>

      <h2>10. Suspension and termination</h2>
      <p>
        Access may be suspended or terminated for misuse, security risk, repeated false reporting
        or a legal requirement. Where appropriate, the operating organization should provide notice
        and a route to ask for review. Data handling after termination is governed by the privacy
        notice and applicable records-retention obligations.
      </p>

      <h2>11. Governing law and contact</h2>
      <p>
        <strong>[Governing jurisdiction and dispute-resolution wording to be completed.]</strong>{' '}
        Questions about these terms should be directed to <strong>[Operating organization contact]</strong>.
        In a real deployment, the operating organization should also publish any statutory complaint
        or appeal route that applies to its services.
      </p>
    </PolicyLayout>
  );
}
