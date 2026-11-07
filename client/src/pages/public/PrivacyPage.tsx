import { PolicyLayout } from './PolicyLayout';

export function PrivacyPage() {
  return (
    <PolicyLayout
      title="Privacy notice"
      intro="What CivicEye 360 collects, who can see it, and what still needs to be decided by the operating organization."
      updated="October 2026"
    >
      <h2>1. Who operates this service</h2>
      <p>
        CivicEye 360 is operated by <strong>[Operating organization]</strong> for residents and
        municipal staff of <strong>[Service area]</strong>. Privacy questions and requests should be
        directed to <strong>[Privacy contact email or address]</strong>. This demonstration
        installation has no live privacy contact.
      </p>

      <h2>2. Information we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> name, email address, password hash, role and department
          membership. Passwords are never stored in plain text and are never returned by the API.
        </li>
        <li>
          <strong>Report details:</strong> title, description, category, priority, location or
          address, optional coordinates, attachments, status history, comments and feedback.
        </li>
        <li>
          <strong>Operational records:</strong> assignments, internal notes, audit entries, request
          identifiers and notification delivery status. Audit records are retained to explain
          decisions and are append-only for ordinary users.
        </li>
        <li>
          <strong>Technical information:</strong> limited request metadata such as IP address,
          timestamp, route and request ID for security, rate limiting and troubleshooting. Secrets,
          passwords and session tokens are excluded from application logs by redaction.
        </li>
      </ul>

      <h2>3. Why we use it</h2>
      <p>
        Information is used to create and route reports, assign field work, communicate status,
        verify resolution, measure service performance, prevent abuse, secure the platform and
        maintain the audit trail. Aggregate analytics are produced from stored report records; the
        operating organization should confirm the legal basis for each purpose before production.
      </p>

      <h2>4. Who can see a report</h2>
      <ul>
        <li>The citizen who created it can see their own report and its citizen-visible updates.</li>
        <li>
          Assigned field staff can see the details needed to complete the work. Department managers
          can see reports within their department. Municipal and platform administrators have
          city-level access appropriate to their role.
        </li>
        <li>
          Internal notes, moderation details, staff-only evidence and reporter contact details are
          not shown to citizens unless a specific feature says otherwise.
        </li>
        <li>
          Guest tracking requires both the public reference and a secure tracking code. It shows
          status updates only, not addresses or attachments.
        </li>
      </ul>

      <h2>5. AI-assisted features</h2>
      <p>
        When an AI provider is configured, report title and description text may be sent to that
        provider for a category suggestion, priority suggestion or summary. Account details, session
        tokens, passwords and attachments are not sent by the current implementation. AI output is
        validated, labelled and advisory; a person makes the final decision.
      </p>
      <p>
        Without a configured provider, a transparent rules-based fallback is used and labelled in
        the interface. Do not include sensitive personal information in a report description.
      </p>
      <p>
        <strong>Provider details:</strong> [OpenAI API account and data-processing terms, if
        enabled]. The operating organization must review the provider’s data-processing terms and
        retention settings before enabling the integration for real residents.
      </p>

      <h2>6. Maps, email and cookies</h2>
      <ul>
        <li>
          The map uses OpenStreetMap tiles by default. Loading tile images sends a request,
          including network and device information, to the tile provider. Address entry and
          coordinate entry remain available without using the map.
        </li>
        <li>
          If outbound email is configured, notification messages and password reset links are sent
          through <strong>[SMTP provider]</strong>. If it is not configured, no email is sent and the
          interface says so.
        </li>
        <li>
          A single httpOnly session cookie is used to keep signed-in users authenticated. It is
          marked SameSite=Lax and Secure in production. This implementation does not include
          advertising cookies or third-party analytics.
        </li>
      </ul>

      <h2>7. Retention and deletion</h2>
      <p>
        <strong>[Retention periods have not yet been configured for this demonstration.]</strong>{' '}
        Before launch, the operating organization must define retention for reports, attachments,
        audit records and accounts, and must document how deletion requests are handled while
        preserving legally required audit evidence. Local development data can be reset with the
        documented seed command.
      </p>

      <h2>8. Your choices and rights</h2>
      <p>
        Subject to applicable law, residents may request access to, correction of, or deletion of
        their personal information, or object to certain processing. This demonstration does not
        implement automated data-subject request handling. In production, direct requests to{' '}
        <strong>[Privacy contact]</strong>. Account holders can update their name, password and
        notification preferences from the profile page.
      </p>

      <h2>9. Security</h2>
      <p>
        The application uses hashed passwords, httpOnly session cookies, backend-enforced role and
        ownership checks, request validation, rate limits, upload validation and access-controlled
        file delivery. No system is perfectly secure. Report suspected vulnerabilities to{' '}
        <strong>[Security contact]</strong> rather than testing against live data.
      </p>

      <h2>10. Children</h2>
      <p>
        The service is intended for residents and municipal staff. The operating organization should
        set a minimum age and any parental-consent process required by local law before production.
      </p>

      <h2>11. Changes and contact</h2>
      <p>
        Material changes should be communicated through the service and through the operating
        organization’s normal channels. Questions about this draft should go to{' '}
        <strong>[Operating organization contact]</strong>.
      </p>
    </PolicyLayout>
  );
}
