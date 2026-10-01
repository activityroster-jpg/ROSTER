# Free email for @activityroster.com (receive + send, no Google)

Two free services do everything:

- **Cloudflare Email Routing** — receives mail at any `@activityroster.com`
  address and forwards it to your personal inbox (free, unlimited).
- **Resend** — sends mail *as* `@activityroster.com` (free tier: 3,000/month,
  100/day). Your app already uses Resend; this just verifies the domain so you
  (and Gmail) can send from it too.

No mail server, no Google Workspace, £0.

---

## Part 1 — Receive mail (Cloudflare Email Routing)

1. Log in to the **Cloudflare dashboard** and click the **activityroster.com** zone.
2. Left sidebar → **Email** → **Email Routing** → **Get started / Enable**.
3. Cloudflare asks to add DNS records (MX + an SPF TXT). Click **Add records
   and enable** — it does this automatically because your DNS is on Cloudflare.
4. **Add a destination address** (where mail lands): enter your personal inbox
   (e.g. your Gmail), then open the verification email Cloudflare sends there and
   click the link. This inbox is where all forwarded mail arrives.
5. **Create your addresses** under *Routing rules → Custom addresses → Create address*:
   - `hello@activityroster.com` → your inbox
   - `privacy@activityroster.com` → your inbox
   - `conor@activityroster.com` → your inbox
   - `support@activityroster.com` → your inbox (optional, handy)
   - add any others you want
6. **Turn on catch-all** (*Routing rules → Catch-all address → Edit → Send to →
   your inbox → Save*). Now anything@activityroster.com reaches you, so you never
   miss mail to an address you forgot to create.

✅ You can now **receive** at every address. Test it: email `hello@activityroster.com`
from your phone and check it lands in your inbox.

> Note: `no-reply@activityroster.com` is only used by the app to *send* system
> emails — you don't need a route for it (but a catch-all covers it anyway).

---

## Part 2 — Verify the domain in Resend (lets you send as the domain)

1. Log in to **Resend** → **Domains** → **Add Domain** → enter `activityroster.com`.
   If it offers a **region**, pick an **EU** region (keeps data in the EU, matching
   the rest of the platform).
2. Resend shows a set of DNS records to add — typically:
   - an **MX** record on the `send` subdomain (for bounce handling)
   - a **TXT (SPF)** record on `send` (`v=spf1 include:amazonses.com ~all`)
   - a **TXT (DKIM)** record at `resend._domainkey`
3. In Cloudflare → **activityroster.com → DNS → Records**, add **each record
   exactly as Resend shows it**. For these records set **Proxy status = DNS only**
   (grey cloud), not proxied.
4. Back in Resend, click **Verify**. It can take a few minutes (occasionally up to
   a few hours) for DNS to propagate; the status turns green when done.
5. *(Recommended for deliverability)* Add a **DMARC** record in Cloudflare DNS:
   - Type: **TXT**, Name: `_dmarc`, Content: `v=DMARC1; p=none; rua=mailto:hello@activityroster.com`

> These Resend records live on the **`send` subdomain**, so they do **not**
> conflict with the root-domain MX that Cloudflare Email Routing added in Part 1.
> Receiving (Cloudflare) and sending (Resend) coexist happily.

✅ Your app can now send from any `@activityroster.com` address, and so can Gmail
(next part).

---

## Part 3 — Reply *as* the domain from Gmail (free)

This uses Resend's SMTP as Gmail's outgoing server, so mail you send from Gmail
leaves as `hello@` / `conor@` etc.

### 3a. Make a Resend API key (the SMTP password)
1. Resend → **API Keys** → **Create API Key**. Name it `gmail-smtp`, permission
   **Sending access**. **Copy the key now** — you can't see it again. This string
   is your SMTP password below.

### 3b. Add the address in Gmail
1. Gmail → **⚙ Settings** → **See all settings** → **Accounts and Import** tab.
2. In **"Send mail as"**, click **Add another email address**.
3. Fill in:
   - **Name:** `Conor` (or `ActivityRoster`) — this is what recipients see.
   - **Email address:** `conor@activityroster.com` (or `hello@…`).
   - **Treat as an alias:** leave **ticked**.
   - Click **Next Step**.
4. On the SMTP screen enter **exactly**:
   - **SMTP Server:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** the Resend API key you copied in 3a
   - **Secured connection using SSL** — selected
   - Click **Add Account**.
5. Gmail emails a **confirmation code** to `conor@activityroster.com`. Because of
   Part 1, that forwards to your inbox — open it and click the confirmation link
   (or paste the code). Done.

### 3c. Repeat for each address
Do 3b again for `hello@`, `privacy@`, `support@` — same SMTP settings and the
same API key each time, just a different email address. Each needs its own
confirmation click.

### 3d. Make replies go out from the right address automatically
Still in **Accounts and Import**:
- Under **"When replying to a message:"** choose **"Reply from the same address
  the message was sent to."**
- Optionally set your most-used address (e.g. `hello@`) as **default** via *make
  default* next to it.

Now when someone emails `hello@activityroster.com`, it lands in your Gmail, and
hitting **Reply** sends back **from `hello@activityroster.com`**. To start a new
mail as a domain address, just pick it in the **From** dropdown in the compose
window.

---

## Quick test checklist
- [ ] Email `hello@activityroster.com` from your phone → it arrives in your inbox.
- [ ] Reply to it → recipient sees it **from** `hello@activityroster.com`.
- [ ] Compose new in Gmail, switch **From** to `conor@` → send to your phone →
      arrives, shows `conor@activityroster.com`, not in spam.
- [ ] Resend → **Domains** shows `activityroster.com` **Verified** (green).

## Costs & limits
- Cloudflare Email Routing: **free**, unlimited receiving/forwarding.
- Resend free tier: **3,000 emails/month, 100/day** (covers both your app's system
  emails and your Gmail "send as"). If you ever outgrow it, Resend's paid tier is
  far cheaper than per-mailbox Google Workspace seats.

## Optional app tidy-up
If you want the app's footer/support links to point at `hello@`, set the
`SUPPORT_EMAIL` Worker env var to `hello@activityroster.com` (otherwise it already
falls back sensibly).
